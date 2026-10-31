import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import HomeMotion from "@/components/storefront/home-motion";
import { ContentImage } from "@/components/storefront/content-image";
import { WomenOnly } from "@/components/storefront/collection-availability";
import { HeroCompanionPortrait } from "@/components/storefront/hero-companion-portrait";
import { defaultValues, type ImageValue } from "@/lib/site-content";
import { jsonLd, organizationJsonLd, siteOrigin } from "@/lib/seo";
import { getContent } from "@/lib/server/site-content-cache";
import { featuredPieceImages } from "@/lib/server/featured-pieces";

export default async function HomePage() {
  const [content, contact] = await Promise.all([getContent("home"), getContent("contact")]);
  const pieces = await featuredPieceImages(content.arrivalsProducts, defaultValues("home").arrivalsProducts as string[]);
  return <div className="home-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organizationJsonLd(siteOrigin(), contact.instagram)) }} />
    <HomeMotion />
    <section className="gallery-hero" aria-labelledby="hero-title">
      <div className="hero-man"><ContentImage image={content.heroImage} fill priority loading="eager" sizes="(max-width: 767px) 50vw, 25vw" /></div>
      <div className="hero-copy">
        <span className="eyebrow">{content.heroEyebrow}</span>
        <h1 id="hero-title">{content.heroLine1}<br />{content.heroLine2}</h1>
        <p>{content.heroSubline}</p>
        <div className="hero-links"><Link href="/men">Explore men <ArrowUpRight size={16} /></Link><WomenOnly><Link href="/women">Explore women <ArrowUpRight size={16} /></Link></WomenOnly></div>
        <div className="hero-motion-mark" aria-hidden="true"><span className="hero-motion-ring" /><span className="hero-motion-core">V</span></div>
      </div>
      <HeroCompanionPortrait />
      <div className="hero-scroll-cue" aria-hidden="true"><span>SCROLL TO EXPLORE</span><i /></div>
    </section>

    <div className="home-surface">
    <section className="home-intro section-pad" aria-label="VEGORA introduction">
      <p>{content.introLabel}</p>
      <h2 data-reveal>{content.introLead}<br /><em>{content.introEmphasis}</em></h2>
      <span>{content.introBody}</span>
    </section>

    <section className="home-collections section-pad" aria-labelledby="collections-heading">
      <div className="section-heading"><span>{content.collectionsLabel}</span><h2 id="collections-heading">{content.collectionsHeading}</h2></div>
      <div className="collection-tiles">
        <Link href="/men" className="collection-tile" data-reveal>
          <div className="tile-image tile-image-men"><ContentImage image={content.menTileImage} fill sizes="(max-width: 767px) 100vw, 50vw" /></div>
          <div className="tile-caption"><span>For him</span><strong>Men</strong><ArrowUpRight size={22} strokeWidth={1.3} /></div>
        </Link>
        <WomenOnly><Link href="/women" className="collection-tile" data-reveal>
          <div className="tile-image tile-image-women"><ContentImage image={content.womenTileImage} fill sizes="(max-width: 767px) 100vw, 50vw" /></div>
          <div className="tile-caption"><span>For her</span><strong>Women</strong><ArrowUpRight size={22} strokeWidth={1.3} /></div>
        </Link></WomenOnly>
      </div>
    </section>

    <section className="home-arrivals" aria-labelledby="home-arrivals-heading">
      <div className="home-arrivals-copy"><span className="eyebrow">{content.arrivalsLabel}</span><h2 id="home-arrivals-heading">{content.arrivalsLead}<br /><em>{content.arrivalsEmphasis}</em></h2><p>{content.arrivalsBody}</p><Link href="/men" className="line-link">{`${content.arrivalsLinkLabel} `}<ArrowUpRight size={16} /></Link></div>
      <div className="home-arrivals-images">
        {pieces.map((image: ImageValue) => <div key={image.url}><ContentImage image={image} fill sizes="(max-width: 767px) 50vw, 32vw" /></div>)}
      </div>
    </section>

    <section className="editorial-callout" aria-labelledby="edit-heading">
      <div className="editorial-photo"><ContentImage image={content.calloutImage} fill sizes="(max-width: 767px) 100vw, 55vw" /></div>
      <div className="editorial-copy" data-reveal><span className="eyebrow">{content.calloutLabel}</span><h2 id="edit-heading">{content.calloutLead}<br /><em>{content.calloutEmphasis}</em></h2><p>{content.calloutBody}</p><Link href="/the-edit" className="line-link">{`${content.calloutLinkLabel} `}<ArrowUpRight size={16} /></Link></div>
    </section>

    <section className="closing-statement section-pad"><span>{content.closingLabel}</span><h2>{content.closingHeading}</h2><Link href="/new-in" className="outline-button">{`${content.closingButton} `}<ArrowUpRight size={17} /></Link></section>
    </div>
  </div>;
}
