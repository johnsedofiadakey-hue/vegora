import "server-only";

import type { Audience, Product, ProductInput, ProductTag, ProductVariant } from "../catalog";
import { storeDb } from "./firebase-admin";
import { HttpError } from "./http";
import { forgetMemo, memo } from "./memo";

const products = () => storeDb().collection("products");
const validSlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

export interface StoredVariant extends ProductVariant { reserved: number }
export interface StoredProduct extends Omit<Product, "variants"> { variants: StoredVariant[] }

export function readStoredProduct(data: FirebaseFirestore.DocumentData | undefined): StoredProduct | null {
  if (!data) return null;
  const product = data as Product;
  return { ...product, tags: Array.isArray(product.tags) ? product.tags : [], variants: product.variants.map((variant) => ({
    ...variant,
    reserved: Number((variant as StoredVariant).reserved ?? 0),
  })) };
}

function exposeProduct(record: StoredProduct, admin: boolean): Product {
  return { ...record, variants: record.variants.map(({ reserved, ...variant }) => ({
    ...variant,
    stock: admin ? variant.stock : Math.max(0, variant.stock - reserved),
  })) };
}

function isAvailable(record: StoredProduct): boolean {
  return record.priceMinor !== null && record.images.length > 0 &&
    record.variants.some((variant) => variant.stock - variant.reserved > 0);
}

async function listAvailable(query: FirebaseFirestore.Query, limit: number): Promise<Product[]> {
  const visible: Product[] = [];
  const pageSize = Math.min(100, Math.max(limit, 24));
  let page = query.orderBy("updatedAt", "desc").limit(pageSize);
  while (visible.length < limit) {
    const snap = await page.get();
    for (const doc of snap.docs) {
      const record = readStoredProduct(doc.data());
      if (record && isAvailable(record)) visible.push(exposeProduct(record, false));
      if (visible.length === limit) break;
    }
    if (snap.size < pageSize || visible.length === limit) break;
    page = page.startAfter(snap.docs[snap.docs.length - 1]);
  }
  return visible;
}

export async function getPublishedProduct(slug: string): Promise<Product | null> {
  if (!validSlug(slug)) return null;
  const snap = await products().doc(slug).get();
  const data = readStoredProduct(snap.data());
  return data?.status === "published" && isAvailable(data) ? exposeProduct(data, false) : null;
}

// How long a list of products may be reused before asking the database again. Short, because stock changes.
const listTtlMs = 30_000;
// Whether any women's piece is on sale changes rarely, and the question is asked on every page view.
const availabilityTtlMs = 120_000;
const catalogTtlMs = 60_000;

export async function listPublishedProducts(audience: Audience | null, limit: number): Promise<Product[]> {
  return memo(`list:${audience ?? "all"}:${limit}`, listTtlMs, () => queryPublishedProducts(audience, limit));
}

async function queryPublishedProducts(audience: Audience | null, limit: number): Promise<Product[]> {
  let query = products().where("status", "==", "published");
  if (audience === "women" || audience === "men") {
    query = query.where("audience", "in", [audience, "unisex"]);
  } else if (audience === "unisex") {
    query = query.where("audience", "==", "unisex");
  }
  return listAvailable(query, limit);
}

export async function listTaggedProducts(tag: ProductTag, audience: Audience | null, limit: number): Promise<Product[]> {
  return memo(`tag:${tag}:${audience ?? "all"}:${limit}`, listTtlMs, () => queryTaggedProducts(tag, audience, limit));
}

async function queryTaggedProducts(tag: ProductTag, audience: Audience | null, limit: number): Promise<Product[]> {
  let query = products().where("status", "==", "published").where("tags", "array-contains", tag);
  if (audience === "women" || audience === "men") {
    query = query.where("audience", "in", [audience, "unisex"]);
  } else if (audience === "unisex") {
    query = query.where("audience", "==", "unisex");
  }
  return listAvailable(query, limit);
}

export async function hasAvailableProductsForAudience(audience: "women" | "men"): Promise<boolean> {
  return memo(`available:${audience}`, availabilityTtlMs, () => queryAvailability(audience));
}

