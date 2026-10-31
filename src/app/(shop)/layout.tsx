import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { SiteHeader } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";
import { CollectionAvailabilityProvider } from "@/components/storefront/collection-availability";

// Storefront text is editable in the admin, so these pages render per request
// instead of being frozen at build time. See site-content-cache.ts.
export const dynamic = "force-dynamic";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <CollectionAvailabilityProvider><AnnouncementBar /><SiteHeader /><main id="main-content">{children}</main><SiteFooter /></CollectionAvailabilityProvider>;
}
