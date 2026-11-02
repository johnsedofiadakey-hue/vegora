"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, ShoppingCart, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Wordmark } from "./wordmark";
import { useWomenAvailable } from "./collection-availability";
import { readBag } from "./bag-store";

const nav = [
  { href: "/women", label: "Women" },
  { href: "/men", label: "Men" },
  { href: "/new-in", label: "New Clothes" },
  { href: "/the-edit", label: "Our Style" },
];

export function SiteHeader() {
  const womenAvailable = useWomenAvailable();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bagCount, setBagCount] = useState(0);

  useEffect(() => {
    const update = () => setBagCount(readBag().reduce((total, item) => total + item.quantity, 0));
    const timer = window.setTimeout(update, 0);
    window.addEventListener("vegora-bag-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("vegora-bag-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (term) { setSearchOpen(false); router.push(`/search?q=${encodeURIComponent(term)}`); }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <div className="header-inner">
          <button className="icon-button mobile-menu-button" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} strokeWidth={1.4} /> : <Menu size={24} strokeWidth={1.4} />}
          </button>
          <Wordmark className="header-wordmark" />
          <nav className="desktop-nav" aria-label="Main navigation">
            {nav.filter((item) => item.href !== "/women" || womenAvailable).map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}
          </nav>
          <div className="header-actions">
            <button className="icon-button" type="button" aria-label={searchOpen ? "Close search" : "Search"} aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><Search size={22} strokeWidth={1.35} /></button>
            <Link className="icon-button bag-link" href="/cart" aria-label={bagCount > 0 ? `Your cart, ${bagCount} ${bagCount === 1 ? "item" : "items"}` : "Your cart"}><ShoppingCart size={22} strokeWidth={1.35} />{bagCount > 0 && <span className="bag-count" aria-hidden="true">{bagCount}</span>}</Link>
          </div>
        </div>
        {searchOpen && <form className="search-panel" role="search" onSubmit={search}>
          <label htmlFor="site-search">Search the clothes</label>
          <input id="site-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or type" />
          <button type="submit">Search</button>
        </form>}
      </header>
      {menuOpen && <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.filter((item) => item.href !== "/women" || womenAvailable).map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</Link>)}
        <Link href="/about" onClick={() => setMenuOpen(false)}>About VEGORA</Link>
      </nav>}
    </>
  );
}
