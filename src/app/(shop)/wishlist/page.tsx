import type { Metadata } from "next";
import { WishlistPage } from "@/components/storefront/wishlist-page";

export const metadata: Metadata = { title: "Your wishlist", robots: { index: false, follow: false } };
export default function Page() { return <WishlistPage />; }
