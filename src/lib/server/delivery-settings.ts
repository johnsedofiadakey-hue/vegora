import "server-only";

import {
  defaultCodSettings, defaultRegion, DeliveryInputError, hardMaxCodMinor, maxAreaLabel, maxAreaRegion, maxDeliveryAreas,
  maxDeliveryFeeMinor, minCodMaxMinor, parseDeliverySettings, type CodSettings, type DeliveryArea,
} from "../delivery";
import { checkoutBase, envDeliveryZones, type CheckoutConfig } from "./checkout-config";
import { ServerConfigError, storeDb } from "./firebase-admin";
import { HttpError } from "./http";

const settingsRef = () => storeDb().collection("settings").doc("delivery");
const eventRef = () => storeDb().collection("deliveryEvents").doc();

export interface DeliveryState {
  areas: DeliveryArea[];
  /** Pay-on-delivery switch and the highest order amount. */
  cod: CodSettings;
  /** "admin" once the admin has saved the Delivery screen; "server" while the server setting is still in use. */
  source: "admin" | "server";
  updatedAt: string | null;
}

/** Reads a stored list defensively. Anything malformed counts as "nothing saved", so checkout falls back safely. */
export function readStoredAreas(data: FirebaseFirestore.DocumentData | undefined): DeliveryArea[] | null {
  if (!data || !Array.isArray(data.areas) || data.areas.length === 0 || data.areas.length > maxDeliveryAreas) return null;
  const areas: DeliveryArea[] = [];
  for (const row of data.areas as unknown[]) {
    if (!row || typeof row !== "object") return null;
    const value = row as Record<string, unknown>;
    if (typeof value.id !== "string" || !/^[a-z0-9-]{1,50}$/.test(value.id) ||
        typeof value.label !== "string" || !value.label.trim() || value.label.length > maxAreaLabel ||
        typeof value.region !== "string" || !value.region.trim() || value.region.length > maxAreaRegion ||
        typeof value.active !== "boolean" ||
        !Number.isSafeInteger(value.feeMinor) || Number(value.feeMinor) < 0 || Number(value.feeMinor) > maxDeliveryFeeMinor) return null;
    // Lists saved before pay on delivery existed have no flag: that means off.
    areas.push({ id: value.id, label: value.label, region: value.region, feeMinor: Number(value.feeMinor), active: value.active, cod: value.cod === true });
  }
  if (new Set(areas.map((area) => area.id)).size !== areas.length || !areas.some((area) => area.active)) return null;
  return areas;
}

/** Reads the stored pay-on-delivery settings defensively. Anything odd means off. */
export function readStoredCod(data: FirebaseFirestore.DocumentData | undefined): CodSettings {
  const value = data?.cod;
  if (!value || typeof value !== "object" || typeof value.enabled !== "boolean" || !Number.isSafeInteger(value.maxOrderMinor) ||
      value.maxOrderMinor < minCodMaxMinor || value.maxOrderMinor > hardMaxCodMinor) return { ...defaultCodSettings };
  return { enabled: value.enabled, maxOrderMinor: value.maxOrderMinor };
}

// A very short cache: the checkout page and the order both read this, and a price change
// should show almost at once. Saving clears it on the instance that handled the save.
const cache = globalThis as unknown as { __vegoraDelivery?: { at: number; value: DeliveryState } };

export async function getDeliveryState(fresh = false): Promise<DeliveryState> {
  const hit = cache.__vegoraDelivery;
  if (!fresh && hit && Date.now() - hit.at < 10_000) return hit.value;
  const data = (await settingsRef().get()).data();
  const stored = readStoredAreas(data);
  let value: DeliveryState;
  if (stored) {
    value = { areas: stored, cod: readStoredCod(data), source: "admin", updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : null };
  } else {
    const env = envDeliveryZones();
    value = {
      areas: (env ?? []).map((zone) => ({ id: zone.id, label: zone.label, region: zone.region, feeMinor: zone.feeMinor, active: true, cod: false })),
      cod: { ...defaultCodSettings }, source: "server", updatedAt: null,
    };
  }
  cache.__vegoraDelivery = { at: Date.now(), value };
  return value;
}

export async function saveDeliveryAreas(input: unknown, actorUid: string): Promise<DeliveryState> {
  const current = await getDeliveryState(true);
  let areas: DeliveryArea[];
  let cod: CodSettings;
  try { ({ areas, cod } = parseDeliverySettings(input, current)); } catch (error) {
    if (error instanceof DeliveryInputError) throw new HttpError(400, error.message);
    throw error;
  }
  const now = new Date().toISOString();
  const batch = storeDb().batch();
  batch.set(settingsRef(), { areas, cod, updatedAt: now, updatedBy: actorUid });
  // Every change is kept: who, when, and what the list was before and after.
  batch.create(eventRef(), {
    action: "update", before: current.areas, after: areas, codBefore: current.cod, codAfter: cod,
    source: current.source, actor: actorUid, at: now,
  });
  await batch.commit();
  const value: DeliveryState = { areas, cod, source: "admin", updatedAt: now };
  cache.__vegoraDelivery = { at: Date.now(), value };
  return value;
}

/** The full checkout settings, with the delivery areas customers may choose from (areas that are on). */
export async function loadCheckoutConfig(fresh = false): Promise<CheckoutConfig> {
  const base = checkoutBase();
  const state = await getDeliveryState(fresh);
  const zones = state.areas.filter((area) => area.active)
    .map(({ id, label, region, feeMinor, cod }) => ({ id, label, region: region || defaultRegion, feeMinor, cod }));
  if (zones.length === 0) throw new ServerConfigError("Checkout is not configured");
  return { ...base, zones, cod: state.cod };
}
