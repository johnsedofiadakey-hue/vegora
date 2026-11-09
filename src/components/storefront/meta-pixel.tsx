"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { pixelId, pixelQueueName } from "@/lib/meta-pixel";

const validId = /^[0-9]{10,20}$/.test(pixelId);

// Meta's standard base code. It defines window.fbq and loads fbevents.js.
const baseCode = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');`;

// Sends the events trackPixel held back while this script had not run yet.
const flushQueue = `(window.${pixelQueueName}||[]).splice(0).forEach(function(a){fbq.apply(null,a)});`;

/**
 * Loads the Meta Pixel on shop pages (never the admin) and records a PageView
 * for the first page and for every page the visitor moves to afterwards.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!validId || lastPath.current === pathname) return;
    lastPath.current = pathname;
    const fbq = (window as unknown as { fbq?: (command: string, event: string) => void }).fbq;
    fbq?.("track", "PageView");
  }, [pathname]);

  if (!validId) return null;
  return <>
    <Script id="meta-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `${baseCode}fbq('track','PageView');${flushQueue}` }} />
    {/* Meta's no-JavaScript fallback: a tracking pixel, not a photograph. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <noscript><img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`} /></noscript>
  </>;
}
