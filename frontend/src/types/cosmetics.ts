
// 管型类型现在接受任意字符串，不再限制预定义类型
export type TubeType = string;

// 盒型类型现在接受任意字符串，不再限制预定义类型
export type BoxType = string;

// 功能设计现在接受任意字符串，不再限制预定义类型
export type FunctionalDesign = string;

// 形状类型现在接受任意字符串，不再限制预定义类型
export type Shape = string;

// 材质类型现在接受任意字符串，不再限制预定义类型
export type Material = string;

// 开发线材质现在接受任意字符串，不再限制预定义类型
export type DevelopmentLineMaterial = string;

// 工艺类型现在接受任意字符串，不再限制预定义类型
export type ProcessType = string;

export interface ProductDimensions {
  weight?: number;  // in grams
  length?: number;  // in mm
  width?: number;   // in mm
  height?: number;  // in mm
  capacity?: {
    min: number;
    max: number;
  };
  compartments?: number;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  type: 'main' | 'gallery' | 'dimensions' | 'detail';
  sort_order: number;
}

export interface ProductPricing {
  costPrice: number;
  factoryPrice: number;
  hasSample: boolean;
  boxDimensions?: string;
  boxQuantity?: number;
}

export interface CosmeticProduct {
  id: string;
  name: string;
  code: string;
  description: string;
  productType?: string;
  tubeType?: TubeType;
  boxType?: BoxType;
  processType?: ProcessType;
  functionalDesigns: FunctionalDesign[];
  shape: Shape;
  material: Material;
  development_line_materials?: DevelopmentLineMaterial[];
  dimensions: ProductDimensions;
  images: ProductImage[];
  pricing: ProductPricing;
  inStock: boolean;
  popularityScore: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FilterOptions {
  tubeTypes?: TubeType[];
  boxTypes?: BoxType[];
  functionalDesigns?: FunctionalDesign[];
  shapes?: Shape[];
  materials?: Material[];
  capacityRange?: { min: number; max: number };
  compartmentRange?: { min: number; max: number };
  searchText?: string;
}

export interface FilterOptionsResponse {
  tubeTypes: TubeType[];
  boxTypes: BoxType[];
  functionalDesigns: FunctionalDesign[];
  shapes: Shape[];
  materials: Material[];
  capacityRange: { min: number; max: number };
  compartmentRange: { min: number; max: number };
  priceRange: { min: number; max: number };
}

export type SortOption = 'newest' | 'popular' | 'price_low' | 'price_high';

export interface CartItem {
  product: CosmeticProduct;
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
