import type { Metadata } from "next";
import { CollectionPage } from "@/components/storefront/collection-page";
import { hasAvailableProductsForAudience } from "@/lib/server/products";
import { notFound } from "next/navigation";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Women", description: "Women's clothes from VEGORA." };
export default async function WomenPage() {
  await connection();
  let available = false;
  try { available = await hasAvailableProductsForAudience("women"); } catch { /* Catalog unavailable: keep this collection hidden. */ }
  if (!available) notFound();
  return <CollectionPage audience="women" title="Women" eyebrow="VEGORA / WOMEN" description="Clothes for women. Easy to wear, easy to style." />;
}
