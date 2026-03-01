// 乌龟生命阶段选项
export const TURTLE_STAGES = [
  { value: "egg", label: "蛋期" },
  { value: "hatchling", label: "幼体" },
  { value: "juvenile", label: "亚成体" },
  { value: "adult", label: "成体" },
  { value: "breeding", label: "繁育中" }
];

// 产品状态选项
export const PRODUCT_STATUSES = [
  { value: "active", label: "在售" },
  { value: "reserved", label: "已预订" },
  { value: "sold", label: "已售出" }
];

const LEGACY_STAGE_VALUE_MAP: Record<string, string> = {
  unknown: "hatchling",
};

const LEGACY_STATUS_VALUE_MAP: Record<string, string> = {
  draft: "active",
};

// 兼容历史值：不再展示 unknown/draft，但编辑旧数据时自动归一化到可选值。
export const normalizeStageValue = (stage?: string | null): string => {
  if (!stage) return "hatchling";
  const normalized = LEGACY_STAGE_VALUE_MAP[stage] || stage;
  return TURTLE_STAGES.some((item) => item.value === normalized) ? normalized : "hatchling";
};

export const normalizeStatusValue = (status?: string | null): string => {
  if (!status) return "active";
  const normalized = LEGACY_STATUS_VALUE_MAP[status] || status;
  return PRODUCT_STATUSES.some((item) => item.value === normalized) ? normalized : "active";
};

// 获取阶段的中文标签
export const getStageLabel = (stage: string): string => {
  const normalized = normalizeStageValue(stage);
  const found = TURTLE_STAGES.find(s => s.value === normalized);
  return found ? found.label : stage;
};

// 获取状态的中文标签
export const getStatusLabel = (status: string): string => {
  const normalized = normalizeStatusValue(status);
  const found = PRODUCT_STATUSES.find(s => s.value === normalized);
  return found ? found.label : status;
};

// 后备筛选器选项 - 实际筛选器选项应从API获取
// Fallback filter options - actual filter options should be fetched from API
export const filterOptions = {
  developmentLineMaterials: ["注塑/吹瓶", "工艺注塑", "吹瓶"]
};

// 注意：前端应该优先使用从 productService.getFilterOptions() 获取的动态数据
// Note: Frontend should prioritize dynamic data from productService.getFilterOptions()
