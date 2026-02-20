import { useState, useEffect } from "react";
import { Product, FilterOptions, SortOption } from "@/types/products";

export function useProductFiltering(initialProducts: Product[]) {
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [filters, setFilters] = useState<Partial<FilterOptions>>({});
  const [sortOption, setSortOption] = useState<SortOption>("popular");

  // Apply filters and sorting
  useEffect(() => {
    // Add safety check for initialProducts
    if (!initialProducts || !Array.isArray(initialProducts)) {
      setProducts([]);
      return;
    }
    
    let filteredProducts = [...initialProducts];

    // Apply search text filter
    if (filters.searchText?.trim()) {
      const searchTerm = filters.searchText.toLowerCase();
      filteredProducts = filteredProducts.filter((product) => {
        return (
          product.name.toLowerCase().includes(searchTerm) ||
          product.code.toLowerCase().includes(searchTerm) ||
          (product.developmentLineMaterials && product.developmentLineMaterials.some((material) =>
            material.toLowerCase().includes(searchTerm)
          ))
        );
      });
    }

    // Apply filters
    if (filters.developmentLineMaterials && filters.developmentLineMaterials.length > 0) {
      filteredProducts = filteredProducts.filter((product) =>
        product.developmentLineMaterials &&
        product.developmentLineMaterials.some((material) =>
          filters.developmentLineMaterials!.includes(material)
        )
      );
    }

    if (filters.capacityRange) {
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.dimensions.capacity &&
          product.dimensions.capacity.max >= (filters.capacityRange?.min || 0) &&
          product.dimensions.capacity.min <= (filters.capacityRange?.max || Infinity)
      );
    }

    if (filters.compartmentRange) {
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.dimensions.compartments &&
          product.dimensions.compartments >= (filters.compartmentRange?.min || 0) &&
          product.dimensions.compartments <= (filters.compartmentRange?.max || Infinity)
      );
    }

    // Apply sorting (removed price-based sorting)
    switch (sortOption) {
      case "newest":
        filteredProducts.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case "popular":
        filteredProducts.sort((a, b) => b.popularityScore - a.popularityScore);
        break;
      default:
        break;
    }

    setProducts(filteredProducts);
  }, [filters, sortOption, initialProducts]);

  return {
    products,
    filters,
    setFilters,
    sortOption,
    setSortOption
  };
}
