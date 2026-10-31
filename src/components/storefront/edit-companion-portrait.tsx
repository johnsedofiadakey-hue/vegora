"use client";

import Image from "next/image";
import { useWomenAvailable } from "./collection-availability";

export function EditCompanionPortrait() {
  const womenAvailable = useWomenAvailable();
  return <div><Image
    src={womenAvailable ? "/editorial/ve-woman-light.png" : "/editorial/ve-man.png"}
    alt={womenAvailable ? "Woman in a white tailored jacket" : "Man in black tailoring"}
    fill sizes="(max-width: 767px) 100vw, 50vw"
  /></div>;
}
