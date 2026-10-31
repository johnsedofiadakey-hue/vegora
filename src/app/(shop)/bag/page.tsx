import type { Metadata } from "next";
import { BagPage } from "@/components/storefront/bag-page";

export const metadata: Metadata = { title: "Shopping Bag", robots: { index: false, follow: false } };
export default function Page() { return <BagPage />; }
