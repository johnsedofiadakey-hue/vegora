import type { MetadataRoute } from "next";
import { indexingAllowed, siteOrigin } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Closed to search engines until VEGORA_ALLOW_INDEXING=true is set at launch.
export default function robots(): MetadataRoute.Robots {
  if (!indexingAllowed()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    // /api/image stays open: it serves the photographs that search and share previews show.
    rules: [{ userAgent: "*", allow: ["/", "/api/image"], disallow: ["/admin", "/api/", "/checkout", "/bag", "/track", "/search"] }],
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
