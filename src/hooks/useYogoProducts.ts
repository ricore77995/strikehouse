import { useQuery } from "@tanstack/react-query";
import { buildPurchaseUrl } from "@/lib/yogoLinks";

interface YogoProductImage {
  filename: string | null;
}

interface YogoProductRaw {
  id: number;
  name: string;
  price: number;
  for_sale: number;
  archived: number;
  image?: YogoProductImage | null;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  purchaseUrl: string;
  /** Apparel is bought without a size; the size is picked at the counter. */
  needsSizeAtPickup: boolean;
}

const API_BASE = "/api/yogo";

/** Products carry no size or stock in YOGO, so apparel is flagged by name. */
const APPAREL = /t-?shirt|sweat|top|hoodie|calç|shorts/i;

function buildImageUrl(image: YogoProductImage | null | undefined): string | null {
  if (!image?.filename) return null;
  return `https://yogo.imgix.net/${image.filename}?w=600&h=600&fit=crop&auto=format`;
}

async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/products`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`YOGO products: ${res.status}`);

  const raw: YogoProductRaw[] = await res.json();
  return raw
    .filter((product) => product.for_sale && !product.archived)
    .map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: buildImageUrl(product.image),
      purchaseUrl: buildPurchaseUrl("product", product.id),
      needsSizeAtPickup: APPAREL.test(product.name),
    }))
    .sort((a, b) => a.price - b.price);
}

export function useYogoProducts() {
  return useQuery<Product[]>({
    queryKey: ["yogo-products"],
    queryFn: fetchProducts,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}
