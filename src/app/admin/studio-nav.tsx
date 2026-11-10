"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight, ChartNoAxesColumn, FileText, LogOut, Mail, Menu, Package, ShoppingBag, Ticket, X } from "lucide-react";
import styles from "./studio.module.css";

export type StudioView = "insights" | "products" | "orders" | "content" | "signups" | "vouchers";

const items: { view: StudioView; label: string; icon: typeof Package }[] = [
  { view: "insights", label: "Insights", icon: ChartNoAxesColumn },
  { view: "products", label: "Products", icon: Package },
  { view: "orders", label: "Orders", icon: ShoppingBag },
  { view: "content", label: "Website text", icon: FileText },
  { view: "signups", label: "Sign-ups", icon: Mail },
  { view: "vouchers", label: "Vouchers", icon: Ticket },
];

// Sidebar on desktop; on phones a top bar whose menu button slides the same list in.
export function StudioNav({ view, onSelect, open, onOpenChange, ordersToHandle, email, onSignOut }: {
  view: StudioView;
  onSelect: (view: StudioView) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordersToHandle: number;
  email: string;
  onSignOut: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onOpenChange]);

  const current = items.find((item) => item.view === view);
  return <>
    <header className={styles.topBar}>
      <button type="button" className={styles.menuButton} aria-label="Open menu" aria-expanded={open} aria-controls="studio-menu" onClick={() => onOpenChange(true)}><Menu size={22} /></button>
      <span className={styles.topWordmark}>VEGORA</span>
      <span className={styles.topSection}>{current?.label}</span>
    </header>
    <div className={`${styles.scrim} ${open ? styles.scrimOpen : ""}`} onClick={() => onOpenChange(false)} aria-hidden="true" />
    <aside id="studio-menu" className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`} aria-label="Admin menu">
      <div className={styles.brand}>
        <Link href="/" className={styles.wordmark}>VEGORA</Link>
        <span>Studio</span>
        <button type="button" className={styles.closeButton} aria-label="Close menu" onClick={() => onOpenChange(false)}><X size={20} /></button>
      </div>
      <nav className={styles.navList} aria-label="Admin sections">
        {items.map(({ view: target, label, icon: Icon }) => <button type="button" key={target}
          className={view === target ? styles.navActive : ""} aria-current={view === target ? "page" : undefined}
          onClick={() => { onSelect(target); onOpenChange(false); }}>
          <Icon size={18} aria-hidden="true" /><span>{label}</span>
          {target === "orders" && ordersToHandle > 0 && <em aria-label={`${ordersToHandle} to deliver`}>{ordersToHandle}</em>}
        </button>)}
      </nav>
      <div className={styles.navFoot}>
        <Link href="/" target="_blank"><ArrowUpRight size={16} aria-hidden="true" />View the shop</Link>
        <button type="button" onClick={onSignOut}><LogOut size={16} aria-hidden="true" />Sign out</button>
        <small>{email}</small>
      </div>
    </aside>
  </>;
}
