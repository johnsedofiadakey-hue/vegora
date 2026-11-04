"use client";

import { useSyncExternalStore } from "react";

// Saved pieces live in this browser only (no account), like the cart. Only the
// product slugs are kept; the wishlist page loads the current name, price and
// stock, so a saved piece never shows an old price.

const WISHLIST_KEY = "vegora-wishlist-v1";
const CHANGE_EVENT = "vegora-wishlist-change";
const maxSaved = 48;
const empty: string[] = [];

let cachedRaw: string | null = null;
let cachedSlugs: string[] = empty;

function parse(raw: string | null): string[] {
  try {
    const stored = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(stored)) return empty;
    return [...new Set(stored.filter((slug): slug is string => typeof slug === "string" && /^[a-z0-9-]{1,80}$/.test(slug)))].slice(0, maxSaved);
  } catch { return empty; }
}

export function readWishlist(): string[] {
  if (typeof window === "undefined") return empty;
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(WISHLIST_KEY); } catch { return cachedSlugs; }
  if (raw !== cachedRaw) { cachedRaw = raw; cachedSlugs = parse(raw); }
  return cachedSlugs;
}

function writeWishlist(slugs: string[]) {
  try { window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(slugs.slice(0, maxSaved))); } catch { /* private mode: keep going */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Saves the piece if it is not saved yet, otherwise removes it. Newest first. */
export function toggleWishlist(slug: string) {
  const slugs = readWishlist();
  writeWishlist(slugs.includes(slug) ? slugs.filter((item) => item !== slug) : [slug, ...slugs]);
}

export function removeFromWishlist(slug: string) {
  writeWishlist(readWishlist().filter((item) => item !== slug));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The saved slugs, kept in step across components and other open tabs. */
export function useWishlist(): string[] {
  return useSyncExternalStore(subscribe, readWishlist, () => empty);
}
