import type { Metadata } from "next";
import { CollectionPage } from "@/components/storefront/collection-page";

export const metadata: Metadata = { title: "New Clothes", description: "Our newest clothes." };
export default function NewInPage() { return <CollectionPage title="New Clothes" eyebrow="VEGORA / NEW" description="Our newest clothes." tag="new_arrival" />; }
