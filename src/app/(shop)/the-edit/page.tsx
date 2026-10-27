import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = { title: "The Edit" };

export default function TheEditPage() {
  return <div className="editorial-page">
    <header className="page-lead"><span className="eyebrow">VEGORA / THE EDIT</span><h1>The art of<br /><em>dressing.</em></h1><p>A visual expression of presence, individuality, and considered style.</p></header>
    <div className="edit-images"><div><Image src="/editorial/ve-woman-light.png" alt="Woman in a white tailored jacket" fill sizes="(max-width: 767px) 100vw, 50vw" /></div><div><Image src="/editorial/ve-man-coat.png" alt="Man in a black overcoat" fill sizes="(max-width: 767px) 100vw, 50vw" /></div></div>
    <section className="edit-copy"><span>AN EXPRESSION OF YOU</span><h2>Wear what feels<br /><em>like you.</em></h2><p>VEGORA is a space for personal style. Explore the women’s and men’s collections as they come to life.</p><div><Link className="line-link" href="/women">Explore women <ArrowUpRight size={16} /></Link><Link className="line-link" href="/men">Explore men <ArrowUpRight size={16} /></Link></div></section>
  </div>;
}
