import { ImageUsage } from './imageUtils';
import { Product, ProductImage } from '@/types/products';

/**
 * 从现有的图片URL中提取产品代码和图片名称
 * 适配现有的数据结构
 */

interface ParsedImageInfo {
  productCode: string;
  imageName: string;
  isValid: boolean;
}

type ProductLike = Pick<Product, 'code' | 'name' | 'images'>;

// 解析原始图片URL，提取产品代码和图片名称
export const parseImageUrl = (url: string): ParsedImageInfo => {
  try {
    // 移除基础URL前缀
    const cleanUrl = url.replace(/^.*\/static\//, '').replace(/^.*\/images\//, '');
    
    // 支持的路径格式：
    // - images/z01/IMG_0433.JPG
    // - z01/IMG_0433.JPG
    // - static/images/z01/IMG_0433.JPG
    
    const pathParts = cleanUrl.split('/');
    
    if (pathParts.length >= 2) {
      const productCode = pathParts[pathParts.length - 2]; // 倒数第二部分是产品代码
      const imageName = pathParts[pathParts.length - 1];   // 最后一部分是图片名称
      
      return {
        productCode,
        imageName,
        isValid: true
      };
    }
    
    return { productCode: '', imageName: '', isValid: false };
  } catch (error) {
    return { productCode: '', imageName: '', isValid: false };
  }
};

// 从产品对象获取主图信息
export const getMainImageInfo = (product: ProductLike): ParsedImageInfo => {
  if (!product.images || product.images.length === 0) {
    return { productCode: product.code || '', imageName: '', isValid: false };
  }
  
  // 查找主图
  const mainImage = product.images.find((img: ProductImage) => img.type === 'main') || product.images[0];
  
  if (mainImage?.url) {
    const parsed = parseImageUrl(mainImage.url);
    return {
      ...parsed,
      productCode: parsed.productCode || product.code || ''
    };
  }
  
  return { productCode: product.code || '', imageName: '', isValid: false };
};

// 从产品对象获取所有图片信息
export const getAllImagesInfo = (product: ProductLike): ParsedImageInfo[] => {
  if (!product.images || product.images.length === 0) {
    return [];
  }
  
  return product.images.map((image: ProductImage) => {
    const parsed = parseImageUrl(image.url);
    return {
      ...parsed,
      productCode: parsed.productCode || product.code || ''
    };
  }).filter((info: ParsedImageInfo) => info.isValid);
};

// 根据图片在列表中的索引确定用途
export const getImageUsageByIndex = (index: number, total: number): ImageUsage => {
  if (index === 0) {
    return 'gallery-main'; // 第一张图片作为主图
  }
  return 'gallery-thumbnail'; // 其他图片作为缩略图
};

// 便捷函数：直接从产品对象和用途生成优化的图片信息
export const getOptimizedImageProps = (
  product: ProductLike, 
  imageIndex: number = 0, 
  usage: ImageUsage = 'card-preview'
) => {
  const allImages = getAllImagesInfo(product);
  
  if (allImages.length === 0 || imageIndex >= allImages.length) {
    return null;
  }
  
  const imageInfo = allImages[imageIndex];
  
  return {
    productCode: imageInfo.productCode,
    imageName: imageInfo.imageName,
    alt: `${product.name} - 图片 ${imageIndex + 1}`,
    usage
  };
};

// 检查产品是否有有效的图片
export const hasValidImages = (product: ProductLike): boolean => {
  const images = getAllImagesInfo(product);
  return images.length > 0;
};

// 获取产品的图片数量
export const getImageCount = (product: ProductLike): number => {
  return getAllImagesInfo(product).length;
}; 
