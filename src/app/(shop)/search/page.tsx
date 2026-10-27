import type { Metadata } from "next";
import { CatalogCollection } from "@/components/storefront/catalog-collection";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q || "").trim();
  return <div className="search-page section-pad"><span className="eyebrow">VEGORA / SEARCH</span><h1>{query ? `Results for “${query}”` : "Search"}</h1>{query ? <CatalogCollection query={query} /> : <p>Use the search icon above to find a piece or category.</p>}</div>;
}
