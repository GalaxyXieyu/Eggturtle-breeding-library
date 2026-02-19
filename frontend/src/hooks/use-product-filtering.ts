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
        // Helper function to handle functionalDesigns search
        const searchInFunctionalDesigns = () => {
          if (Array.isArray(product.functionalDesigns)) {
            return product.functionalDesigns.some((design) =>
              design.toLowerCase().includes(searchTerm)
            );
          } else if (typeof product.functionalDesigns === 'string') {
            return product.functionalDesigns.toLowerCase().includes(searchTerm);
          }
          return false;
        };

        return (
          product.name.toLowerCase().includes(searchTerm) ||
          product.code.toLowerCase().includes(searchTerm) ||
          product.material.toLowerCase().includes(searchTerm) ||
          product.shape.toLowerCase().includes(searchTerm) ||
          (product.tubeType && product.tubeType.toLowerCase().includes(searchTerm)) ||
          (product.boxType && product.boxType.toLowerCase().includes(searchTerm)) ||
          searchInFunctionalDesigns() ||
          (product.developmentLineMaterials && product.developmentLineMaterials.some((material) =>
            material.toLowerCase().includes(searchTerm)
          ))
        );
      });
    }

    // Apply filters
    if (filters.tubeTypes && filters.tubeTypes.length > 0) {
      filteredProducts = filteredProducts.filter(
        (product) => product.tubeType && filters.tubeTypes!.includes(product.tubeType)
      );
    }

    if (filters.boxTypes && filters.boxTypes.length > 0) {
      filteredProducts = filteredProducts.filter(
        (product) => product.boxType && filters.boxTypes!.includes(product.boxType)
      );
    }

    if (filters.functionalDesigns && filters.functionalDesigns.length > 0) {
      filteredProducts = filteredProducts.filter((product) => {
        // Helper function to handle functionalDesigns filtering
        const checkFunctionalDesigns = () => {
          if (Array.isArray(product.functionalDesigns)) {
            return product.functionalDesigns.some((design) =>
          filters.functionalDesigns!.includes(design)
            );
          } else if (typeof product.functionalDesigns === 'string') {
            // For string type, check if any filter matches the string content
            return filters.functionalDesigns!.some((filterDesign) =>
              product.functionalDesigns === filterDesign ||
              (typeof product.functionalDesigns === 'string' && product.functionalDesigns.includes(filterDesign))
            );
          }
          return false;
        };

        return checkFunctionalDesigns();
      });
    }

    if (filters.shapes && filters.shapes.length > 0) {
      filteredProducts = filteredProducts.filter((product) =>
        filters.shapes!.includes(product.shape)
      );
    }

    if (filters.materials && filters.materials.length > 0) {
      filteredProducts = filteredProducts.filter((product) =>
        filters.materials!.includes(product.material)
      );
    }

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
