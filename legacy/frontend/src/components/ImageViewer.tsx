import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OptimizedImage from '@/components/OptimizedImage';

interface ImageInfo {
  productCode: string;
  imageName: string;
  alt: string;
}

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageInfo[];
  initialIndex?: number;
  productName?: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  productName = ''
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);
  const startPositionRef = useRef({ x: 0, y: 0 });

  // 重置到初始索引
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setDragOffset(0);
      setIsTransitioning(false);
    }
  }, [isOpen, initialIndex]);

  // 处理拖拽开始
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (isTransitioning) return;
    
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
    startTimeRef.current = Date.now();
    startPositionRef.current = { x: clientX, y: clientY };
    setDragOffset(0);
  }, [isTransitioning]);

  // 处理拖拽移动
  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || isTransitioning) return;

    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    
    // 只有水平拖拽距离大于垂直拖拽距离时才处理
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setDragOffset(deltaX);
    }
  }, [isDragging, dragStart, isTransitioning]);

  // 处理拖拽结束
  const handleDragEnd = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;

    setIsDragging(false);
    
    const deltaX = clientX - dragStart.x;
    const deltaTime = Date.now() - startTimeRef.current;
    const velocity = Math.abs(deltaX) / deltaTime; // px/ms
    
    // 判断是否应该切换图片
    const threshold = 50; // 最小拖拽距离
    const velocityThreshold = 0.5; // 最小速度阈值
    
    const shouldSwipe = Math.abs(deltaX) > threshold || velocity > velocityThreshold;
    
    if (shouldSwipe) {
      if (deltaX > 0 && currentIndex > 0) {
        // 向右拖拽，显示上一张
        goToPrevious();
      } else if (deltaX < 0 && currentIndex < images.length - 1) {
        // 向左拖拽，显示下一张
        goToNext();
      } else {
        // 回弹到当前位置
        animateToPosition(0);
      }
    } else {
      // 回弹到当前位置
      animateToPosition(0);
    }
  }, [isDragging, dragStart, currentIndex, images.length]);

  // 动画到指定位置
  const animateToPosition = useCallback((targetOffset: number) => {
    setIsTransitioning(true);
    setDragOffset(targetOffset);
    
    setTimeout(() => {
      setIsTransitioning(false);
      if (targetOffset === 0) {
        setDragOffset(0);
      }
    }, 300);
  }, []);

  // 切换到上一张
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentIndex(prev => prev - 1);
      setDragOffset(0);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  }, [currentIndex, isTransitioning]);

  // 切换到下一张
  const goToNext = useCallback(() => {
    if (currentIndex < images.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentIndex(prev => prev + 1);
      setDragOffset(0);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  }, [currentIndex, images.length, isTransitioning]);

  // 跳转到指定索引
  const goToIndex = useCallback((index: number) => {
    if (index !== currentIndex && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentIndex(index);
      setDragOffset(0);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  }, [currentIndex, isTransitioning]);

  // 鼠标事件处理
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX, e.clientY);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    handleDragEnd(e.clientX, e.clientY);
  };

  // 触摸事件处理
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    handleDragEnd(touch.clientX, touch.clientY);
  };

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, goToPrevious, goToNext, onClose]);

  if (!images.length) return null;

  const currentImage = images[currentIndex];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full h-[90vh] p-0 bg-black/95 border-none">
        <div className="relative w-full h-full flex flex-col">
          {/* 关闭按钮 */}
          <DialogClose className="absolute top-4 right-4 z-50 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors p-2">
            <X className="h-5 w-5" />
          </DialogClose>

          {/* 主图区域 */}
          <div 
            ref={containerRef}
            className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={isDragging ? handleMouseMove : undefined}
            onMouseUp={isDragging ? handleMouseUp : undefined}
            onMouseLeave={isDragging ? handleMouseUp : undefined}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div 
              className={`w-full h-full flex items-center justify-center transition-transform ${
                isTransitioning ? 'duration-300 ease-out' : ''
              }`}
              style={{
                transform: `translateX(${dragOffset}px)`,
              }}
            >
              <div className="max-w-full max-h-full p-8">
                <OptimizedImage
                  productCode={currentImage.productCode}
                  imageName={currentImage.imageName}
                  alt={currentImage.alt}
                  usage="detail-main"
                  className="max-w-full max-h-full object-contain"
                  lazy={false}
                  priority={true}
                />
              </div>
            </div>

            {/* 左右导航按钮（备用，主要还是拖拽） */}
            {currentIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 text-white hover:bg-black/50 rounded-full opacity-70 hover:opacity-100 transition-opacity"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}
            
            {currentIndex < images.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 text-white hover:bg-black/50 rounded-full opacity-70 hover:opacity-100 transition-opacity"
                onClick={goToNext}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}
          </div>

          {/* 缩略图导航 */}
          {images.length > 1 && (
            <div className="bg-black/80 p-4">
              <div className="flex gap-2 justify-center overflow-x-auto max-w-full">
                {images.map((image, index) => (
                  <div
                    key={index}
                    className={`relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                      index === currentIndex 
                        ? 'border-cosmetic-gold-400 opacity-100' 
                        : 'border-transparent opacity-60 hover:opacity-80'
                    }`}
                    onClick={() => goToIndex(index)}
                  >
                    <OptimizedImage
                      productCode={image.productCode}
                      imageName={image.imageName}
                      alt={`${productName} - ${index + 1}`}
                      usage="gallery-thumbnail"
                      className="w-full h-full object-cover"
                      lazy={true}
                      priority={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 图片计数器 */}
          <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageViewer;
