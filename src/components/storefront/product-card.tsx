import Link from "next/link";
import Image from "next/image";
import { Product, formatMoney } from "./catalog-types";

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  return <Link href={`/product/${encodeURIComponent(product.slug)}`} className="product-card">
    <div className="product-card-image">
      {image ? <Image src={image.url} alt={image.alt || product.name} width={600} height={800} unoptimized /> : <span>VEGORA</span>}
    </div>
    <div className="product-card-meta"><div><span>{product.category}</span><h3>{product.name}</h3></div><strong>{formatMoney(product.priceMinor, product.currency)}</strong></div>
  </Link>;
}
