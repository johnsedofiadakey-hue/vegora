import { notFound } from "next/navigation";
import { paragraphs, policyIsLive } from "@/lib/site-content";
import { getContent } from "@/lib/server/site-content-cache";

// Delivery and returns text is written by the owner in the admin. Until there
// is text, the page does not exist, so nobody lands on an empty promise.
export async function PolicyPage({ block }: { block: "delivery" | "returns" }) {
  const content = await getContent(block);
  if (!policyIsLive(content)) notFound();
  return <div className="policy-page">
    <span className="eyebrow">VEGORA / THE DETAILS</span>
    <h1>{content.title}</h1>
    {paragraphs(content.body).map((text) => <p key={text}>{text}</p>)}
  </div>;
}
