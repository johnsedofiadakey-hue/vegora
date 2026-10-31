import type { Metadata } from "next";
import { PolicyPage } from "@/components/storefront/policy-page";

export const metadata: Metadata = { title: "Terms of sale" };

export default function Page() { return <PolicyPage block="terms" />; }
