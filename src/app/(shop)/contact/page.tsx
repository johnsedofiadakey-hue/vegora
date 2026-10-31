import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contactChannels, contactHref, paragraphs } from "@/lib/site-content";
import { getContent } from "@/lib/server/site-content-cache";

export const metadata: Metadata = { title: "Contact" };

const channelLabel = { email: "Email", phone: "Phone", whatsapp: "WhatsApp", instagram: "Instagram" } as const;

export default async function ContactPage() {
  const content = await getContent("contact");
  const channels = contactChannels(content);
  if (channels.length === 0) notFound();
  return <div className="policy-page">
    <span className="eyebrow">VEGORA / CONTACT</span>
    <h1>Get in touch.</h1>
    {paragraphs(content.intro).map((text) => <p key={text}>{text}</p>)}
    <div className="policy-contact">{channels.map(({ kind, value }) =>
      <a key={kind} href={contactHref(kind, value)} {...(kind === "whatsapp" || kind === "instagram" ? { target: "_blank", rel: "noreferrer" } : {})}>
        <span>{channelLabel[kind]}</span>{kind === "instagram" ? `@${value}` : value}
      </a>)}</div>
    {content.hours && <p className="policy-hours">{content.hours}</p>}
  </div>;
}
