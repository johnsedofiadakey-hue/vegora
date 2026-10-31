import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Wordmark } from "./wordmark";
import { WomenOnly } from "./collection-availability";
import { getContent } from "@/lib/server/site-content-cache";

export async function SiteFooter() {
  const contact = await getContent("contact");
  return <footer className="site-footer">
    <div className="footer-top">
      <div>
        <Wordmark inverse className="footer-wordmark" />
        <p>{contact.footerTagline}</p>
      </div>
      <div className="footer-links">
        <div><span>Explore</span><WomenOnly><Link href="/women">Women</Link></WomenOnly><Link href="/men">Men</Link><Link href="/new-in">New In</Link><Link href="/the-edit">The Edit</Link></div>
        <div><span>VEGORA</span><Link href="/about">Our Story</Link><Link href="/bag">Shopping Bag</Link><Link href="/track">Track order</Link></div>
      </div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} VEGORA</span><span>Elevate Your Style</span><Link className="footer-admin-link" href="/admin">Admin portal <ArrowUpRight size={13} aria-hidden="true" /></Link></div>
  </footer>;
}
