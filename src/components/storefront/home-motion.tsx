"use client";

import { useEffect } from "react";

export default function HomeMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".home-page");
    if (!root) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches || !window.IntersectionObserver) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -30px 0px" });

    items.forEach((item) => observer.observe(item));
    root.classList.add("motion-ready");

    return () => {
      observer.disconnect();
      root.classList.remove("motion-ready");
    };
  }, []);

  return null;
}
