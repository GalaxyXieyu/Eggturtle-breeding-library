// 乌龟生命阶段选项
export const TURTLE_STAGES = [
  { value: "egg", label: "蛋期" },
  { value: "hatchling", label: "幼体" },
  { value: "juvenile", label: "亚成体" },
  { value: "adult", label: "成体" },
  { value: "breeding", label: "繁育中" },
  { value: "unknown", label: "未知" }
];

// 产品状态选项
export const PRODUCT_STATUSES = [
  { value: "draft", label: "草稿" },
  { value: "active", label: "在售" },
  { value: "reserved", label: "已预订" },
  { value: "sold", label: "已售出" }
];

// 获取阶段的中文标签
export const getStageLabel = (stage: string): string => {
  const found = TURTLE_STAGES.find(s => s.value === stage);
  return found ? found.label : stage;
};

// 获取状态的中文标签
export const getStatusLabel = (status: string): string => {
  const found = PRODUCT_STATUSES.find(s => s.value === status);
  return found ? found.label : status;
};

// 后备筛选器选项 - 实际筛选器选项应从API获取
// Fallback filter options - actual filter options should be fetched from API
export const filterOptions = {
  developmentLineMaterials: ["注塑/吹瓶", "工艺注塑", "吹瓶"]
};

// 注意：前端应该优先使用从 productService.getFilterOptions() 获取的动态数据
// Note: Frontend should prioritize dynamic data from productService.getFilterOptions()
