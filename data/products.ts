export const productCategories = [
  { slug: "kaju-katli", name: "Kaju Katli" },
  { slug: "ladoo", name: "Ladoo" },
  { slug: "barfi", name: "Barfi" },
  { slug: "rasgulla", name: "Rasgulla" },
  { slug: "peda", name: "Peda" },
  { slug: "jalebi", name: "Jalebi" },
] as const;

export type ProductCategory = (typeof productCategories)[number]["slug"];
export type ProductAvailability = "available" | "unavailable" | "unconfirmed";

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  imageAlt: string;
  category: ProductCategory;
  availability: ProductAvailability;
  priceInPaise: number | null;
  isDemonstration: boolean;
};

export const products = [
  {
    id: "demo-kaju-katli",
    name: "Kaju Katli",
    slug: "kaju-katli",
    description:
      "A demonstration catalog entry for Kaju Katli. The shop's recipe, product details, and availability have not been confirmed.",
    image: "/images/mithai-assortment.jpg",
    imageAlt: "Illustrative photograph of assorted Indian sweets; not shop product photography.",
    category: "kaju-katli",
    availability: "unconfirmed",
    priceInPaise: null,
    isDemonstration: true,
  },
  {
    id: "demo-motichoor-ladoo",
    name: "Motichoor Ladoo",
    slug: "motichoor-ladoo",
    description:
      "A demonstration catalog entry for Motichoor Ladoo. The shop's recipe, product details, and availability have not been confirmed.",
    image: "/images/ladoo.jpg",
    imageAlt: "Illustrative photograph of ladoos; not shop product photography.",
    category: "ladoo",
    availability: "unconfirmed",
    priceInPaise: null,
    isDemonstration: true,
  },
  {
    id: "demo-peda",
    name: "Peda",
    slug: "peda",
    description:
      "A demonstration catalog entry for Peda. The shop's recipe, product details, and availability have not been confirmed.",
    image: "/images/mithai-assortment.jpg",
    imageAlt: "Illustrative photograph of assorted Indian sweets; not shop product photography.",
    category: "peda",
    availability: "unconfirmed",
    priceInPaise: null,
    isDemonstration: true,
  },
  {
    id: "demo-jalebi",
    name: "Jalebi",
    slug: "jalebi",
    description:
      "A demonstration catalog entry for Jalebi. The shop's recipe, product details, and availability have not been confirmed.",
    image: "/images/jalebi.jpg",
    imageAlt: "Illustrative photograph of a jalebi sweet; not shop product photography.",
    category: "jalebi",
    availability: "unconfirmed",
    priceInPaise: null,
    isDemonstration: true,
  },
  {
    id: "demo-barfi",
    name: "Barfi",
    slug: "barfi",
    description:
      "A demonstration catalog entry for Barfi. The shop's recipe, product details, and availability have not been confirmed.",
    image: "/images/hero-mithai.jpg",
    imageAlt: "Illustrative photograph of assorted Indian sweets; not shop product photography.",
    category: "barfi",
    availability: "unconfirmed",
    priceInPaise: null,
    isDemonstration: true,
  },
  {
    id: "demo-rasgulla",
    name: "Rasgulla",
    slug: "rasgulla",
    description:
      "A demonstration catalog entry for Rasgulla. The shop's recipe, product details, and availability have not been confirmed.",
    image: "/images/gifting-mithai.jpg",
    imageAlt: "Illustrative photograph of assorted Indian sweets; not shop product photography.",
    category: "rasgulla",
    availability: "unconfirmed",
    priceInPaise: null,
    isDemonstration: true,
  },
] as const satisfies readonly Product[];

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getProductById(id: string) {
  return products.find((product) => product.id === id);
}

export function formatPrice(priceInPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(priceInPaise / 100);
}

export function isPurchasable(
  product: Product,
): product is Product & { priceInPaise: number } {
  return (
    product.availability === "available" &&
    product.priceInPaise !== null &&
    Number.isSafeInteger(product.priceInPaise) &&
    product.priceInPaise > 0 &&
    product.priceInPaise <= Math.floor(Number.MAX_SAFE_INTEGER / 99)
  );
}
