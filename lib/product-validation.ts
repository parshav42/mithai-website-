export type ProductInput = {
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  packageSize: string;
  priceInPaise: number;
  originalPriceInPaise: number | null;
  stockQuantity: number;
  isAvailable: boolean;
  isFeatured: boolean;
};

export type ProductInputResult =
  | { success: true; value: ProductInput }
  | { success: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rupeesToPaise(value: unknown, optional: boolean) {
  if (optional && value === "") return { valid: true as const, value: null };
  if (typeof value !== "string" && typeof value !== "number") {
    return { valid: false as const };
  }
  const amount = String(value).trim();
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(amount)) {
    return { valid: false as const };
  }
  const [rupees, paise = ""] = amount.split(".");
  const result = Number(rupees) * 100 + Number(paise.padEnd(2, "0"));
  return Number.isSafeInteger(result) && result <= 100_000_000_000
    ? { valid: true as const, value: result }
    : { valid: false as const };
}

function validImageUrl(value: string) {
  if (value === "/images/mithai-assortment.jpg") return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

export function validateProductInput(value: unknown): ProductInputResult {
  if (!isRecord(value)) {
    return { success: false, error: "Product details must be an object." };
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  const description =
    typeof value.description === "string" ? value.description.trim() : "";
  const category = typeof value.category === "string" ? value.category.trim() : "";
  const packageSize =
    typeof value.packageSize === "string" ? value.packageSize.trim() : "";
  const imageUrl =
    typeof value.imageUrl === "string" && value.imageUrl
      ? value.imageUrl.trim()
      : "/images/mithai-assortment.jpg";
  const price = rupeesToPaise(value.priceRupees, false);
  const originalPrice =
    value.originalPriceRupees === "" || value.originalPriceRupees === null
      ? { valid: true as const, value: null }
      : rupeesToPaise(value.originalPriceRupees, true);
  const stockQuantity = value.stockQuantity;

  if (name.length < 2 || name.length > 120) {
    return { success: false, error: "Product name must be 2 to 120 characters." };
  }
  if (description.length < 1 || description.length > 2000) {
    return { success: false, error: "Description must be 1 to 2,000 characters." };
  }
  if (category.length < 1 || category.length > 80) {
    return { success: false, error: "Category must be 1 to 80 characters." };
  }
  if (
    packageSize.length < 1 ||
    packageSize.length > 40 ||
    !/^[\p{L}\d .-]+$/u.test(packageSize)
  ) {
    return { success: false, error: "Enter a valid package size, such as 500 g or 1 kg." };
  }
  if (!price.valid || price.value === null || price.value < 1) {
    return { success: false, error: "Enter a valid selling price in INR." };
  }
  if (
    !originalPrice.valid ||
    (originalPrice.value !== null && originalPrice.value < price.value)
  ) {
    return {
      success: false,
      error: "Original price must be blank or at least the selling price.",
    };
  }
  if (
    typeof stockQuantity !== "number" ||
    !Number.isInteger(stockQuantity) ||
    stockQuantity < 0 ||
    stockQuantity > 1_000_000
  ) {
    return { success: false, error: "Stock must be a whole number from 0 to 1,000,000." };
  }
  if (typeof value.isAvailable !== "boolean" || typeof value.isFeatured !== "boolean") {
    return { success: false, error: "Availability and featured status must be selected." };
  }
  if (!validImageUrl(imageUrl)) {
    return {
      success: false,
      error: "Use an uploaded Vercel Blob image or the default product image.",
    };
  }

  return {
    success: true,
    value: {
      name,
      description,
      imageUrl,
      category,
      packageSize,
      priceInPaise: price.value,
      originalPriceInPaise: originalPrice.value,
      stockQuantity,
      isAvailable: value.isAvailable,
      isFeatured: value.isFeatured,
    },
  };
}

export function validateProductImage(file: {
  type: string;
  size: number;
  name: string;
}) {
  const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const extensions: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };
  if (!supportedTypes.has(file.type)) {
    return { success: false as const, error: "Upload a JPG, PNG, or WebP image." };
  }
  if (!Number.isInteger(file.size) || file.size < 1 || file.size > 4 * 1024 * 1024) {
    return { success: false as const, error: "Image must be no larger than 4 MB." };
  }
  return { success: true as const, extension: extensions[file.type] };
}

export function validateProductImageContent(type: string, bytes: Uint8Array) {
  if (type === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
    );
  }
  if (type === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return (
    type === "image/webp" &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}
