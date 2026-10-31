import type { Metadata } from "next";
import { PolicyPage } from "@/components/storefront/policy-page";

export const metadata: Metadata = { title: "Returns and exchanges" };

export default function Page() { return <PolicyPage block="returns" />; }
