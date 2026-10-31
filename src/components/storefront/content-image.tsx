import Image from "next/image";
import type { ComponentProps } from "react";
import type { ImageValue } from "@/lib/site-content";

type Props = Omit<ComponentProps<typeof Image>, "src" | "alt"> & { image: ImageValue };

// Uploaded and approved photographs both go through the image optimizer, which
// resizes them for the visitor's screen: a 4 MB upload reaches a phone as a
// file of well under 100 KB.
export function ContentImage({ image, ...props }: Props) {
  return <Image src={image.url} alt={image.alt} {...props} />;
}
