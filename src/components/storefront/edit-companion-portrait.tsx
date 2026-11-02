"use client";

import Image from "next/image";
import { useWomenAvailable } from "./collection-availability";

export function EditCompanionPortrait() {
  const womenAvailable = useWomenAvailable();
  return <div><Image
    src={womenAvailable ? "/editorial/ve-woman-light.png" : "/editorial/ve-navy-model-v1.webp"}
    alt={womenAvailable ? "Woman in a white tailored jacket" : "Man wearing the navy and ivory striped VEGORA T-shirt"}
    fill sizes="(max-width: 767px) 100vw, 50vw"
  /></div>;
}
