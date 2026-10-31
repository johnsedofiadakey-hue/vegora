import type { Metadata } from "next";
import "./globals.css";
import { indexingAllowed, shareImageUrl, siteOrigin } from "@/lib/seo";

const title = "VEGORA | The Art of Dressing";
const description = "Explore VEGORA's considered point of view on dressing for women and men.";

// Evaluated per request so the site address and the launch switch come from the
// running service rather than being fixed at build time.
export async function generateMetadata(): Promise<Metadata> {
  const origin = siteOrigin();
  const image = shareImageUrl(origin, "/editorial/ve-man-coat.png");
  return {
    metadataBase: new URL(origin),
    title: { default: title, template: "%s | VEGORA" },
    description,
    alternates: { canonical: "./" },
    robots: indexingAllowed() ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: "website", siteName: "VEGORA", locale: "en_GH", title, description, images: [{ url: image, alt: "VEGORA editorial portrait of a man in a black overcoat" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
