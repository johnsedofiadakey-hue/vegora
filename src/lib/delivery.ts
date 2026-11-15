// Delivery area rules. Everything here is pure, so the same code is tested and used by
// the server. The browser never decides what a delivery costs: the server reads the
// areas again when an order is made, and the order keeps the fee it was made with.

export const maxDeliveryAreas = 20;
export const maxAreaLabel = 40;
export const maxAreaRegion = 60;
/** The most one delivery area may charge: GH₵500. A guard against a slipped decimal point. */
export const maxDeliveryFeeMinor = 50_000;
export const defaultRegion = "Greater Accra";

export interface DeliveryArea {
  /** Made by the server from the name. Never typed by the admin and never changed. */
  id: string;
  label: string;
  region: string;
  /** Pesewas. 0 means free delivery. */
  feeMinor: number;
  /** Off means customers cannot choose it. Past orders are not touched. */
  active: boolean;
}

export class DeliveryInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliveryInputError";
  }
}

function fail(message: string): never {
  throw new DeliveryInputError(message);
}

function cleanText(value: unknown, name: string, max: number): string {
  if (typeof value !== "string") fail(`${name} is required`);
  const text = value.replace(/\s+/g, " ").trim();
  if (/[\u0000-\u001f\u007f<>]/.test(text)) fail(`${name} has characters that are not allowed`);
  if (!text) fail(`${name} is required`);
  if (text.length > max) fail(`${name} must be ${max} characters or fewer`);
  return text;
}

/** A short web-safe id made from the area name, for example "East Legon" becomes "east-legon". */
export function areaSlug(label: string): string {
  const slug = label.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30).replace(/-+$/g, "");
  return slug || "area";
}

function freshId(label: string, taken: Set<string>): string {
  const base = areaSlug(label);
  if (!taken.has(base)) return base;
  for (let number = 2; number < 1000; number += 1) {
    const candidate = `${base.slice(0, 26)}-${number}`;
    if (!taken.has(candidate)) return candidate;
  }
  return fail("Could not make a unique name for that area");
}

/**
 * Checks the whole list the admin saved. `current` is what is live now: an id may only be
 * one of those (it keeps an area's identity), and a row without an id is a new area, whose id
 * the server makes.
 */
export function parseDeliveryAreas(input: unknown, current: readonly DeliveryArea[]): DeliveryArea[] {
  const list = input && typeof input === "object" && !Array.isArray(input) ? (input as { areas?: unknown }).areas : undefined;
  if (!Array.isArray(list) || list.length === 0) fail("Add at least one delivery area");
  if (list.length > maxDeliveryAreas) fail(`You can have at most ${maxDeliveryAreas} delivery areas`);

  const known = new Map(current.map((area) => [area.id, area]));
  const taken = new Set(current.map((area) => area.id));
  const used = new Set<string>();
  const labels = new Set<string>();
  const areas: DeliveryArea[] = [];

  for (const row of list) {
    if (!row || typeof row !== "object" || Array.isArray(row)) fail("Each delivery area must have a name and a price");
    const value = row as Record<string, unknown>;
    const label = cleanText(value.label, "Area name", maxAreaLabel);
    const region = value.region === undefined || value.region === "" ? defaultRegion : cleanText(value.region, "Region", maxAreaRegion);
    if (typeof value.active !== "boolean") fail("Choose whether each area is on or off");
    const fee = value.feeMinor;
    if (typeof fee !== "number" || !Number.isSafeInteger(fee) || fee < 0) fail(`The price for ${label} must be an amount in cedis, for example 30 or 45.50`);
    if (fee > maxDeliveryFeeMinor) fail(`The price for ${label} cannot be more than GH₵${maxDeliveryFeeMinor / 100}`);

    let id: string;
    if (value.id === undefined || value.id === null || value.id === "") {
      id = freshId(label, taken);
      taken.add(id);
    } else {
      if (typeof value.id !== "string" || !known.has(value.id)) fail("One of the delivery areas is not recognised. Reload the page and try again");
      id = value.id;
    }
    if (used.has(id)) fail("The same delivery area is listed twice");
    used.add(id);
    const key = label.toLocaleLowerCase();
    if (labels.has(key)) fail(`There are two areas called ${label}. Give each area its own name`);
    labels.add(key);
    areas.push({ id, label, region, feeMinor: fee, active: value.active });
  }

  if (!areas.some((area) => area.active)) fail("Keep at least one area switched on. With none on, customers cannot order");
  return areas;
}

/** What the admin sees as "GH₵30.00". */
export function feeText(feeMinor: number): string {
  return feeMinor === 0 ? "Free" : `GH₵${(feeMinor / 100).toFixed(2)}`;
}

/** Cedis typed by a person, such as "30" or "45.5", to whole pesewas. NaN when it is not a valid amount. */
export function cedisToMinor(text: string): number {
  const value = text.trim().replace(/^GH[₵C]?\s*/i, "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value)) return Number.NaN;
  return Math.round(Number(value) * 100);
}
