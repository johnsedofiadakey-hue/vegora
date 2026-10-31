import { imageUrl } from "./image-delivery.ts";

// Used by next/image for every photograph (see images in next.config.ts).
export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  return imageUrl(src, width, quality);
}
