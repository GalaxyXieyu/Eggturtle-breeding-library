import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, ShoppingCart } from "lucide-react";
import { Product } from "@/types/products";
import { useLanguage } from "@/contexts/LanguageContext";
import OptimizedImage from "@/components/OptimizedImage";
import { getOptimizedImageProps, hasValidImages } from "@/utils/productImageHelpers";

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  size?: 'large' | 'medium' | 'small' | 'compact';
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, size = 'medium' }) => {
  const { t } = useLanguage();
  const hasImages = hasValidImages(product);
  const imageProps = getOptimizedImageProps(product, 0, 'card-preview');
  
  // 根据size调整样式
  const getSizeClasses = () => {
    switch (size) {
      case 'large':
        return {
          padding: 'p-6',
          spacing: 'space-y-4',
          titleSize: 'text-lg',
          titleHeight: 'h-14',
          codeSize: 'text-sm',
          detailsSize: 'text-sm',
          detailsPadding: 'p-4',
          buttonSize: 'sm' as const,
          iconSize: 'h-20 w-20',
          badgeSize: 'px-3 py-1.5 text-sm'
        };
      case 'medium':
        return {
          padding: 'p-4',
          spacing: 'space-y-3',
          titleSize: 'text-base',
          titleHeight: 'h-12',
          codeSize: 'text-xs',
          detailsSize: 'text-xs',
          detailsPadding: 'p-3',
          buttonSize: 'sm' as const,
          iconSize: 'h-16 w-16',
          badgeSize: 'px-2.5 py-1 text-xs'
        };
      case 'small':
        return {
          padding: 'p-3',
          spacing: 'space-y-2',
          titleSize: 'text-sm',
          titleHeight: 'h-10',
          codeSize: 'text-xs',
          detailsSize: 'text-xs',
          detailsPadding: 'p-2',
          buttonSize: 'sm' as const,
          iconSize: 'h-12 w-12',
          badgeSize: 'px-2 py-0.5 text-xs'
        };
      case 'compact':
        return {
          padding: 'p-2',
          spacing: 'space-y-1',
          titleSize: 'text-xs',
          titleHeight: 'h-8',
          codeSize: 'text-xs',
          detailsSize: 'text-xs',
          detailsPadding: 'p-2',
          buttonSize: 'sm' as const,
          iconSize: 'h-10 w-10',
          badgeSize: 'px-1.5 py-0.5 text-xs'
        };
      default:
        return {
          padding: 'p-4',
          spacing: 'space-y-3',
          titleSize: 'text-base',
          titleHeight: 'h-12',
          codeSize: 'text-xs',
          detailsSize: 'text-xs',
          detailsPadding: 'p-3',
          buttonSize: 'sm' as const,
          iconSize: 'h-16 w-16',
          badgeSize: 'px-2.5 py-1 text-xs'
        };
    }
  };

  const styles = getSizeClasses();
  
  return (
    <Card className="overflow-hidden flex flex-col transition-all duration-500 hover:shadow-xl hover:shadow-cosmetic-gold-200/30 hover:-translate-y-2 border-0 bg-white/80 backdrop-blur-sm h-full rounded-xl group relative">
      {/* 背景渐变效果 */}
      <div className="absolute inset-0 bg-gradient-to-br from-cosmetic-gold-200/10 via-white/20 to-cosmetic-beige-200/10 rounded-xl opacity-60 group-hover:opacity-90 transition-all duration-500"></div>
      
      {/* 悬停时的边框光晕 */}
      <div className="absolute inset-[1px] bg-gradient-to-br from-cosmetic-gold-100/20 via-transparent to-cosmetic-beige-100/15 rounded-xl opacity-40 group-hover:opacity-70 transition-all duration-500"></div>
      
      <Link to={`/product/${product.id}`} className="relative z-10">
        <div className={`aspect-square overflow-hidden bg-gradient-to-br from-cosmetic-beige-50 via-white to-cosmetic-gold-50/50 flex items-center justify-center ${styles.padding} relative group-hover:bg-gradient-to-br group-hover:from-cosmetic-beige-100/80 group-hover:via-white group-hover:to-cosmetic-gold-100/60 transition-all duration-500`}>
          {hasImages && imageProps ? (
            <div className="w-full h-full">
              <OptimizedImage
                productCode={imageProps.productCode}
                imageName={imageProps.imageName}
                alt={imageProps.alt}
                usage={imageProps.usage}
                className="transition-transform duration-500 group-hover:scale-110 drop-shadow-sm"
                lazy={true}
                priority={false}
              />
            </div>
          ) : (
            <ImageIcon className={`${styles.iconSize} text-cosmetic-beige-300 group-hover:text-cosmetic-gold-400 transition-colors duration-300`} />
          )}

          {/* 图片悬停覆盖层 */}
          <div className="absolute inset-0 bg-gradient-to-t from-cosmetic-brown-900/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
        </div>
      </Link>
      
      <div className={`${styles.padding} flex-grow flex flex-col relative z-10 ${styles.spacing}`}>
        <Link to={`/product/${product.id}`}>
          <h3 className={`font-semibold text-cosmetic-brown-600 group-hover:text-cosmetic-brown-500 line-clamp-2 ${styles.titleHeight} ${styles.titleSize} leading-tight transition-colors duration-300 font-serif`}>
            {product.code}
          </h3>
        </Link>
        
        {/* 产品代码 - 根据size调整 */}
        <div className="flex items-center">
          <span className={`inline-flex items-center ${styles.codeSize} text-cosmetic-brown-500 bg-gradient-to-r from-cosmetic-gold-100/60 to-cosmetic-beige-100/60 px-3 py-1.5 rounded-full border border-cosmetic-gold-200/40 font-medium tracking-wide backdrop-blur-sm`}>
            <span className="w-1.5 h-1.5 bg-cosmetic-gold-400 rounded-full mr-2"></span>
            {t("code")}: {product.code}
          </span>
        </div>

        {/* 产品详细信息 - 根据size调整 */}
        {size !== 'compact' && (
          <div className={`bg-gradient-to-r from-cosmetic-beige-50/80 to-cosmetic-gold-50/60 rounded-lg ${styles.detailsPadding} border border-cosmetic-beige-200/30 backdrop-blur-sm`}>
            <div className={`text-center ${styles.detailsSize} text-cosmetic-brown-400`}>
              产品详情请联系客服咨询
            </div>
          </div>
        )}
      </div>

      {/* 底部按钮区域 */}
      <div className={`${styles.padding} border-t border-cosmetic-gold-200/30 bg-gradient-to-r from-cosmetic-beige-50/60 via-white/40 to-cosmetic-gold-50/50 mt-auto relative z-10 backdrop-blur-sm`}>
        <Button
          size={styles.buttonSize}
          onClick={(e) => {
            e.preventDefault();
            onAddToCart(product);
          }}
          className={`bg-gradient-to-r from-cosmetic-gold-500 to-cosmetic-gold-600 hover:from-cosmetic-gold-600 hover:to-cosmetic-gold-700 text-white w-full flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-300 rounded-lg font-medium border-0 group-hover:scale-105 transform`}
        >
          <ShoppingCart className={`h-4 w-4 group-hover:rotate-12 transition-transform duration-300`} />
          <span className={`${size === 'compact' ? 'text-xs' : 'text-sm'}`}>{size === 'compact' ? t("addToCartInquiry").slice(0, 4) : t("addToCartInquiry")}</span>
        </Button>
      </div>
    </Card>
  );
};

export default ProductCard;
