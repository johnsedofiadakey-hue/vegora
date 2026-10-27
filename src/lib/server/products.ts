import "server-only";

import type { Audience, Product, ProductInput, ProductVariant } from "../catalog";
import { storeDb } from "./firebase-admin";
import { HttpError } from "./http";

const products = () => storeDb().collection("products");
const validSlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

export interface StoredVariant extends ProductVariant { reserved: number }
export interface StoredProduct extends Omit<Product, "variants"> { variants: StoredVariant[] }

export function readStoredProduct(data: FirebaseFirestore.DocumentData | undefined): StoredProduct | null {
  if (!data) return null;
  const product = data as Product;
  return { ...product, variants: product.variants.map((variant) => ({
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

export async function getPublishedProduct(slug: string): Promise<Product | null> {
  if (!validSlug(slug)) return null;
  const snap = await products().doc(slug).get();
  const data = readStoredProduct(snap.data());
  return data?.status === "published" ? exposeProduct(data, false) : null;
}

export async function listPublishedProducts(audience: Audience | null, limit: number): Promise<Product[]> {
  let query = products().where("status", "==", "published");
  if (audience === "women" || audience === "men") {
    query = query.where("audience", "in", [audience, "unisex"]);
  } else if (audience === "unisex") {
    query = query.where("audience", "==", "unisex");
  }
  const snap = await query.orderBy("updatedAt", "desc").limit(limit).get();
  return snap.docs.map((doc) => exposeProduct(readStoredProduct(doc.data())!, false));
}

export async function searchPublishedProducts(query: string, audience: Audience | null, limit: number): Promise<Product[]> {
  const snap = await products().where("status", "==", "published").limit(500).get();
  if (snap.size === 500) throw new HttpError(503, "Search needs a larger catalog index. Please browse collections for now");
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return snap.docs.map((doc) => exposeProduct(readStoredProduct(doc.data())!, false))
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
    return exposeProduct(product, true);
  });
}
