import type { Metadata } from "next";
import { TrackOrderPage } from "@/components/storefront/track-order-page";

export const metadata: Metadata = { title: "Track your order", robots: { index: false, follow: false } };

export default function Page() {
  return <TrackOrderPage />;
}
