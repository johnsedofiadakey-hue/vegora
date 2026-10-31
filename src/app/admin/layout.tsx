import type { Metadata } from "next";

// The studio admin is private. robots.txt also keeps crawlers out of it.
export const metadata: Metadata = { title: "Studio admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
