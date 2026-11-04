"use client";

import { Heart } from "lucide-react";
import { toggleWishlist, useWishlist } from "./wishlist-store";

/** The heart on a product card (`variant="card"`) or the product page (`variant="detail"`). */
export function WishlistButton({ slug, name, variant }: { slug: string; name: string; variant: "card" | "detail" }) {
  const saved = useWishlist().includes(slug);
  return <button type="button" className={`wishlist-button wishlist-button-${variant}`} aria-pressed={saved}
    aria-label={saved ? `Remove ${name} from your wishlist` : `Save ${name} to your wishlist`}
    onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleWishlist(slug); }}>
    <Heart size={18} strokeWidth={1.5} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
    {variant === "detail" && <span>{saved ? "Saved to wishlist" : "Save to wishlist"}</span>}
  </button>;
}
