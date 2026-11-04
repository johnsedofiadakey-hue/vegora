import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { paragraphs } from "@/lib/site-content";
import { getContent } from "@/lib/server/site-content-cache";

export const metadata: Metadata = { title: "About Us", description: "VEGORA is an online fashion store in Ghana: stylish, modern clothing that helps you express your personality with confidence." };

export default async function AboutPage() {
  const content = await getContent("about");
  const sections = [
    { heading: content.missionHeading, body: content.missionBody },
    { heading: content.whyHeading, body: content.whyBody },
    { heading: content.closingHeading, body: content.closingBody },
  ];
  return <div className="about-page">
    <span className="eyebrow">{content.label}</span>
    <h1>{content.headingLead}<br /><em>{content.headingEmphasis}</em></h1>
    {paragraphs(content.body).map((text) => <p key={text}>{text}</p>)}
    {sections.map(({ heading, body }) => <section key={heading}>
      <h2>{heading}</h2>
      {paragraphs(body).map((text) => <p key={text}>{text}</p>)}
    </section>)}
    <p className="about-signature">{content.signature}</p>
    <Link href="/men" className="line-link">{`${content.linkLabel} `}<ArrowUpRight size={16} /></Link>
  </div>;
}
