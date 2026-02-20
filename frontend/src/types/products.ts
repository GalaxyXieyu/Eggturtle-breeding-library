
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
  name: string;
  code: string;
  description: string;
  stage: string;
  status: 'draft' | 'active' | 'reserved' | 'sold';
  seriesId?: string | null;
  sex?: 'male' | 'female' | string | null;
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
  stage?: string;
  status?: 'draft' | 'active' | 'reserved' | 'sold';
  priceRange?: { min: number; max: number };
}

export interface FilterOptionsResponse {
  priceRange: { min: number; max: number };
  stages: string[];
  statuses: string[];
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
