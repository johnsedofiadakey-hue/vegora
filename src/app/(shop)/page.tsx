import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import HomeMotion from "@/components/storefront/home-motion";
import { previewProducts } from "@/lib/preview-products";

export default function HomePage() {
  return <div className="home-page">
    <HomeMotion />
    <section className="gallery-hero" aria-labelledby="hero-title">
      <div className="hero-man"><Image src="/editorial/ve-man.png" alt="VEGORA editorial portrait of a man in black tailoring" fill priority loading="eager" sizes="(max-width: 767px) 50vw, 25vw" /></div>
      <div className="hero-copy">
        <span className="eyebrow">VEGORA / A NEW PERSPECTIVE</span>
        <h1 id="hero-title">The art<br />of dressing</h1>
        <p>Style is personal. Make it yours.</p>
        <div className="hero-links"><Link href="/women">Explore women <ArrowUpRight size={16} /></Link><Link href="/men">Explore men <ArrowUpRight size={16} /></Link></div>
        <div className="hero-motion-mark" aria-hidden="true"><span className="hero-motion-ring" /><span className="hero-motion-core">V</span></div>
      </div>
      <div className="hero-woman"><Image src="/editorial/ve-woman.png" alt="VEGORA editorial portrait of a woman in black tailoring" fill priority loading="eager" sizes="(max-width: 767px) 50vw, 43vw" /></div>
      <div className="hero-scroll-cue" aria-hidden="true"><span>SCROLL TO EXPLORE</span><i /></div>
    </section>

    <div className="home-surface">
    <section className="home-intro section-pad" aria-label="VEGORA introduction">
      <p>AN EXPRESSION OF YOU</p>
      <h2 data-reveal>Considered style.<br /><em>Distinct presence.</em></h2>
      <span>VEGORA explores the way we dress and the presence we bring to every room.</span>
    </section>

    <section className="home-collections section-pad" aria-labelledby="collections-heading">
      <div className="section-heading"><span>01 / EXPLORE</span><h2 id="collections-heading">The collections</h2></div>
      <div className="collection-tiles">
        <Link href="/women" className="collection-tile" data-reveal>
          <div className="tile-image tile-image-women"><Image src="/editorial/ve-woman-light.png" alt="Woman in white tailored jacket" fill sizes="(max-width: 767px) 100vw, 50vw" /></div>
          <div className="tile-caption"><span>For her</span><strong>Women</strong><ArrowUpRight size={22} strokeWidth={1.3} /></div>
        </Link>
        <Link href="/men" className="collection-tile" data-reveal>
          <div className="tile-image tile-image-men"><Image src="/editorial/ve-man-coat.png" alt="Man in a black overcoat" fill sizes="(max-width: 767px) 100vw, 50vw" /></div>
          <div className="tile-caption"><span>For him</span><strong>Men</strong><ArrowUpRight size={22} strokeWidth={1.3} /></div>
        </Link>
      </div>
    </section>

    <section className="home-arrivals" aria-labelledby="home-arrivals-heading">
      <div className="home-arrivals-copy"><span className="eyebrow">02 / THE FIRST PIECES</span><h2 id="home-arrivals-heading">A closer<br /><em>look.</em></h2><p>Meet the first striped pieces in the VEGORA collection. Explore the details while final prices and availability are being prepared.</p><Link href="/men" className="line-link">View the preview collection <ArrowUpRight size={16} /></Link></div>
      <div className="home-arrivals-images">
        <div><Image src={previewProducts[0].images[0].url} alt={previewProducts[0].images[0].alt} fill sizes="(max-width: 767px) 50vw, 32vw" /></div>
        <div><Image src={previewProducts[3].images[0].url} alt={previewProducts[3].images[0].alt} fill sizes="(max-width: 767px) 50vw, 32vw" /></div>
      </div>
    </section>

    <section className="editorial-callout" aria-labelledby="edit-heading">
      <div className="editorial-photo"><Image src="/editorial/ve-detail.png" alt="Close-up of black tailoring and a white shirt cuff" fill sizes="(max-width: 767px) 100vw, 55vw" /></div>
      <div className="editorial-copy" data-reveal><span className="eyebrow">03 / THE EDIT</span><h2 id="edit-heading">A study in<br /><em>self-expression.</em></h2><p>Discover the mood behind VEGORA: strong silhouettes, quiet detail, and the freedom to dress on your own terms.</p><Link href="/the-edit" className="line-link">Explore the edit <ArrowUpRight size={16} /></Link></div>
    </section>

    <section className="closing-statement section-pad"><span>VEGORA</span><h2>Elevate your style.</h2><Link href="/new-in" className="outline-button">Explore new in <ArrowUpRight size={17} /></Link></section>
    </div>
  </div>;
}
