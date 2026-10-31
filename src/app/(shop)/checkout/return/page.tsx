import type { Metadata } from "next";
import { CheckoutReturnPage } from "@/components/storefront/checkout-return-page";

export const metadata: Metadata = { title: "Order Status", robots: { index: false, follow: false } };
export default function Page() { return <CheckoutReturnPage />; }
