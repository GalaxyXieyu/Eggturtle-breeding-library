/**
 * 图片优化工具
 * 根据用途和设备能力选择最合适的图片尺寸和格式
 */

// 图片尺寸定义
export type ImageSize = 'thumbnail' | 'small' | 'medium' | 'large';

// 图片格式定义
export type ImageFormat = 'webp' | 'jpg';

// 图片用途定义
export type ImageUsage = 
  | 'card-thumbnail'    // 产品卡片缩略图
  | 'card-preview'      // 产品卡片预览
  | 'gallery-thumbnail' // 图片库缩略图
  | 'gallery-main'      // 图片库主图
  | 'detail-main'       // 详情页主图
  | 'carousel'          // 轮播图
  | 'avatar';           // 头像

// 图片配置接口
interface ImageConfig {
  size: ImageSize;
  quality?: number;
  loading?: 'lazy' | 'eager';
}

// 根据用途获取最佳图片配置
const getImageConfigForUsage = (usage: ImageUsage): ImageConfig => {
  const configs: Record<ImageUsage, ImageConfig> = {
    'card-thumbnail': { size: 'thumbnail', loading: 'lazy' },
    'card-preview': { size: 'small', loading: 'lazy' },
    'gallery-thumbnail': { size: 'thumbnail', loading: 'lazy' },
    'gallery-main': { size: 'medium', loading: 'eager' },
    'detail-main': { size: 'large', loading: 'eager' },
    'carousel': { size: 'large', loading: 'eager' },
    'avatar': { size: 'thumbnail', loading: 'eager' },
  };
  
  return configs[usage];
};

// 检测浏览器是否支持 WebP
const supportsWebP = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
};

// 检测网络连接质量
const getConnectionQuality = (): 'slow' | 'fast' => {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return 'fast'; // 默认假设快速连接
  }
  
  const connection = (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number } }).connection;
  if (connection) {
    // 检查连接类型和速度
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      return 'slow';
    }
    if (connection.downlink && connection.downlink < 1.5) {
      return 'slow';
    }
  }
  
  return 'fast';
};

// 构建图片 URL
export const buildImageUrl = (
  productCode: string,
  imageName: string,
  usage: ImageUsage,
  baseUrl: string = ''
): string => {
  const config = getImageConfigForUsage(usage);
  const connectionQuality = getConnectionQuality();
  const webpSupported = supportsWebP();
  
  // 根据网络质量调整尺寸
  let size = config.size;
  if (connectionQuality === 'slow') {
    const sizeDowngrade: Record<ImageSize, ImageSize> = {
      'large': 'medium',
      'medium': 'small',
      'small': 'thumbnail',
      'thumbnail': 'thumbnail',
    };
    size = sizeDowngrade[size];
  }
  
  // 选择格式
  const format: ImageFormat = webpSupported ? 'webp' : 'jpg';
  
  // 构建文件名（去掉原始扩展名）
  const baseName = imageName.replace(/\.[^/.]+$/, '');
  const fileName = `${baseName}.${format}`;
  
  // 构建完整路径 - 使用子文件夹结构: productCode/size/
  const path = `${baseUrl}/static/images/${productCode}/${size}/${fileName}`;
  
  return path;
};

// 构建多个尺寸的 srcset
export const buildSrcSet = (
  productCode: string,
  imageName: string,
  usage: ImageUsage,
  baseUrl: string = ''
): string => {
  const config = getImageConfigForUsage(usage);
  const webpSupported = supportsWebP();
  const format: ImageFormat = webpSupported ? 'webp' : 'jpg';
  
  const baseName = imageName.replace(/\.[^/.]+$/, '');
  const fileName = `${baseName}.${format}`;
  
  // 构建不同尺寸的 URL - 使用子文件夹结构
  const sizes: Array<{ size: ImageSize; width: number }> = [
    { size: 'thumbnail', width: 150 },
    { size: 'small', width: 300 },
    { size: 'medium', width: 500 },
    { size: 'large', width: 800 },
  ];
  
  return sizes
    .map(({ size, width }) => {
      const url = `${baseUrl}/static/images/${productCode}/${size}/${fileName}`;
      return `${url} ${width}w`;
    })
    .join(', ');
};

// 构建 sizes 属性
export const buildSizes = (usage: ImageUsage): string => {
  const sizesMap: Record<ImageUsage, string> = {
    'card-thumbnail': '150px',
    'card-preview': '(max-width: 640px) 150px, 300px',
    'gallery-thumbnail': '80px',
    'gallery-main': '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 500px',
    'detail-main': '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 800px',
    'carousel': '100vw',
    'avatar': '40px',
  };
  
  return sizesMap[usage];
};

// 预加载关键图片
export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
};

// 预加载产品的关键图片
export const preloadProductImages = async (
  productCode: string,
  imageNames: string[],
  baseUrl: string = ''
): Promise<void> => {
  // 只预加载主图的小尺寸版本
  if (imageNames.length > 0) {
    const mainImageUrl = buildImageUrl(productCode, imageNames[0], 'card-preview', baseUrl);
    await preloadImage(mainImageUrl);
  }
};

// 获取占位符图片
export const getPlaceholderUrl = (width: number = 300, height: number = 300): string => {
  return `data:image/svg+xml,%3Csvg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="100%25" height="100%25" fill="%23f3f4f6"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial,sans-serif" font-size="14" fill="%23d1d5db" text-anchor="middle" dy=".3em"%3E加载中...%3C/text%3E%3C/svg%3E`;
};

// 图片加载错误时的备用图片
export const getFallbackUrl = (usage: ImageUsage): string => {
  const size = getImageConfigForUsage(usage).size;
  const dimensions: Record<ImageSize, { width: number; height: number }> = {
    'thumbnail': { width: 150, height: 150 },
    'small': { width: 300, height: 300 },
    'medium': { width: 500, height: 500 },
    'large': { width: 800, height: 800 },
  };
  
  const { width, height } = dimensions[size];
  return `data:image/svg+xml,%3Csvg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="100%25" height="100%25" fill="%23f9fafb"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial,sans-serif" font-size="16" fill="%23d1d5db" text-anchor="middle" dy=".3em"%3E图片加载失败%3C/text%3E%3C/svg%3E`;
}; 
