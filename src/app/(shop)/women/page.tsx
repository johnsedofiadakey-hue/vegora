import type { Metadata } from "next";
import { CollectionPage } from "@/components/storefront/collection-page";

export const metadata: Metadata = { title: "Women" };
export default function WomenPage() { return <CollectionPage audience="women" title="Women" eyebrow="VEGORA / WOMEN" description="A distinct expression of personal style." />; }
