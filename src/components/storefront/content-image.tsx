import Image from "next/image";
import type { ComponentProps } from "react";
import type { ImageValue } from "@/lib/site-content";

type Props = Omit<ComponentProps<typeof Image>, "src" | "alt"> & { image: ImageValue };

// Photographs the owner uploads are served by the media route, which the image
// optimizer is not used for (product photos work the same way). The approved
// site photographs keep going through the optimizer.
export function ContentImage({ image, ...props }: Props) {
  return <Image src={image.url} alt={image.alt} unoptimized={image.url.startsWith("/api/media/") || undefined} {...props} />;
}
