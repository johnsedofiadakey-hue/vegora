import Link from "next/link";
import { Wordmark } from "./wordmark";
import { FooterSignup } from "./footer-signup";
import { PaymentMethods } from "./payment-methods";
import { WomenOnly } from "./collection-availability";
import { getContent } from "@/lib/server/site-content-cache";
import { contactChannels, policyIsLive, socialLinks } from "@/lib/site-content";

const socialName = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", x: "X" } as const;

export async function SiteFooter() {
  const [contact, delivery, returns, privacy, terms] = await Promise.all([getContent("contact"), getContent("delivery"), getContent("returns"), getContent("privacy"), getContent("terms")]);
  const hasContact = contactChannels(contact).length > 0;
  const social = socialLinks(contact);
  return <footer className="site-footer">
    <div className="footer-top">
      <div>
        <Wordmark inverse className="footer-wordmark" />
        <p>{contact.footerTagline}</p>
        <FooterSignup privacyHref={policyIsLive(privacy) ? "/privacy" : null} />
      </div>
      <div className="footer-links">
        <div><span>Shop</span><WomenOnly><Link href="/women">Women</Link></WomenOnly><Link href="/men">Men</Link><Link href="/new-in">New Clothes</Link><Link href="/the-edit">Our Style</Link></div>
        <div><span>VEGORA</span><Link href="/about">About Us</Link><Link href="/cart">Your Cart</Link><Link href="/track">Track order</Link>{policyIsLive(delivery) && <Link href="/delivery">{delivery.title}</Link>}{policyIsLive(returns) && <Link href="/returns">{returns.title}</Link>}{hasContact && <Link href="/contact">Contact</Link>}{policyIsLive(privacy) && <Link href="/privacy">{privacy.title}</Link>}{policyIsLive(terms) && <Link href="/terms">{terms.title}</Link>}</div>
        {social.length > 0 && <div><span>Follow</span>{social.map(({ platform, href }) => <a key={platform} href={href} target="_blank" rel="noreferrer">{socialName[platform]}</a>)}</div>}
      </div>
    </div>
    <PaymentMethods />
    <div className="footer-bottom"><span>© {new Date().getFullYear()} VEGORA</span><span>Elevate Your Style</span></div>
  </footer>;
}
