import type { Metadata } from "next";
import { CollectionPage } from "@/components/storefront/collection-page";

export const metadata: Metadata = { title: "New In" };
export default function NewInPage() { return <CollectionPage title="New In" eyebrow="VEGORA / NEW IN" description="The latest additions to the VEGORA collection." />; }
