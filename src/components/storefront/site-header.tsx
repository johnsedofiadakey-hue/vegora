"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Wordmark } from "./wordmark";

const nav = [
  { href: "/women", label: "Women" },
  { href: "/men", label: "Men" },
  { href: "/new-in", label: "New In" },
  { href: "/the-edit", label: "The Edit" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
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
            {nav.map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}
          </nav>
          <div className="header-actions">
            <button className="icon-button" type="button" aria-label={searchOpen ? "Close search" : "Search"} aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><Search size={22} strokeWidth={1.35} /></button>
            <Link className="icon-button" href="/bag" aria-label="Shopping bag"><ShoppingBag size={22} strokeWidth={1.35} /></Link>
          </div>
        </div>
        {searchOpen && <form className="search-panel" role="search" onSubmit={search}>
          <label htmlFor="site-search">Search the collection</label>
          <input id="site-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by piece or category" />
          <button type="submit">Search</button>
        </form>}
      </header>
      {menuOpen && <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</Link>)}
        <Link href="/about" onClick={() => setMenuOpen(false)}>About VEGORA</Link>
      </nav>}
    </>
  );
}
