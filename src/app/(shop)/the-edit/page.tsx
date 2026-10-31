import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { WomenOnly } from "@/components/storefront/collection-availability";
import { EditCompanionPortrait } from "@/components/storefront/edit-companion-portrait";

export const metadata: Metadata = { title: "The Edit" };

export default function TheEditPage() {
  return <div className="editorial-page">
    <header className="page-lead"><span className="eyebrow">VEGORA / THE EDIT</span><h1>The art of<br /><em>dressing.</em></h1><p>A visual expression of presence, individuality, and considered style.</p></header>
    <div className="edit-images"><EditCompanionPortrait /><div><Image src="/editorial/ve-man-coat.png" alt="Man in a black overcoat" fill sizes="(max-width: 767px) 100vw, 50vw" /></div></div>
    <section className="edit-copy"><span>AN EXPRESSION OF YOU</span><h2>Wear what feels<br /><em>like you.</em></h2><p>VEGORA is a space for personal style. Explore the collection as it comes to life.</p><div><Link className="line-link" href="/men">Explore men <ArrowUpRight size={16} /></Link><WomenOnly><Link className="line-link" href="/women">Explore women <ArrowUpRight size={16} /></Link></WomenOnly></div></section>
  </div>;
}
