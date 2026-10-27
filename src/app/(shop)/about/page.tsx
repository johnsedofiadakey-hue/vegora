import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return <div className="about-page">
    <span className="eyebrow">THE HOUSE / VEGORA</span>
    <h1>Style is<br /><em>personal.</em></h1>
    <p>VEGORA is a new destination for women’s and men’s fashion. Our visual world is built on contrast, clarity, and the confidence of individual expression.</p>
    <p>As the collection takes shape, this space will introduce the pieces, people, and ideas behind the brand.</p>
    <Link href="/the-edit" className="line-link">Discover the edit <ArrowUpRight size={16} /></Link>
  </div>;
}
