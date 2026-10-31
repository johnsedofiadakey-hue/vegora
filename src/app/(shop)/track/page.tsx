import type { Metadata } from "next";
import { TrackOrderPage } from "@/components/storefront/track-order-page";

export const metadata: Metadata = { title: "Track your order" };

export default function Page() {
  return <TrackOrderPage />;
}
