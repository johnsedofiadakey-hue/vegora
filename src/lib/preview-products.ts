import type { Audience, ProductImage } from "./catalog";

export type PreviewProduct = {
  slug: string;
  name: string;
  description: string;
  audience: Audience;
  category: string;
  images: ProductImage[];
};

// Client-supplied photographs. Names are descriptive placeholders; the admin
// can replace them after import. Price is a clearly labelled test amount.
export const previewPriceMinor = 10_000;

export const previewProducts: PreviewProduct[] = [
  {
    slug: "navy-wide-stripe-tee",
    name: "Navy Wide Stripe T-Shirt",
    description: "A navy and white striped T-shirt, shown from the front and back.",
    audience: "men",
    category: "T-Shirts",
    images: [
      { url: "/catalog/navy-stripe-front.webp", alt: "Front view of a navy and white striped T-shirt on a black mannequin" },
      { url: "/catalog/navy-stripe-back.webp", alt: "Back view of the navy and white striped T-shirt on a black mannequin" },
    ],
  },
  {
    slug: "olive-distressed-stripe-tee",
    name: "Olive Distressed Stripe T-Shirt",
    description: "An olive and light stone striped T-shirt with a distressed visual finish.",
    audience: "men",
    category: "T-Shirts",
    images: [{ url: "/catalog/olive-distressed-stripe.webp", alt: "Olive and light stone striped T-shirt on a black mannequin" }],
  },
  {
    slug: "ivory-fine-stripe-tee",
    name: "Ivory Fine Stripe T-Shirt",
    description: "An ivory T-shirt with fine dark horizontal stripes and a small chest label.",
    audience: "men",
    category: "T-Shirts",
    images: [{ url: "/catalog/ivory-fine-stripe.webp", alt: "Ivory T-shirt with fine dark stripes on a black mannequin" }],
  },
  {
    slug: "black-fine-stripe-tee",
    name: "Black Fine Stripe T-Shirt",
    description: "A black T-shirt with fine light horizontal stripes.",
    audience: "men",
    category: "T-Shirts",
    images: [{ url: "/catalog/black-fine-stripe.webp", alt: "Black T-shirt with fine light stripes on a black mannequin" }],
  },
  {
    slug: "grey-stripe-tee",
    name: "Grey Stripe T-Shirt",
    description: "A light T-shirt with medium grey horizontal stripes and a small chest label.",
    audience: "men",
    category: "T-Shirts",
    images: [{ url: "/catalog/grey-stripe.webp", alt: "Light T-shirt with medium grey stripes on a black mannequin" }],
  },
  {
    slug: "ivory-black-stripe-tee",
    name: "Ivory and Black Stripe T-Shirt",
    description: "An ivory T-shirt with black horizontal stripes, a dark collar and a small hem label.",
    audience: "men",
    category: "T-Shirts",
    images: [{ url: "/catalog/ivory-black-stripe.webp", alt: "Ivory and black striped T-shirt on a black mannequin" }],
  },
  {
    slug: "red-stripe-tee",
    name: "Red Stripe T-Shirt",
    description: "A red T-shirt with narrow light horizontal stripes.",
    audience: "men",
    category: "T-Shirts",
    images: [{ url: "/catalog/red-stripe.webp", alt: "Red striped T-shirt on a black mannequin" }],
  },
];

export function findPreviewProduct(slug: string): PreviewProduct | undefined {
  return previewProducts.find((product) => product.slug === slug);
}
