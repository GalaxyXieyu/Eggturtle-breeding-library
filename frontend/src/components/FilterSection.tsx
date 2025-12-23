import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, X, Search } from "lucide-react";
import { FilterOptions, SortOption } from "@/types/cosmetics";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFilterOptions } from "@/hooks/useProducts";

type GroupedData = Record<string, string[]>;

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

  // 获取动态筛选器选项
  const { data: dynamicFilterOptions, isLoading: filterOptionsLoading, error: filterOptionsError } = useFilterOptions();

  const normalizeGroupedData = (value: unknown): GroupedData => {
    if (Array.isArray(value)) {
      const items = value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
      return items.length ? { 全部: items } : {};
    }
    if (!value || typeof value !== "object") return {};

    const result: GroupedData = {};
    for (const [groupName, groupItems] of Object.entries(value as Record<string, unknown>)) {
      if (Array.isArray(groupItems)) {
        const items = groupItems.filter((v): v is string => typeof v === "string" && v.trim() !== "");
        if (items.length) result[groupName] = items;
        continue;
      }
      if (typeof groupItems === "string" && groupItems.trim() !== "") {
        result[groupName] = [groupItems];
      }
    }
    return result;
  };

  // Auto-collapse filter content when it becomes sticky
  useEffect(() => {
    if (isSticky && isExpanded) {
      setIsExpanded(false);
    }
  }, [isSticky, isExpanded]);

  // Count active filters
  const countActiveFilters = () => {
    let count = 0;
    if (activeFilters.tubeTypes?.length) count += activeFilters.tubeTypes.length;
    if (activeFilters.boxTypes?.length) count += activeFilters.boxTypes.length;
    if (activeFilters.functionalDesigns?.length) count += activeFilters.functionalDesigns.length;
    if (activeFilters.shapes?.length) count += activeFilters.shapes.length;
    if (activeFilters.materials?.length) count += activeFilters.materials.length;
    if (activeFilters.capacityRange) count += 1;
    if (activeFilters.compartmentRange) count += 1;
    if (activeFilters.searchText?.trim()) count += 1;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  // Handle search text changes
  const handleSearchChange = (value: string) => {
    onFilterChange({
      ...activeFilters,
      searchText: value
    });
  };

  // 通用的筛选器处理函数
  const handleFilterChange = (filterType: keyof FilterOptions, value: string, checked: boolean) => {
    const currentValues = (activeFilters[filterType] as string[]) || [];
    let updatedValues: string[];

    if (checked) {
      updatedValues = [...currentValues, value];
    } else {
      updatedValues = currentValues.filter(item => item !== value);
    }

    onFilterChange({
      ...activeFilters,
      [filterType]: updatedValues
    });
  };

  // Handle capacity range changes
  const handleCapacityChange = (values: number[]) => {
    onFilterChange({
      ...activeFilters,
      capacityRange: {
        min: values[0],
        max: values[1]
      }
    });
  };

  // Handle compartment range changes
  const handleCompartmentChange = (values: number[]) => {
    onFilterChange({
      ...activeFilters,
      compartmentRange: {
        min: values[0],
        max: values[1]
      }
    });
  };

  // 渲染分组筛选器
  const renderGroupedFilter = (title: string, groupedData: GroupedData, filterType: keyof FilterOptions) => {
    if (!groupedData || Object.keys(groupedData).length === 0) return null;

    return (
      <div>
        <h3 className="text-base font-medium mb-2 text-cosmetic-brown-400">{title}</h3>
        <div className="space-y-3">
          {Object.entries(groupedData).map(([groupName, items]) => (
            <div key={groupName}>
              <h4 className="text-sm font-medium text-cosmetic-brown-300 mb-1">{groupName}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 ml-2">
                {items.map(item => (
                  <div key={item} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${filterType}-${item}`}
                      checked={(activeFilters[filterType] as string[] || []).includes(item)}
                      onCheckedChange={(checked) => handleFilterChange(filterType, item, !!checked)}
                    />
                    <Label htmlFor={`${filterType}-${item}`} className="text-sm text-cosmetic-brown-300 cursor-pointer">
                      {item}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (filterOptionsLoading) {
    return <div className="p-4 text-center">正在加载筛选器...</div>;
  }

  if (!dynamicFilterOptions) {
    return <div className="p-4 text-center text-red-500">筛选器数据加载失败，请刷新页面重试</div>;
  }

  if (filterOptionsError) {
    return <div className="p-4 text-center text-red-500">筛选器数据加载失败，请刷新页面重试</div>;
  }

  const tubeTypeGroups = normalizeGroupedData((dynamicFilterOptions as unknown as Record<string, unknown>).tubeTypes);
  const boxTypeGroups = normalizeGroupedData((dynamicFilterOptions as unknown as Record<string, unknown>).boxTypes);
  const functionalDesignGroups = normalizeGroupedData((dynamicFilterOptions as unknown as Record<string, unknown>).functionalDesigns);
  const shapeGroups = normalizeGroupedData((dynamicFilterOptions as unknown as Record<string, unknown>).shapes);

  const materials = Array.isArray((dynamicFilterOptions as unknown as Record<string, unknown>).materials)
    ? ((dynamicFilterOptions as unknown as Record<string, unknown>).materials as string[]).filter(
        (v): v is string => typeof v === "string" && v.trim() !== ""
      )
    : [];

  // 安全的范围数据
  const capacityRange =
    (dynamicFilterOptions as unknown as Record<string, unknown>).capacityRange &&
    typeof (dynamicFilterOptions as unknown as Record<string, unknown>).capacityRange === "object"
      ? ((dynamicFilterOptions as unknown as Record<string, unknown>).capacityRange as { min: number; max: number })
      : { min: 0, max: 100 };
  const compartmentRange =
    (dynamicFilterOptions as unknown as Record<string, unknown>).compartmentRange &&
    typeof (dynamicFilterOptions as unknown as Record<string, unknown>).compartmentRange === "object"
      ? ((dynamicFilterOptions as unknown as Record<string, unknown>).compartmentRange as { min: number; max: number })
      : { min: 1, max: 10 };

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
                  placeholder="搜索产品名称、材质、形状等..."
                  value={activeFilters.searchText || ""}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 border-cosmetic-beige-300"
                />
              </div>
            </div>

            {/* Sort dropdown */}
            <div className="mb-4">
              <Label htmlFor="sort" className="text-cosmetic-brown-300">排序方式:</Label>
              <Select onValueChange={value => onSortChange(value as SortOption)} value={sortOption}>
                <SelectTrigger className="w-full border-cosmetic-beige-300 mt-1">
                  <SelectValue placeholder="选择排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">最新上架</SelectItem>
                  <SelectItem value="popular">人气优先</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear filters button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFilterChange({})}
              className={`w-full mb-4 border-cosmetic-beige-300 text-cosmetic-brown-300 hover:bg-cosmetic-beige-200 ${activeFilterCount === 0 ? 'opacity-50' : ''}`}
              disabled={activeFilterCount === 0}
            >
              清除筛选
            </Button>

            <div className="space-y-6 mt-4">
              {/* 分组筛选器 */}
              {dynamicFilterOptions && (
                <>
                  {renderGroupedFilter("管类", tubeTypeGroups, "tubeTypes")}
                  {renderGroupedFilter("盒类", boxTypeGroups, "boxTypes")}
                  {renderGroupedFilter("功能设计", functionalDesignGroups, "functionalDesigns")}
                  {renderGroupedFilter("形状", shapeGroups, "shapes")}

                  {/* 材质 */}
                  <div>
                    <h3 className="text-base font-medium mb-2 text-cosmetic-brown-400">材质</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {materials.map(material => (
                        <div key={material} className="flex items-center space-x-2">
                          <Checkbox
                            id={`material-${material}`}
                            checked={(activeFilters.materials || []).includes(material)}
                            onCheckedChange={(checked) => handleFilterChange("materials", material, !!checked)}
                          />
                          <Label htmlFor={`material-${material}`} className="text-sm text-cosmetic-brown-300 cursor-pointer">
                            {material}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 滑块部分 */}
              <div>
                {/* 容量 */}
                <div className="mb-4">
                  <h3 className="text-base font-medium mb-2 text-cosmetic-brown-400">容量 (ml)</h3>
                  <Slider
                    defaultValue={[capacityRange.min, capacityRange.max]}
                    min={capacityRange.min}
                    max={capacityRange.max}
                    step={1}
                    onValueChange={handleCapacityChange}
                    value={[activeFilters.capacityRange?.min || capacityRange.min, activeFilters.capacityRange?.max || capacityRange.max]}
                    className="mb-1"
                  />
                  <div className="flex justify-between text-xs text-cosmetic-brown-300 mt-1">
                    <span>{activeFilters.capacityRange?.min || capacityRange.min} ml</span>
                    <span>{activeFilters.capacityRange?.max || capacityRange.max} ml</span>
                  </div>
                </div>

                {/* 内格数 */}
                <div>
                  <h3 className="text-base font-medium mb-2 text-cosmetic-brown-400">内格数</h3>
                  <Slider
                    defaultValue={[compartmentRange.min, compartmentRange.max]}
                    min={compartmentRange.min}
                    max={compartmentRange.max}
                    step={1}
                    onValueChange={handleCompartmentChange}
                    value={[activeFilters.compartmentRange?.min || compartmentRange.min, activeFilters.compartmentRange?.max || compartmentRange.max]}
                    className="mb-1"
                  />
                  <div className="flex justify-between text-xs text-cosmetic-brown-300 mt-1">
                    <span>{activeFilters.compartmentRange?.min || compartmentRange.min} 格</span>
                    <span>{activeFilters.compartmentRange?.max || compartmentRange.max} 格</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-20"></div> {/* Spacer for bottom fixed button */}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-cosmetic-beige-100 border-t border-cosmetic-beige-200">
              <Button
                className="w-full bg-cosmetic-gold-400 hover:bg-cosmetic-gold-500 text-white"
                onClick={onMobileFilterClose}
              >
                应用筛选
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={`bg-cosmetic-beige-100 px-4 py-2 ${className} w-full transition-all duration-300`}>
      <div className="container mx-auto">
        {/* Header section with title, search box and controls */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h2 className={`text-xl font-serif text-cosmetic-brown-500 flex items-center ${isSticky ? 'md:text-lg' : 'md:text-2xl'}`}>
            筛选产品
            {activeFilterCount > 0 && (
              <span className="ml-2 bg-cosmetic-gold-400 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </h2>

          <div className="flex items-center gap-4">
            {/* Search box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cosmetic-brown-300 h-4 w-4" />
              <Input
                type="text"
                placeholder="搜索产品..."
                value={activeFilters.searchText || ""}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 border-cosmetic-beige-300 w-48"
              />
            </div>

            {/* Sort and clear controls */}
            <div className="flex items-center gap-2">
              <Label htmlFor="sort" className="text-cosmetic-brown-300 whitespace-nowrap">排序方式:</Label>
              <Select onValueChange={value => onSortChange(value as SortOption)} value={sortOption}>
                <SelectTrigger className="w-[120px] md:w-[140px] border-cosmetic-beige-300">
                  <SelectValue placeholder="选择排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">最新上架</SelectItem>
                  <SelectItem value="popular">人气优先</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onFilterChange({})}
              className={`border-cosmetic-beige-300 text-cosmetic-brown-300 hover:bg-cosmetic-beige-200 ${activeFilterCount === 0 ? 'opacity-50' : ''}`}
              disabled={activeFilterCount === 0}
            >
              清除筛选
            </Button>
          </div>
        </div>

        {/* Filter content area */}
        <div className={`filter-content pt-2`}>
          <div className="space-y-6 animate-fade-in">
            {/* 分组筛选器 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {dynamicFilterOptions && (
                <>
                  {renderGroupedFilter("管类", tubeTypeGroups, "tubeTypes")}
                  {renderGroupedFilter("盒类", boxTypeGroups, "boxTypes")}
                  {renderGroupedFilter("功能设计", functionalDesignGroups, "functionalDesigns")}
                  {renderGroupedFilter("形状", shapeGroups, "shapes")}
                </>
              )}
            </div>

            {/* 材质和滑块 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 材质 */}
              {dynamicFilterOptions && (
                <div>
                  <h3 className="text-base font-medium mb-2 text-cosmetic-brown-400">材质</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                    {materials.map(material => (
                      <div key={material} className="flex items-center space-x-2">
                        <Checkbox
                          id={`material-${material}`}
                          checked={(activeFilters.materials || []).includes(material)}
                          onCheckedChange={(checked) => handleFilterChange("materials", material, !!checked)}
                        />
                        <Label htmlFor={`material-${material}`} className="text-sm text-cosmetic-brown-300 cursor-pointer">
                          {material}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 容量 */}
              <div>
                <h3 className="text-base font-medium mb-2 text-cosmetic-brown-400">容量 (ml)</h3>
                <Slider
                  defaultValue={[capacityRange.min, capacityRange.max]}
                  min={capacityRange.min}
                  max={capacityRange.max}
                  step={1}
                  onValueChange={handleCapacityChange}
                  value={[activeFilters.capacityRange?.min || capacityRange.min, activeFilters.capacityRange?.max || capacityRange.max]}
                  className="mb-1"
                />
                <div className="flex justify-between text-xs text-cosmetic-brown-300 mt-1">
                  <span>{activeFilters.capacityRange?.min || capacityRange.min} ml</span>
                  <span>{activeFilters.capacityRange?.max || capacityRange.max} ml</span>
                </div>
              </div>

              {/* 内格数 */}
              <div>
                <h3 className="text-base font-medium mb-2 text-cosmetic-brown-400">内格数</h3>
                <Slider
                  defaultValue={[compartmentRange.min, compartmentRange.max]}
                  min={compartmentRange.min}
                  max={compartmentRange.max}
                  step={1}
                  onValueChange={handleCompartmentChange}
                  value={[activeFilters.compartmentRange?.min || compartmentRange.min, activeFilters.compartmentRange?.max || compartmentRange.max]}
                  className="mb-1"
                />
                <div className="flex justify-between text-xs text-cosmetic-brown-300 mt-1">
                  <span>{activeFilters.compartmentRange?.min || compartmentRange.min} 格</span>
                  <span>{activeFilters.compartmentRange?.max || compartmentRange.max} 格</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FilterSection;
