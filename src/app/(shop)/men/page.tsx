import type { Metadata } from "next";
import { CollectionPage } from "@/components/storefront/collection-page";

export const metadata: Metadata = { title: "Men", description: "Men's clothes from VEGORA." };
export default function MenPage() { return <CollectionPage audience="men" title="Men" eyebrow="VEGORA / MEN" description="Clothes for men. Easy to wear, easy to style." />; }
