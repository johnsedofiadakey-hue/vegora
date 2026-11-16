import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The cart used to be called the bag. Old links and bookmarks still work.
  async redirects() { return [{ source: "/bag", destination: "/cart", permanent: true }]; },
  // The storefront pages look the same for every visitor, so the CDN in front of the site may keep a copy
  // for a minute. Most visits are then answered at the edge: faster for the customer, and no page build
  // or database read for the shop. The admin, the API, the build's own files, and the order pages (which carry an order number in the address) are left out. The
  // browser itself is told not to keep the page (max-age=0), so a customer who reloads gets the CDN's copy.
  async headers() {
    return [{
      source: "/((?!admin|api|_next|track|checkout).*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=0, s-maxage=60" }],
    }];
  },
  turbopack: { root: process.cwd() },
  // App Hosting does not serve the built-in /_next/image optimizer, so photographs
  // are resized by our own route instead. See src/lib/image-delivery.ts.
  images: { loader: "custom", loaderFile: "./src/lib/image-loader.ts" },
};

export default nextConfig;
