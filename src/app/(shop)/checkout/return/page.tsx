import type { Metadata } from "next";
import { CheckoutReturnPage } from "@/components/storefront/checkout-return-page";

export const metadata: Metadata = { title: "Order Status" };
export default function Page() { return <CheckoutReturnPage />; }
