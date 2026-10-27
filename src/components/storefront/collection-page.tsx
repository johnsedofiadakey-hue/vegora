import Image from "next/image";
import { CatalogCollection } from "./catalog-collection";

type CollectionPageProps = { audience?: "women" | "men"; title: string; eyebrow: string; description: string };

export function CollectionPage({ audience, title, eyebrow, description }: CollectionPageProps) {
  const image = audience === "men" ? "/editorial/ve-man-coat.png" : "/editorial/ve-woman-light.png";
  return <div className="collection-page">
    <section className={`collection-banner ${audience === "men" ? "collection-banner-men" : ""}`}>
      <div className="collection-banner-copy"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      <div className="collection-banner-image"><Image src={image} alt={`${title} editorial portrait`} fill priority sizes="(max-width: 767px) 100vw, 50vw" /></div>
    </section>
    <section className="catalog-section section-pad" aria-label={`${title} products`}><div className="section-heading"><span>VEGORA / THE COLLECTION</span><h2>Discover the pieces</h2></div><CatalogCollection audience={audience} /></section>
  </div>;
}
