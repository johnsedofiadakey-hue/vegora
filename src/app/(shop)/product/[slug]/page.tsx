import { ProductDetail } from "@/components/storefront/product-detail";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetail key={slug} slug={slug} />;
}
