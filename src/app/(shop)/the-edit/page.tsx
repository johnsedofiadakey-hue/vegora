import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { WomenOnly } from "@/components/storefront/collection-availability";
import { ContentImage } from "@/components/storefront/content-image";
import { EditCompanionPortrait } from "@/components/storefront/edit-companion-portrait";
import { getContent } from "@/lib/server/site-content-cache";

export const metadata: Metadata = { title: "Our Style", description: "Photos of VEGORA clothes and how to wear them." };

export default async function TheEditPage() {
  const content = await getContent("edit");
  return <div className="editorial-page">
    <header className="page-lead"><span className="eyebrow">{content.pageLabel}</span><h1>{content.leadLine1}<br /><em>{content.leadEmphasis}</em></h1><p>{content.leadBody}</p></header>
    <div className="edit-images"><EditCompanionPortrait /><div><ContentImage image={content.image} fill sizes="(max-width: 767px) 100vw, 50vw" /></div></div>
    <section className="edit-copy"><span>{content.copyLabel}</span><h2>{content.copyLead}<br /><em>{content.copyEmphasis}</em></h2><p>{content.copyBody}</p><div><Link className="line-link" href="/men">Shop men <ArrowUpRight size={16} /></Link><WomenOnly><Link className="line-link" href="/women">Shop women <ArrowUpRight size={16} /></Link></WomenOnly></div></section>
  </div>;
}
