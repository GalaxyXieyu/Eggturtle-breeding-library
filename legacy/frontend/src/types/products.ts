
export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  type: 'main' | 'gallery' | 'dimensions' | 'detail';
  sort_order: number;
}

export interface ProductPricing {
  costPrice: number;
  price: number;
  hasSample: boolean;
}

export interface Product {
  id: string;
  code: string;
  description: string;
  seriesId?: string | null;
  sex?: 'male' | 'female' | string | null;
  offspringUnitPrice?: number | null;
  sireCode?: string | null;
  damCode?: string | null;
  mateCode?: string | null;
  excludeFromBreeding?: boolean;
  images: ProductImage[];
  pricing: ProductPricing;
  inStock: boolean;
  popularityScore: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FilterOptions {
  searchText?: string;
  seriesId?: string;
  priceRange?: { min: number; max: number };

  // Client-side filters used by older components.
  developmentLineMaterials?: string[];
  capacityRange?: { min?: number; max?: number };
  compartmentRange?: { min?: number; max?: number };

  // Admin/backend query filters (snake_case).
  sex?: string;
  series_id?: string;
  price_min?: number;
  price_max?: number;
}

export interface FilterOptionsResponse {
  priceRange: { min: number; max: number };
}

export type SortOption = 'newest' | 'popular' | 'price_low' | 'price_high';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ImageUpload {
  file: File;
  preview: string;
  id: string;
}

export interface OrderIntent {
  items: CartItem[];
  totalPrice: number;
  date: string;
  orderId: string;
}
