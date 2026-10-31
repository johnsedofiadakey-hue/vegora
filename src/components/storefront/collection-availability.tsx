"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const WomenAvailability = createContext(false);

export function CollectionAvailabilityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [women, setWomen] = useState(false);

  useEffect(() => {
    let controller: AbortController | null = null;
    function refresh() {
      controller?.abort();
      controller = new AbortController();
      fetch("/api/storefront/availability", { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return { women: false };
          return response.json() as Promise<{ women?: boolean }>;
        })
        .then((result) => setWomen(result.women === true))
        .catch((error: unknown) => { if ((error as Error).name !== "AbortError") setWomen(false); });
    }
    refresh();
    window.addEventListener("focus", refresh);
    return () => { controller?.abort(); window.removeEventListener("focus", refresh); };
  }, [pathname]);

  return <WomenAvailability.Provider value={women}>{children}</WomenAvailability.Provider>;
}

export function useWomenAvailable() {
  return useContext(WomenAvailability);
}

export function WomenOnly({ children }: { children: ReactNode }) {
  return useWomenAvailable() ? children : null;
}
