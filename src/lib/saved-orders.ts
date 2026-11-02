// Orders a customer chose to keep on their own device so they can check them
// again without retyping. Only the short order number and the phone number used
// at checkout are stored, in that browser's local storage; nothing is sent anywhere.
import { maskPhone, phoneKey } from "./contact.ts";
import { normalizeShortCode } from "./fulfillment.ts";

export interface SavedOrder { code: string; contact: string; savedAt: string }

export const savedOrdersKey = "vegora-saved-orders-v1";
export const maxSavedOrders = 5;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A phone number or (for older orders) an email address, tidied up, or null if it is neither. */
function cleanContact(value: string): string | null {
  const text = value.trim();
  if (text.length === 0 || text.length > 254) return null;
  if (text.includes("@")) return emailPattern.test(text) ? text.toLowerCase() : null;
  return phoneKey(text) ? text.replace(/\s+/g, " ") : null;
}

/** Reads whatever is stored, ignoring anything malformed. Never throws. */
export function parseSavedOrders(raw: string | null | undefined): SavedOrder[] {
  if (!raw) return [];
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: SavedOrder[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { code, contact, email, savedAt } = entry as Record<string, unknown>;
    const stored = contact ?? email;
    if (typeof code !== "string" || typeof stored !== "string" || typeof savedAt !== "string") continue;
    const clean = normalizeShortCode(code);
    const tidy = cleanContact(stored);
    if (!clean || !tidy || Number.isNaN(Date.parse(savedAt))) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    result.push({ code: clean, contact: tidy, savedAt });
  }
  return result.slice(0, maxSavedOrders);
}

/** Adds an order (newest first). The same order number is kept once. */
export function addSavedOrder(list: SavedOrder[], code: string, contact: string, now: Date = new Date()): SavedOrder[] {
  const clean = normalizeShortCode(code);
  const tidy = cleanContact(contact);
  if (!clean || !tidy) return list;
  return [{ code: clean, contact: tidy, savedAt: now.toISOString() }, ...list.filter((item) => item.code !== clean)].slice(0, maxSavedOrders);
}

export function removeSavedOrder(list: SavedOrder[], code: string): SavedOrder[] {
  const clean = normalizeShortCode(code);
  return clean ? list.filter((item) => item.code !== clean) : list;
}

/** How a saved contact is shown on screen: only the end of a phone number, or a shortened email. */
export function maskContact(contact: string): string {
  if (!contact.includes("@")) return maskPhone(contact);
  const [name, domain = ""] = contact.split("@");
  return `${name.slice(0, 2)}${name.length > 2 ? "…" : ""}@${domain}`;
}

/** The address a customer can bookmark or share with themselves. It holds no email. */
export function trackLink(origin: string, code: string): string {
  return `${origin}/track?order=${encodeURIComponent(code)}`;
}

/** Reads ?order= from a link. Returns a clean short order number or null. */
export function orderFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("order");
  return value && value.length <= 40 ? normalizeShortCode(value) : null;
}
