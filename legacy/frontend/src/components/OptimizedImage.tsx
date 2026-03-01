import React, { useState, useRef, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import { 
  buildImageUrl, 
  buildSrcSet, 
  buildSizes, 
  getPlaceholderUrl, 
  getFallbackUrl,
  type ImageUsage 
} from '@/utils/imageUtils';

interface OptimizedImageProps {
  // 产品相关
  productCode: string;
  imageName: string;
  alt: string;
  
  // 显示用途
  usage: ImageUsage;
  
  // 样式相关
  className?: string;
  style?: React.CSSProperties;
  
  // 懒加载相关
  lazy?: boolean;
  threshold?: number; // Intersection Observer 阈值
  
  // 错误处理
  onError?: () => void;
  onLoad?: () => void;
  
  // 其他属性
  priority?: boolean; // 是否优先加载
  baseUrl?: string;
}

// 自定义 hook: 使用 Intersection Observer 进行懒加载
const useIntersectionObserver = (
  elementRef: React.RefObject<Element>,
  threshold: number = 0.1,
  rootMargin: string = '50px'
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [elementRef, threshold, rootMargin, hasIntersected]);

  return { isIntersecting, hasIntersected };
};

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  productCode,
  imageName,
  alt,
  usage,
  className = '',
  style,
  lazy = true,
  threshold = 0.1,
  onError,
  onLoad,
  priority = false,
  baseUrl = ''
}) => {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 使用 Intersection Observer 进行懒加载
  const { hasIntersected } = useIntersectionObserver(
    containerRef,
    threshold,
    '50px'
  );

  // 决定是否应该加载图片
  const shouldLoadImage = !lazy || hasIntersected || priority;

  // 生成图片 URLs
  const imageUrl = buildImageUrl(productCode, imageName, usage, baseUrl);
  const srcSet = buildSrcSet(productCode, imageName, usage, baseUrl);
  const sizes = buildSizes(usage);
  const placeholderUrl = getPlaceholderUrl();
  const fallbackUrl = getFallbackUrl(usage);
  const isShowingOriginal = imageState === 'loaded' && currentSrc === imageUrl;

  // 处理图片加载
  useEffect(() => {
    if (!shouldLoadImage) return;

    setImageState('loading');
    setCurrentSrc(imageUrl);

    // 预加载图片
    const img = new Image();
    
    img.onload = () => {
      setImageState('loaded');
      onLoad?.();
    };
    
    img.onerror = () => {
      setImageState('error');
      setCurrentSrc(fallbackUrl);
      onError?.();
    };

    // 如果支持 srcset，使用 srcset
    if (srcSet) {
      img.srcset = srcSet;
      img.sizes = sizes;
    }
    img.src = imageUrl;

  }, [shouldLoadImage, imageUrl, srcSet, sizes, fallbackUrl, onLoad, onError]);

  // 处理图片加载错误
  const handleImageError = () => {
    if (imageState !== 'error') {
      setImageState('error');
      setCurrentSrc(fallbackUrl);
      onError?.();
    }
  };

  // 处理图片加载成功
  const handleImageLoad = () => {
    if (currentSrc !== imageUrl) return;
    if (imageState !== 'loaded') {
      setImageState('loaded');
      onLoad?.();
    }
  };

  // 渲染占位符
  const renderPlaceholder = () => (
    <div 
      className={`flex items-center justify-center bg-gray-100 w-full h-full ${className}`}
      style={style}
    >
      <ImageIcon className="h-8 w-8 text-gray-400" />
    </div>
  );

  // 渲染错误状态
  const renderError = () => (
    <div 
      className={`flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 w-full h-full ${className}`}
      style={style}
    >
      <div className="text-center text-gray-400">
        <ImageIcon className="h-8 w-8 mx-auto mb-2" />
        <p className="text-xs">图片加载失败</p>
      </div>
    </div>
  );

  const renderErrorOverlay = () => {
    if (usage === 'card-thumbnail' || usage === 'card-preview' || usage === 'gallery-thumbnail') {
      return renderPlaceholder();
    }
    return renderError();
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative overflow-hidden w-full h-full ${className}`}
      style={style}
    >
      {/* 如果还没有到可视区域且启用了懒加载，显示占位符 */}
      {!shouldLoadImage && renderPlaceholder()}
      
      {/* 如果应该加载图片 */}
      {shouldLoadImage && (
        <>
          {/* 加载状态的占位符 - 保持固定尺寸 */}
          {imageState === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse w-full h-full">
              <ImageIcon className="h-8 w-8 text-gray-400" />
            </div>
          )}
          
          {/* 错误状态 */}
          {imageState === 'error' && (
            <div className="absolute inset-0">
              {renderErrorOverlay()}
            </div>
          )}
          
          {/* 实际图片 */}
          <img
            ref={imageRef}
            src={currentSrc}
            srcSet={isShowingOriginal ? srcSet : undefined}
            sizes={isShowingOriginal ? sizes : undefined}
            alt={alt}
            className={`w-full h-full object-contain transition-opacity duration-300 ${
              isShowingOriginal ? 'opacity-100' : 'opacity-0'
            }`}
            loading={lazy && !priority ? 'lazy' : 'eager'}
            onLoad={handleImageLoad}
            onError={handleImageError}
            decoding="async"
          />
          
          {/* 模糊加载效果 */}
          {imageState === 'loading' && (
            <img
              src={placeholderUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-contain filter blur-sm opacity-50"
              aria-hidden="true"
            />
          )}
        </>
      )}
    </div>
  );
};

export default OptimizedImage; 
