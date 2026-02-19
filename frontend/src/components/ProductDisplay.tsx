import React, { useState } from "react";
import FilterSection from "@/components/FilterSection";
import ProductGrid from "@/components/ProductGrid";
import { FilterOptions, SortOption, Product } from "@/types/products";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProductDisplayProps {
  products: Product[];
  filters: Partial<FilterOptions>;
  sortOption: SortOption;
  onFilterChange: (filters: Partial<FilterOptions>) => void;
  onSortChange: (sort: SortOption) => void;
  onAddToCart: (product: Product) => void;
  isFilterSticky: boolean;
  showMobileFilters: boolean;
  onMobileFilterClose: () => void;
  isMobile: boolean;
  filterRef: React.RefObject<HTMLDivElement>;
  itemsPerPage: number;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

const ProductDisplay: React.FC<ProductDisplayProps> = ({
  products,
  filters,
  sortOption,
  onFilterChange,
  onSortChange,
  onAddToCart,
  isFilterSticky,
  showMobileFilters,
  onMobileFilterClose,
  isMobile,
  filterRef,
  itemsPerPage,
  onItemsPerPageChange
}) => {
  const { t } = useLanguage();

  return (
    <>
      {/* Hide desktop filter on mobile */}
      {!isMobile && (
        <div 
          ref={filterRef}
          className={`filter-container ${isFilterSticky ? 'filter-sticky' : ''}`}
          style={{
            top: isFilterSticky ? '0' : 'auto',
          }}
        >
          <FilterSection
            onFilterChange={onFilterChange}
            onSortChange={onSortChange}
            activeFilters={filters}
            sortOption={sortOption}
            isSticky={isFilterSticky}
          />
        </div>
      )}
      
      {/* Mobile filter sliding panel */}
      {isMobile && (
        <FilterSection
          onFilterChange={onFilterChange}
          onSortChange={onSortChange}
          activeFilters={filters}
          sortOption={sortOption}
          showMobileFilters={showMobileFilters}
          onMobileFilterClose={onMobileFilterClose}
        />
      )}
      
      <div className="container mx-auto px-2 sm:px-4 mt-4">
        <ProductGrid 
          products={products} 
          onAddToCart={onAddToCart} 
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={onItemsPerPageChange}
        />
      </div>
    </>
  );
};

export default ProductDisplay;
