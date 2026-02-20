import React from "react";
import { Link } from "react-router-dom";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, ImageIcon } from "lucide-react";
import { Product } from "@/types/products";
import { useLanguage } from "@/contexts/LanguageContext";
import Autoplay from "embla-carousel-autoplay";
import OptimizedImage from "@/components/OptimizedImage";
import { getOptimizedImageProps, hasValidImages } from "@/utils/productImageHelpers";

interface FeaturedProductsProps {
  products: Product[];
}

const FeaturedProducts: React.FC<FeaturedProductsProps> = ({ products }) => {
  const { t } = useLanguage();
  
  // Add null/undefined check and ensure products is an array
  const featuredProducts = (products || []).slice(0, 8);
  
  // 自动播放插件配置
  const plugin = React.useRef(
    Autoplay({ delay: 4000, stopOnInteraction: true })
  );

  // Don't render if no products
  if (!products || products.length === 0) {
    return null;
  }

  const handleViewAllProducts = () => {
    const allProductsSection = document.getElementById('all-products-section');
    if (allProductsSection) {
      allProductsSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  return (
    <section className="py-20 bg-gradient-to-br from-cosmetic-beige-50 via-white to-cosmetic-gold-50 relative overflow-hidden">
      {/* 添加微妙的背景装饰元素 */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-cosmetic-gold-200/20 to-transparent rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-40 right-20 w-40 h-40 bg-gradient-to-br from-cosmetic-beige-200/20 to-transparent rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-gradient-to-br from-cosmetic-brown-200/10 to-transparent rounded-full blur-2xl animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-cosmetic-brown-500 mb-6 transform hover:scale-105 transition-transform duration-500">
            {t("featuredProducts")}
          </h2>
          <p className="text-cosmetic-brown-300 text-lg max-w-3xl mx-auto leading-relaxed opacity-80 hover:opacity-100 transition-opacity duration-300">
            {t("featuredProductsDesc")}
          </p>
          {/* 添加装饰性分割线 */}
          <div className="mt-8 flex justify-center">
            <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cosmetic-gold-300 to-transparent opacity-50"></div>
          </div>
        </div>
        
        <Carousel 
          className="w-full max-w-7xl mx-auto" 
          opts={{ align: "start", loop: true }}
          plugins={[plugin.current]}
        >
          <CarouselContent className="-ml-2 md:-ml-3">
            {featuredProducts.map((product, index) => (
              <CarouselItem key={product.id} className="pl-2 md:pl-3 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                <Link to={`/product/${product.id}`} className="block h-full group">
                  <Card 
                    className="h-full border-0 bg-white/70 backdrop-blur-md hover:bg-white/90 transition-all duration-700 hover:shadow-3xl hover:shadow-cosmetic-gold-300/40 hover:-translate-y-3 group overflow-hidden relative rounded-2xl"
                    style={{
                      animationDelay: `${index * 150}ms`
                    }}
                  >
                    {/* 豪华边框渐变效果 */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cosmetic-gold-300/20 via-cosmetic-beige-200/10 to-cosmetic-gold-400/15 rounded-2xl opacity-70 group-hover:opacity-100 transition-all duration-700"></div>
                    
                    {/* 内发光效果 */}
                    <div className="absolute inset-[1px] bg-gradient-to-br from-white/40 via-cosmetic-gold-50/20 to-white/30 rounded-2xl opacity-50 group-hover:opacity-80 transition-all duration-700"></div>
                    
                    {/* 悬停时的闪光效果 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out rounded-2xl"></div>
                    
                    <CardContent className="p-5 relative z-10 flex flex-col h-full">
                      {/* 产品图片容器 - 改进设计 */}
                      <div className="aspect-square mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-cosmetic-beige-50/40 via-white/60 to-cosmetic-gold-50/30 relative group-hover:shadow-xl group-hover:shadow-cosmetic-gold-300/30 transition-all duration-700 border border-cosmetic-gold-200/20">
                        {/* 图片背景装饰 */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-cosmetic-gold-100/10 to-cosmetic-beige-100/10 opacity-30 group-hover:opacity-50 transition-opacity duration-700"></div>

                        {(() => {
                          const imageProps = getOptimizedImageProps(product, 0, 'card-preview');
                          return imageProps ? (
                            <div className="w-full h-full p-3 relative z-10">
                              <OptimizedImage
                                productCode={imageProps.productCode}
                                imageName={imageProps.imageName}
                                alt={imageProps.alt}
                                usage={imageProps.usage}
                                className="group-hover:scale-110 transition-transform duration-1000 ease-out"
                                lazy={true}
                                priority={false}
                              />
                            </div>
                          ) : (
                            <ImageIcon className="h-16 w-16 text-cosmetic-beige-300" />
                          );
                        })()}

                        {/* 悬停时的内容覆盖层 */}
                        <div className="absolute inset-0 bg-gradient-to-t from-cosmetic-brown-900/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-2xl"></div>
                      </div>
                      
                      {/* 产品信息 - 增强设计 */}
                      <div className="flex-1 flex flex-col text-center space-y-3">
                        <h3 className="font-bold text-cosmetic-brown-600 text-lg leading-tight line-clamp-2 group-hover:text-cosmetic-brown-500 transition-colors duration-500 font-serif tracking-wide">
                          {product.name}
                        </h3>

                        {/* 装饰性分割线 */}
                        <div className="flex justify-center py-1">
                          <div className="w-8 h-px bg-gradient-to-r from-transparent via-cosmetic-gold-400/50 to-transparent group-hover:w-12 transition-all duration-500"></div>
                        </div>
                        
                        {/* 产品代码 - 重新设计 */}
                        <div className="mt-auto pt-1">
                          <span className="inline-flex items-center text-xs text-cosmetic-brown-500 bg-gradient-to-r from-cosmetic-gold-100/50 to-cosmetic-beige-100/50 px-4 py-2 rounded-full border border-cosmetic-gold-300/30 font-semibold tracking-wider backdrop-blur-sm group-hover:bg-gradient-to-r group-hover:from-cosmetic-gold-200/60 group-hover:to-cosmetic-beige-200/60 group-hover:border-cosmetic-gold-400/50 transition-all duration-500 transform group-hover:scale-110 shadow-sm group-hover:shadow-md">
                            <span className="w-1.5 h-1.5 bg-cosmetic-gold-400 rounded-full mr-2 animate-pulse"></span>
                            {product.code}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
          
          {/* 导航按钮 - 高级低调设计 */}
          <CarouselPrevious className="left-4 bg-white/5 hover:bg-white/15 border-none backdrop-blur-xl w-11 h-11 text-cosmetic-brown-400/50 hover:text-cosmetic-brown-400/80 shadow-none hover:shadow-lg hover:shadow-cosmetic-gold-200/20 transition-all duration-700 opacity-30 hover:opacity-70 scale-75 hover:scale-90 transform rounded-full" />
          <CarouselNext className="right-4 bg-white/5 hover:bg-white/15 border-none backdrop-blur-xl w-11 h-11 text-cosmetic-brown-400/50 hover:text-cosmetic-brown-400/80 shadow-none hover:shadow-lg hover:shadow-cosmetic-gold-200/20 transition-all duration-700 opacity-30 hover:opacity-70 scale-75 hover:scale-90 transform rounded-full" />
        </Carousel>

        {/* 查看全部按钮 */}
        <div className="text-center mt-16">
          <Button 
            variant="outline" 
            size="lg"
            className="border border-cosmetic-brown-300/60 text-cosmetic-brown-500 hover:bg-cosmetic-brown-500 hover:text-white hover:border-cosmetic-brown-500 transition-all duration-500 font-medium px-8 py-3 rounded-full shadow-md hover:shadow-lg group relative overflow-hidden transform hover:scale-105"
            onClick={handleViewAllProducts}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cosmetic-brown-500 to-cosmetic-brown-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full"></div>
            
            <span className="relative z-10 flex items-center">
              {t("viewAllProducts")}
              <span className="ml-2 group-hover:translate-x-1 transition-transform duration-300">→</span>
            </span>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