// Reads a few products at a time and stops at the first one on sale, so the usual answer costs a handful of
// reads rather than the whole range.
async function queryAvailability(audience: "women" | "men"): Promise<boolean> {
  const pageSize = 10;
  let query = products().where("status", "==", "published")
    .where("audience", "in", [audience, "unisex"])
    .orderBy("updatedAt", "desc").select("priceMinor", "images", "variants").limit(pageSize);
  while (true) {
    const snap = await query.get();
    if (snap.docs.some((doc) => {
      const product = readStoredProduct(doc.data());
      return product && isAvailable(product);
    })) return true;
    if (snap.size < pageSize) return false;
    query = query.startAfter(snap.docs[snap.docs.length - 1]);
  }
}

// Search looks through every published product. That whole list is read once a minute and shared by every
// search, instead of being read again for each one.
async function searchCatalog(): Promise<Product[]> {
  return memo("search-catalog", catalogTtlMs, async () => {
    const snap = await products().where("status", "==", "published").limit(500).get();
    if (snap.size === 500) throw new HttpError(503, "Search needs a larger catalog index. Please browse collections for now");
    return snap.docs.map((doc) => exposeProduct(readStoredProduct(doc.data())!, false));
  });
}

export async function searchPublishedProducts(query: string, audience: Audience | null, limit: number): Promise<Product[]> {
  const catalog = await searchCatalog();
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return catalog
    .filter((product) => product.priceMinor !== null && product.images.length > 0 && product.variants.some((variant) => variant.stock > 0))
    .filter((product) => !audience || product.audience === audience || (audience !== "unisex" && product.audience === "unisex"))
    .filter((product) => {
      const haystack = [product.name, product.category, product.description, product.slug].join(" ").toLocaleLowerCase();
      return words.every((word) => haystack.includes(word));
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export async function listAdminProducts(): Promise<Product[]> {
  const snap = await products().orderBy("updatedAt", "desc").limit(201).get();
  if (snap.size > 200) throw new HttpError(503, "Admin catalog needs pagination before adding more products");
  return snap.docs.map((doc) => exposeProduct(readStoredProduct(doc.data())!, true));
}

export async function getAdminProduct(slug: string): Promise<Product | null> {
  if (!validSlug(slug)) return null;
  const snap = await products().doc(slug).get();
  const data = readStoredProduct(snap.data());
  return data ? exposeProduct(data, true) : null;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const now = new Date().toISOString();
  const product: StoredProduct = { ...input, id: input.slug, createdAt: now, updatedAt: now,
    variants: input.variants.map((variant) => ({ ...variant, reserved: 0 })) };
  try {
    await products().doc(input.slug).create(product);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error &&
      (error.code === 6 || error.code === "already-exists")) {
      throw new HttpError(409, "A product with this slug already exists");
    }
    throw error;
  }
  forgetMemo();
  return exposeProduct(product, true);
}

export async function updateProduct(slug: string, input: ProductInput): Promise<Product> {
  if (!validSlug(slug) || slug !== input.slug) throw new HttpError(400, "Product slug cannot be changed after creation");
  const ref = products().doc(slug);
  return storeDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = readStoredProduct(snap.data());
    if (!existing) throw new HttpError(404, "Product not found");
    const reservedById = new Map(existing.variants.map((variant) => [variant.id, variant.reserved]));
    if (existing.variants.some((variant) => variant.reserved > 0 && !input.variants.some((next) => next.id === variant.id))) {
      throw new HttpError(409, "A size with reserved stock cannot be removed");
    }
    const variants = input.variants.map((variant) => {
      const reserved = reservedById.get(variant.id) ?? 0;
      if (variant.stock < reserved) throw new HttpError(409, "Stock cannot be less than units reserved for payment");
      return { ...variant, reserved };
    });
    const product: StoredProduct = { ...input, id: slug, variants,
      createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
    tx.set(ref, product);
    forgetMemo();
    return exposeProduct(product, true);
  });
}

export async function archiveProduct(slug: string): Promise<Product> {
  if (!validSlug(slug)) throw new HttpError(404, "Product not found");
  const ref = products().doc(slug);
  return storeDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = readStoredProduct(snap.data());
    if (!existing) throw new HttpError(404, "Product not found");
    const product: StoredProduct = { ...existing, status: "archived", featured: false, updatedAt: new Date().toISOString() };
    tx.set(ref, product);
    forgetMemo();
    return exposeProduct(product, true);
  });
}
