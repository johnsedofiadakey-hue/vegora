import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The cart used to be called the bag. Old links and bookmarks still work.
  async redirects() { return [{ source: "/bag", destination: "/cart", permanent: true }]; },
  turbopack: { root: process.cwd() },
  // App Hosting does not serve the built-in /_next/image optimizer, so photographs
  // are resized by our own route instead. See src/lib/image-delivery.ts.
  images: { loader: "custom", loaderFile: "./src/lib/image-loader.ts" },
};

export default nextConfig;
