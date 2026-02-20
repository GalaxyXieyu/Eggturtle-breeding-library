import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { X, Search } from "lucide-react";
import { FilterOptions, SortOption } from "@/types/products";
import { useIsMobile } from "@/hooks/use-mobile";
import { TURTLE_STAGES, PRODUCT_STATUSES } from "@/constants/filterOptions";

interface FilterSectionProps {
  onFilterChange: (filters: Partial<FilterOptions>) => void;
  onSortChange: (sort: SortOption) => void;
  activeFilters: Partial<FilterOptions>;
  sortOption: SortOption;
  className?: string;
  isSticky?: boolean;
  showMobileFilters?: boolean;
  onMobileFilterClose?: () => void;
}

const FilterSection: React.FC<FilterSectionProps> = ({
  onFilterChange,
  onSortChange,
  activeFilters,
  sortOption,
  className = "",
  isSticky = false,
  showMobileFilters = false,
  onMobileFilterClose
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isMobile = useIsMobile();

  // Auto-collapse filter content when it becomes sticky
  useEffect(() => {
    if (isSticky && isExpanded) {
      setIsExpanded(false);
    }
  }, [isSticky, isExpanded]);

  // Count active filters
  const countActiveFilters = () => {
    let count = 0;
    if (activeFilters.searchText?.trim()) count += 1;
    if (activeFilters.stage) count += 1;
    if (activeFilters.status) count += 1;
    if (activeFilters.priceRange) count += 1;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  // Handle filter changes
  const handleSearchChange = (value: string) => {
    onFilterChange({
      ...activeFilters,
      searchText: value
    });
  };

  const handleStageChange = (value: string) => {
    onFilterChange({
      ...activeFilters,
      stage: value === "all" ? undefined : value
    });
  };

  const handleStatusChange = (value: string) => {
    onFilterChange({
      ...activeFilters,
      status: value === "all" ? undefined : (value as any)
    });
  };

  const handlePriceRangeChange = (values: number[]) => {
    onFilterChange({
      ...activeFilters,
      priceRange: {
        min: values[0],
        max: values[1]
      }
    });
  };

  const clearAllFilters = () => {
    onFilterChange({
      searchText: "",
      stage: undefined,
      status: undefined,
      priceRange: undefined
    });
  };

  if (isMobile) {
    return (
      <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity ${showMobileFilters ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className={`absolute right-0 top-0 bottom-0 w-full sm:w-80 bg-cosmetic-beige-100 shadow-lg transition-transform transform ${showMobileFilters ? 'translate-x-0' : 'translate-x-full'} overflow-y-auto`}
             style={{ animation: showMobileFilters ? 'slideIn 0.3s forwards' : 'slideOut 0.3s forwards' }}>
          <div className="p-4">
            {/* Mobile filter header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-serif text-cosmetic-brown-500 flex items-center">
                筛选产品
                {activeFilterCount > 0 && (
                  <span className="ml-2 bg-cosmetic-gold-400 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </h2>
              <button
                onClick={onMobileFilterClose}
                className="text-cosmetic-brown-300 hover:text-cosmetic-brown-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search box */}
            <div className="mb-4">
              <Label htmlFor="search" className="text-cosmetic-brown-300">搜索产品:</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cosmetic-brown-300 h-4 w-4" />
                <Input
                  id="search"
                  type="text"
                  placeholder="搜索产品名称、编号等..."
                  value={activeFilters.searchText || ""}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 border-cosmetic-brown-200 focus:border-cosmetic-gold-400"
                />
              </div>
            </div>

            {/* Stage filter */}
            <div className="mb-4">
              <Label htmlFor="stage" className="text-cosmetic-brown-300">生命阶段:</Label>
              <Select value={activeFilters.stage || "all"} onValueChange={handleStageChange}>
                <SelectTrigger className="mt-1 border-cosmetic-brown-200">
                  <SelectValue placeholder="选择阶段" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部阶段</SelectItem>
                  {TURTLE_STAGES.map(stage => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div className="mb-4">
              <Label htmlFor="status" className="text-cosmetic-brown-300">产品状态:</Label>
              <Select value={activeFilters.status || "all"} onValueChange={handleStatusChange}>
                <SelectTrigger className="mt-1 border-cosmetic-brown-200">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {PRODUCT_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price range filter */}
            <div className="mb-4">
              <Label className="text-cosmetic-brown-300">
                价格范围: ¥{activeFilters.priceRange?.min || 0} - ¥{activeFilters.priceRange?.max || 10000}
              </Label>
              <Slider
                min={0}
                max={10000}
                step={100}
                value={[activeFilters.priceRange?.min || 0, activeFilters.priceRange?.max || 10000]}
                onValueChange={handlePriceRangeChange}
                className="mt-2"
              />
            </div>

            {/* Sort options */}
            <div className="mb-4">
              <Label htmlFor="sort" className="text-cosmetic-brown-300">排序方式:</Label>
              <Select value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)}>
                <SelectTrigger className="mt-1 border-cosmetic-brown-200">
                  <SelectValue placeholder="选择排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">最新上架</SelectItem>
                  <SelectItem value="popular">最受欢迎</SelectItem>
                  <SelectItem value="price_low">价格从低到高</SelectItem>
                  <SelectItem value="price_high">价格从高到低</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear filters button */}
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                onClick={clearAllFilters}
                className="w-full border-cosmetic-brown-200 text-cosmetic-brown-500 hover:bg-cosmetic-beige-200"
              >
                清除所有筛选
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Desktop view
  return (
    <div className={`bg-cosmetic-beige-100 rounded-lg shadow-md ${className}`}>
      <div className="p-4">
        {/* Desktop filter header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif text-cosmetic-brown-500 flex items-center">
            筛选产品
            {activeFilterCount > 0 && (
              <span className="ml-2 bg-cosmetic-gold-400 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-cosmetic-brown-300 hover:text-cosmetic-brown-500"
          >
            {isExpanded ? "收起" : "展开"}
          </Button>
        </div>

        {/* Search box - always visible */}
        <div className="mb-4">
          <Label htmlFor="desktop-search" className="text-cosmetic-brown-300">搜索产品:</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cosmetic-brown-300 h-4 w-4" />
            <Input
              id="desktop-search"
              type="text"
              placeholder="搜索产品名称、编号等..."
              value={activeFilters.searchText || ""}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 border-cosmetic-brown-200 focus:border-cosmetic-gold-400"
            />
          </div>
        </div>

        {/* Expandable filter content */}
        {isExpanded && (
          <div className="space-y-4">
            {/* Stage filter */}
            <div>
              <Label htmlFor="desktop-stage" className="text-cosmetic-brown-300">生命阶段:</Label>
              <Select value={activeFilters.stage || "all"} onValueChange={handleStageChange}>
                <SelectTrigger className="mt-1 border-cosmetic-brown-200">
                  <SelectValue placeholder="选择阶段" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部阶段</SelectItem>
                  {TURTLE_STAGES.map(stage => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div>
              <Label htmlFor="desktop-status" className="text-cosmetic-brown-300">产品状态:</Label>
              <Select value={activeFilters.status || "all"} onValueChange={handleStatusChange}>
                <SelectTrigger className="mt-1 border-cosmetic-brown-200">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {PRODUCT_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price range filter */}
            <div>
              <Label className="text-cosmetic-brown-300">
                价格范围: ¥{activeFilters.priceRange?.min || 0} - ¥{activeFilters.priceRange?.max || 10000}
              </Label>
              <Slider
                min={0}
                max={10000}
                step={100}
                value={[activeFilters.priceRange?.min || 0, activeFilters.priceRange?.max || 10000]}
                onValueChange={handlePriceRangeChange}
                className="mt-2"
              />
            </div>

            {/* Sort options */}
            <div>
              <Label htmlFor="desktop-sort" className="text-cosmetic-brown-300">排序方式:</Label>
              <Select value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)}>
                <SelectTrigger className="mt-1 border-cosmetic-brown-200">
                  <SelectValue placeholder="选择排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">最新上架</SelectItem>
                  <SelectItem value="popular">最受欢迎</SelectItem>
                  <SelectItem value="price_low">价格从低到高</SelectItem>
                  <SelectItem value="price_high">价格从高到低</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear filters button */}
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                onClick={clearAllFilters}
                className="w-full border-cosmetic-brown-200 text-cosmetic-brown-500 hover:bg-cosmetic-beige-200"
              >
                清除所有筛选
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterSection;
