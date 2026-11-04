import Link from "next/link";
import Image from "next/image";
import { Product, formatMoney } from "./catalog-types";
import { WishlistButton } from "./wishlist-button";

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  return <div className="product-card"><Link href={`/product/${encodeURIComponent(product.slug)}`}>
    <div className="product-card-image">
      {image ? <Image src={image.url} alt={image.alt || product.name} width={600} height={800} sizes="(max-width: 767px) 50vw, 33vw" /> : <span>VEGORA</span>}
      {!!product.tags?.length && <div className="product-card-tags">{product.tags.map((tag) => <span key={tag}>{tag === "new_arrival" ? "New arrival" : "Best seller"}</span>)}</div>}
    </div>
    <div className="product-card-meta"><div><span>{product.category}</span><h3>{product.name}</h3></div><strong>{formatMoney(product.priceMinor, product.currency)}</strong></div>
  </Link><WishlistButton slug={product.slug} name={product.name} variant="card" /></div>;
}
