import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { PreviewProduct } from "@/lib/preview-products";
import { previewPriceMinor } from "@/lib/preview-products";
import { formatMoney } from "./catalog-types";

export function PreviewProductCard({ product }: { product: PreviewProduct }) {
  const image = product.images[0];
  return <Link href={`/product/${product.slug}`} className="preview-product-card">
    <div className="preview-product-image">
      <Image src={image.url} alt={image.alt} width={1254} height={1254} sizes="(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 25vw" />
      <span className="preview-product-badge">Preview</span>
    </div>
    <div className="preview-product-meta">
      <div><span>{product.category}</span><h3>{product.name}</h3><small>{formatMoney(previewPriceMinor)} · test price</small></div>
      <ArrowUpRight size={20} strokeWidth={1.4} aria-hidden="true" />
    </div>
  </Link>;
}
