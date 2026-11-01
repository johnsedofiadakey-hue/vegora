import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import HomeMotion from "@/components/storefront/home-motion";
import { CatalogCollection } from "@/components/storefront/catalog-collection";
import { ContentImage } from "@/components/storefront/content-image";
import { WomenOnly } from "@/components/storefront/collection-availability";
import { HeroCompanionPortrait } from "@/components/storefront/hero-companion-portrait";
import { jsonLd, organizationJsonLd, siteOrigin } from "@/lib/seo";
import { getContent } from "@/lib/server/site-content-cache";
import { socialLinks } from "@/lib/site-content";

// The home page is the opening screen, a short introduction, and the new
// arrivals, then the footer. The pieces come from the catalogue (anything
// tagged New arrival), so there is nothing here to keep up to date by hand.
export default async function HomePage() {
  const [content, contact] = await Promise.all([getContent("home"), getContent("contact")]);
  return <div className="home-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organizationJsonLd(siteOrigin(), socialLinks(contact).map((link) => link.href))) }} />
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

    <section className="home-new-arrivals section-pad" aria-labelledby="home-arrivals-heading">
      <div className="home-new-arrivals-head">
        <div><span className="eyebrow">{content.arrivalsLabel}</span><h2 id="home-arrivals-heading" data-reveal>{content.arrivalsLead} <em>{content.arrivalsEmphasis}</em></h2></div>
        <Link href="/new-in" className="line-link">{`${content.arrivalsLinkLabel} `}<ArrowUpRight size={16} /></Link>
      </div>
      <CatalogCollection tag="new_arrival" limit={8} compact />
    </section>
    </div>
  </div>;
}
