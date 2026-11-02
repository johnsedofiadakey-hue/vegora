"use client";

import Image from "next/image";
import { useWomenAvailable } from "./collection-availability";

export function HeroCompanionPortrait() {
  const womenAvailable = useWomenAvailable();
  return <div className="hero-woman">
    <Image
      src={womenAvailable ? "/editorial/ve-woman.png" : "/editorial/ve-ivory-model-v1.webp"}
      alt={womenAvailable ? "VEGORA editorial portrait of a woman in black tailoring" : "Man wearing the ivory and black striped VEGORA T-shirt"}
      fill priority loading="eager" sizes="(max-width: 767px) 50vw, 43vw"
    />
  </div>;
}
