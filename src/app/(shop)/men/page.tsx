import type { Metadata } from "next";
import { CollectionPage } from "@/components/storefront/collection-page";

export const metadata: Metadata = { title: "Men", description: "Menswear from VEGORA: considered pieces for the way you choose to show up." };
export default function MenPage() { return <CollectionPage audience="men" title="Men" eyebrow="VEGORA / MEN" description="Style for the way you choose to show up." />; }
