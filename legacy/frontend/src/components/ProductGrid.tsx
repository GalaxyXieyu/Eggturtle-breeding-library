import React, { useState } from "react";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/types/products";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious, 
  PaginationLast,
  PaginationEllipsis,
  PaginationInfo
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  itemsPerPage?: number;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  onAddToCart,
  itemsPerPage = 8,
  onItemsPerPageChange
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const { t } = useLanguage();

  // Calculate total pages
  const totalPages = Math.ceil(products.length / itemsPerPage);

  // Get current products
  const indexOfLastProduct = currentPage * itemsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - itemsPerPage;
  const currentProducts = products.slice(indexOfFirstProduct, indexOfLastProduct);

  // 根据每页显示数量计算最优布局
  const getOptimalLayout = (count: number) => {
    if (count <= 4) {
      // 少于等于4个：1行显示
      return {
        columns: Math.min(count, 4),
        rows: 1,
        gap: 'gap-6 md:gap-8',
        cardSize: 'large' // 卡片较大
      };
    } else if (count <= 8) {
      // 5-8个：2行显示
      return {
        columns: Math.min(Math.ceil(count / 2), 4),
        rows: 2,
        gap: 'gap-4 md:gap-6',
        cardSize: 'medium' // 中等大小
      };
    } else if (count <= 12) {
      // 9-12个：3行显示
      return {
        columns: Math.min(Math.ceil(count / 3), 4),
        rows: 3,
        gap: 'gap-3 md:gap-4',
        cardSize: 'medium'
      };
    } else if (count <= 20) {
      // 13-20个：4-5行显示
      return {
        columns: Math.min(Math.ceil(count / 4), 5),
        rows: Math.ceil(count / 5),
        gap: 'gap-3 md:gap-4',
        cardSize: 'small' // 较小卡片
      };
    } else if (count <= 48) {
      // 21-48个：6-8行显示
      return {
        columns: Math.min(Math.ceil(count / 6), 6),
        rows: Math.ceil(count / 6),
        gap: 'gap-2 md:gap-3',
        cardSize: 'small'
      };
    } else {
      // 超过48个：紧凑布局
      return {
        columns: 6,
        rows: Math.ceil(count / 6),
        gap: 'gap-2',
        cardSize: 'compact' // 紧凑卡片
      };
    }
  };

  const layout = getOptimalLayout(itemsPerPage);

  // 动态生成grid-cols类名
  const getGridColumnsClass = (columns: number) => {
    const colClasses = {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-2 md:grid-cols-3',
      4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
      5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
      6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
    };
    return colClasses[columns as keyof typeof colClasses] || 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6';
  };

  // Generate page numbers for display (with ellipsis for long lists)
  const getPageNumbers = () => {
    const pageNumbers = [];

    // Always show first page
    pageNumbers.push(1);

    // Logic for showing pages around current page with ellipsis
    if (currentPage > 3) {
      pageNumbers.push('ellipsis');
    }

    // Pages around current page
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (i !== 1 && i !== totalPages) {
        pageNumbers.push(i);
      }
    }

    // Add ellipsis before last page if needed
    if (currentPage < totalPages - 2) {
      pageNumbers.push('ellipsis');
    }

    // Always show last page if there is more than one page
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }
    return pageNumbers;
  };

  // Handle page change
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    // Reset to page 1 if current page exceeds new total pages
    if (pageNumber > totalPages) {
      setCurrentPage(1);
    }
    // Scroll to top of product grid on page change
    window.scrollTo({
      top: document.getElementById('product-grid')?.offsetTop || 0,
      behavior: 'smooth'
    });
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value: string) => {
    const newItemsPerPage = parseInt(value);
    if (onItemsPerPageChange) {
      onItemsPerPageChange(newItemsPerPage);
    }
    // Reset to page 1 when changing items per page
    setCurrentPage(1);
  };

  // Reset to page 1 if current page exceeds total pages
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  return (
    <div id="product-grid" className="py-[20px]">
      {/* Items per page selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-cosmetic-brown-300">
          {t("products").replace("{0}", products.length.toString())}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-cosmetic-brown-300">{t("itemsPerPage")}:</span>
          <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4</SelectItem>
              <SelectItem value="8">8</SelectItem>
              <SelectItem value="12">12</SelectItem>
              <SelectItem value="16">16</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="24">24</SelectItem>
              <SelectItem value="48">48</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 动态网格布局 */}
      <div 
        className={`grid ${getGridColumnsClass(layout.columns)} ${layout.gap} auto-rows-fr`}
        style={{
          minHeight: layout.cardSize === 'large' ? '600px' : 
                    layout.cardSize === 'medium' ? '500px' : 
                    layout.cardSize === 'small' ? '400px' : '350px'
        }}
      >
        {products.length > 0 ? (
          currentProducts.map(product => (
            <div key={product.id} className="flex">
              <ProductCard 
                product={product} 
                onAddToCart={onAddToCart}
                size={layout.cardSize}
              />
            </div>
          ))
        ) : (
          <div className="col-span-full flex items-center justify-center p-6 sm:p-12 bg-white rounded-lg">
            <p className="text-base sm:text-lg text-cosmetic-brown-300">
              {t("noProductsFound")}
            </p>
          </div>
        )}
      </div>
      
      {/* Enhanced Pagination with page info and last page navigation */}
      {totalPages > 1 && (
        <div className="mt-8 flex flex-col items-center space-y-4">
          {/* Page Info */}
          <PaginationInfo currentPage={currentPage} totalPages={totalPages} />
          
          {/* Pagination Controls */}
          <Pagination>
            <PaginationContent>
              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationPrevious onClick={() => handlePageChange(currentPage - 1)} />
                </PaginationItem>
              )}
              
              {getPageNumbers().map((number, idx) => 
                number === 'ellipsis' ? (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={number}>
                    <PaginationLink 
                      isActive={currentPage === number} 
                      onClick={() => handlePageChange(Number(number))}
                    >
                      {number}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              
              {currentPage < totalPages && (
                <PaginationItem>
                  <PaginationNext onClick={() => handlePageChange(currentPage + 1)} />
                </PaginationItem>
              )}
              
              {currentPage < totalPages && totalPages > 3 && (
                <PaginationItem>
                  <PaginationLast onClick={() => handlePageChange(totalPages)} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default ProductGrid;
