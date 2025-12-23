import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { createImageUrl, createApiUrl, API_ENDPOINTS } from "@/lib/api";

interface CarouselData {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl?: string;
  isActive: boolean;
  sortOrder: number;
}

const HeroSection: React.FC = () => {
  const { t } = useLanguage();
  const [carousels, setCarousels] = useState<CarouselData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 自动播放插件配置
  const plugin = React.useRef(Autoplay({ delay: 5000, stopOnInteraction: true }));

  // 获取轮播图数据
  useEffect(() => {
    const fetchCarousels = async () => {
      try {
        const response = await fetch(createApiUrl(API_ENDPOINTS.CAROUSELS));
        if (response.ok) {
          const data = await response.json();
          setCarousels(data.data || []);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchCarousels();
  }, []);

  // 默认轮播图数据（当API没有数据时使用）
  const defaultCarouselImages = [
    {
      id: "default-1",
      title: "高端化妆品包装",
      description: "为您的化妆品选择完美的包装，提升品牌价值",
      imageUrl: "images/carousel/carousel-1.jpg",
      linkUrl: "/product/prod-001", // 链接到经典圆柱口红管产品页
      isActive: true,
      sortOrder: 1,
    },
    {
      id: "default-2",
      title: "创新包装设计",
      description: "展现产品魅力，我们提供各种高品质的化妆品包装解决方案",
      imageUrl: "images/carousel/carousel-2.jpg",
      linkUrl: "", // 没有链接，将会滚动到产品部分
      isActive: true,
      sortOrder: 2,
    }
  ];

  // 使用API数据或默认数据
  const carouselImages = carousels.length > 0 ? carousels : defaultCarouselImages;

  // 如果正在加载且没有数据，显示加载状态
  if (isLoading) {
    return (
      <section className="relative w-full bg-beige-gradient h-[60vh] md:h-[70vh] lg:h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cosmetic-gold-400 mx-auto mb-4"></div>
          <p className="text-cosmetic-brown-300">加载轮播图...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full bg-beige-gradient">
      <Carousel
        className="w-full"
        plugins={[plugin.current]}
        opts={{
          align: "start",
          loop: true,
        }}
      >
        <CarouselContent>
          {carouselImages.map((item) => (
            <CarouselItem key={item.id}>
              <div className="relative w-full h-[60vh] md:h-[70vh] lg:h-[80vh]">
                <div className="absolute inset-0 bg-gradient-to-r from-cosmetic-beige-100/90 to-transparent z-10"></div>
                <img
                  src={createImageUrl(item.imageUrl)}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // 如果图片加载失败，使用占位符
                    const target = e.target as HTMLImageElement;
                    target.src = '/placeholder.svg';
                  }}
                />
                <div className="absolute inset-0 z-20 flex items-center">
                  <div className="container mx-auto px-4">
                    <div className="max-w-2xl">
                      <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold mb-4 leading-tight text-cosmetic-brown-500">
                        {item.title}
                      </h1>
                      <p className="text-cosmetic-brown-300 text-lg md:text-xl lg:text-2xl mb-8 max-w-lg">
                        {item.description || "为您的化妆品选择完美的包装，提升品牌价值"}
                      </p>
                      <div className="flex flex-wrap gap-4">
                        <Button
                          className="bg-cosmetic-brown-300 hover:bg-cosmetic-brown-400 text-white px-8 py-6 text-lg"
                          onClick={() => {
                            // 优先使用配置的链接URL
                            if (item.linkUrl && item.linkUrl.trim()) {
                              // 如果是外部链接，直接跳转
                              if (item.linkUrl.startsWith('http')) {
                                window.open(item.linkUrl, '_blank');
                              } else {
                                // 内部链接，使用当前窗口跳转
                                window.location.href = item.linkUrl;
                              }
                            } else {
                              // 没有配置链接时，滚动到产品部分
                              const productsSection = document.getElementById('all-products-section');
                              if (productsSection) {
                                productsSection.scrollIntoView({ 
                                  behavior: 'smooth',
                                  block: 'start' 
                                });
                              } else {
                                // 如果找不到产品部分，尝试找到产品列表的其他可能ID
                                const alternativeSelectors = [
                                  'products-section',
                                  'product-list',
                                  'main-products',
                                  '[data-section="products"]'
                                ];
                                
                                for (const selector of alternativeSelectors) {
                                  const element = document.querySelector(selector);
                                  if (element) {
                                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    return;
                                  }
                                }
                                
                                // 如果都找不到，滚动到页面底部
                                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                              }
                            }
                          }}
                        >
                          {t("browseProducts")}
                        </Button>
                        <Button variant="outline" className="border-cosmetic-beige-300 text-cosmetic-brown-300 hover:bg-cosmetic-beige-200 hover:text-cosmetic-brown-500 px-8 py-6 text-lg">
                          {t("learnMore")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-6 bg-white/10 hover:bg-white/20 border-none backdrop-blur-md w-12 h-12 text-white/60 hover:text-white/90 shadow-none hover:shadow-lg hover:shadow-black/10 transition-all duration-700 opacity-40 hover:opacity-80 scale-90 hover:scale-100 transform" />
        <CarouselNext className="right-6 bg-white/10 hover:bg-white/20 border-none backdrop-blur-md w-12 h-12 text-white/60 hover:text-white/90 shadow-none hover:shadow-lg hover:shadow-black/10 transition-all duration-700 opacity-40 hover:opacity-80 scale-90 hover:scale-100 transform" />
      </Carousel>
      
      {/* 装饰性元素 */}
      <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-cosmetic-beige-100 to-transparent"></div>
    </section>
  );
};

export default HeroSection;
