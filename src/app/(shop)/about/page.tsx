import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { paragraphs } from "@/lib/site-content";
import { getContent } from "@/lib/server/site-content-cache";

export const metadata: Metadata = { title: "About", description: "VEGORA is a clothing brand. Read about us." };

export default async function AboutPage() {
  const content = await getContent("about");
  return <div className="about-page">
    <span className="eyebrow">{content.label}</span>
    <h1>{content.headingLead}<br /><em>{content.headingEmphasis}</em></h1>
    {paragraphs(content.body).map((text) => <p key={text}>{text}</p>)}
    <Link href="/the-edit" className="line-link">{`${content.linkLabel} `}<ArrowUpRight size={16} /></Link>
  </div>;
}
