"use client";

import Script from "next/script";
import { gaConfigured, gaMeasurementId, gaQueueName } from "@/lib/google-analytics";

// Google's standard gtag setup, then the events trackGoogle held back while it
// had not run yet. The first page_view comes from `config`; later in-app page
// changes are recorded by GA4's enhanced measurement (browser history events),
// so no page_view is sent here by hand and none is counted twice.
const setup = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${gaMeasurementId}');(window.${gaQueueName}||[]).splice(0).forEach(function(a){gtag.apply(null,a)});`;

/** Loads Google Analytics on shop pages only (never the admin). */
export function GoogleAnalytics() {
  if (!gaConfigured) return null;
  return <>
    <Script id="google-analytics" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: setup }} />
    <Script id="google-analytics-tag" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} />
  </>;
}
