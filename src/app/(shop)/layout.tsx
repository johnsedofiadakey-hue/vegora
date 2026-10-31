import { SiteHeader } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";
import { CollectionAvailabilityProvider } from "@/components/storefront/collection-availability";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <CollectionAvailabilityProvider><SiteHeader /><main id="main-content">{children}</main><SiteFooter /></CollectionAvailabilityProvider>;
}
