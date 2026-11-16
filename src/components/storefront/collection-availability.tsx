"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const WomenAvailability = createContext(false);

// Whether to show the women's collection is asked once when the site opens, and again only when the
// visitor comes back to the tab after a while. It used to be asked on every page change, which cost a
// database read each time for an answer that almost never changes.
const askAgainAfterMs = 5 * 60_000;
let lastAnswer: { at: number; women: boolean } | null = null;

export function CollectionAvailabilityProvider({ children }: { children: ReactNode }) {
  const [women, setWomen] = useState(() => lastAnswer?.women ?? false);

  useEffect(() => {
    let controller: AbortController | null = null;
    function refresh(force: boolean) {
      if (!force && lastAnswer && Date.now() - lastAnswer.at < askAgainAfterMs) { setWomen(lastAnswer.women); return; }
      controller?.abort();
      controller = new AbortController();
      fetch("/api/storefront/availability", { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return { women: false };
          return response.json() as Promise<{ women?: boolean }>;
        })
        .then((result) => { lastAnswer = { at: Date.now(), women: result.women === true }; setWomen(lastAnswer.women); })
        .catch((error: unknown) => { if ((error as Error).name !== "AbortError") setWomen(false); });
    }
    refresh(false);
    const onFocus = () => refresh(false);
    window.addEventListener("focus", onFocus);
    return () => { controller?.abort(); window.removeEventListener("focus", onFocus); };
  }, []);

  return <WomenAvailability.Provider value={women}>{children}</WomenAvailability.Provider>;
}

export function useWomenAvailable() {
  return useContext(WomenAvailability);
}

export function WomenOnly({ children }: { children: ReactNode }) {
  return useWomenAvailable() ? children : null;
}
