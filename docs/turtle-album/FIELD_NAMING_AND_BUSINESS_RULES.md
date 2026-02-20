# Turtle Album 字段命名与业务规则规范（插件对接版）

> 适用范围：`/api/products`、`/api/breeders`、`/api/series`、`/api/admin/*`
> 
> 最后更新：2026-02-20

## 1. 统一命名规范

### 1.1 写入请求（Create/Update）
- **统一使用 snake_case**。
- Product 写入接口（`/api/products` POST/PUT）仅接受 schema 中声明字段，额外字段会被拒绝（422）。
- 重点：血缘字段只认 `sire_code` / `dam_code`，不再接受 `sireCode` / `damCode`。

### 1.2 读取响应（Public/Admin Response）
- 以历史兼容为前提，响应主体大多是 **camelCase**。
- 例外：`images[].sort_order` 目前仍是 snake_case（历史字段，前端已适配）。

### 1.3 查询参数（Query）
- 统一使用 snake_case（例如 `series_id`、`price_min`、`price_max`）。

---

## 2. 核心实体字段字典

### 2.1 Product / Breeder（同一张 `products` 表）

> 说明：Breeder 本质是 Product 子集，判定条件为 `series_id != null && sex != null`。

| 业务含义 | DB 字段 | 写入字段（请求） | 读取字段（响应） | 必填/默认 | 说明 |
|---|---|---|---|---|---|
| ID | `id` | - | `id` | 系统生成 | UUID |
| 名称 | `name` | `name` | `name` | 必填 | - |
| 编号 | `code` | `code` | `code` | 必填，唯一 | 建议当业务主键使用 |
| 备注/描述 | `description` | `description` | `description` | 可空 | 不承载结构化父母本 |
| 生命周期阶段 | `stage` | `stage` | `stage` | 默认 `hatchling` | 枚举值见第 3 节 |
| 业务状态 | `status` | `status` | `status` | 默认 `active` | 枚举值见第 3 节 |
| 系列 ID | `series_id` | `series_id` | `seriesId` | 可空 | Breeder 必填 |
| 性别 | `sex` | `sex` | `sex` | 可空 | `male` / `female` |
| 子代单价 | `offspring_unit_price` | `offspring_unit_price` | `offspringUnitPrice` | 可空 | 仅允许母本 |
| 父本编号 | `sire_code` | `sire_code` | `sireCode` | 可空 | 结构化字段 |
| 母本编号 | `dam_code` | `dam_code` | `damCode` | 可空 | 结构化字段 |
| 父本图 | `sire_image_url` | `sire_image_url` | `sireImageUrl` | 可空 | 路径会做规范化 |
| 母本图 | `dam_image_url` | `dam_image_url` | `damImageUrl` | 可空 | 路径会做规范化 |
| 成本价 | `cost_price` | `cost_price` | `pricing.costPrice` | 默认 0 | - |
| 售价 | `price` | `price` | `pricing.price` | 默认 0 | 允许“非售卖”场景 |
| 有样品 | `has_sample` | `has_sample` | `pricing.hasSample` | 默认 false | - |
| 库存状态 | `in_stock` | `in_stock` | `inStock` | 默认 true | - |
| 热度 | `popularity_score` | `popularity_score` | `popularityScore` | 默认 0 | - |
| 精选 | `is_featured` | `is_featured` | `isFeatured` | 默认 false | - |
| 创建时间 | `created_at` | - | `createdAt` | 系统生成 | ISO 时间 |
| 更新时间 | `updated_at` | - | `updatedAt` | 系统生成 | ISO 时间 |

### 图片（`product_images`）
- 写入：`images[].{url, alt, type, sort_order}`（创建时）
- 读取：`images[].{id, url, alt, type, sort_order}`

---

### 2.2 Series

| 场景 | 写入字段 | 读取字段 |
|---|---|---|
| Admin Create/Update | `code`, `name`, `description`, `sort_order`, `is_active` | `id`, `code`, `name`, `description`, `sortOrder`, `isActive`, `createdAt`, `updatedAt` |
| Public List | 无写入 | `id`, `name`, `sortOrder`, `description`, `isActive`, `createdAt`, `updatedAt` |

---

### 2.3 记录实体（Mating/Egg）

### 交配记录
- 写入（Admin）：`female_id`, `male_id`, `mated_at`, `notes`
- 读取：`femaleId`, `maleId`, `matedAt`, `notes`, `createdAt`

### 下蛋记录
- 写入（Admin）：`female_id`, `laid_at`, `count`, `notes`
- 读取：`femaleId`, `laidAt`, `count`, `notes`, `createdAt`

---

## 3. 业务规则（强约束）

### 3.1 stage/status
- `stage` 默认值：`hatchling`
- `status` 默认值：`active`
- `status` 合法值：`draft | active | reserved | sold`
- 前端展示中文仅是 UI 标签映射，不改变 API 存储值。

### 3.2 血缘字段
- 结构化关系只看 `sire_code` / `dam_code`。
- 详情页“父本/母本”按钮逻辑依赖该结构化字段；备注文本不参与跳转。

### 3.3 更新约束
- 空更新请求会直接报错：`400 No valid fields to update`。
- `offspring_unit_price` 仅允许 female；非 female 会报 400。
- 更新时若把 `sex` 改为非 female，会自动清空 `offspring_unit_price`。
- `price` 显式传 `null` 时会落库为 `0.0`（兼容非售卖记录）。

### 3.4 精确定位约束
- 父母本跳转使用精确接口：`GET /api/breeders/by-code/{code}`。
- 禁止用模糊 search 的第一条结果做写入目标。
- 插件更新建议：**先拿 id，再按 id 更新，再读回校验**。

---

## 4. 插件对接最小契约

### 4.1 创建（Admin）
`POST /api/products`

```json
{
  "name": "白化-1",
  "code": "白化-1",
  "description": "...",
  "stage": "hatchling",
  "status": "active",
  "series_id": "<series-id>",
  "sex": "female",
  "sire_code": "F",
  "dam_code": null,
  "price": 0,
  "in_stock": true,
  "images": []
}
```

### 4.2 更新父母本（Admin）
`PUT /api/products/{id}`

```json
{
  "sire_code": "F",
  "dam_code": null
}
```

> 不要发送 `sireCode` / `damCode`，会被 422 拒绝。

### 4.3 读回校验（Public）
1. `GET /api/products/{id}` 或 `GET /api/breeders/{id}`
2. 校验响应里的 `sireCode/damCode`
3. 如需跳转目标，调用 `GET /api/breeders/by-code/{code}` 拿精确 id

---

## 5. 错误码语义（对接侧必须处理）

| 状态码 | 典型场景 | 建议处理 |
|---|---|---|
| 400 | 业务规则冲突（如空更新、编号重复、性别规则冲突） | 直接提示业务错误，不重试 |
| 401/403 | 鉴权失败 | 刷新登录态或更换 token |
| 404 | 记录不存在 | 提示数据不存在并终止流程 |
| 422 | 字段名/类型不合法（如 camelCase 写入） | 修正 payload 命名后重试 |
| 500 | 服务端异常 | 记录请求上下文并告警 |

---

## 6. 本次问题的根因与修复原则

### 根因
1. 用“模糊搜索结果第一条”做更新对象，容易打错记录。
2. 备注里的“父本/母本”文本与结构化字段脱节，造成“看起来改了，按钮仍未知”。
3. 字段命名混用（camel/snake）导致部分写入不生效或被拒绝。

### 修复原则
1. 只使用一个写入规范：snake_case。
2. 先精确定位 id，再更新，再接口读回校验。
3. 备注与结构化字段职责分离，父母本关系只走 `sire_code/dam_code`。

---

## 7. 代码落点（实现依据）

- 写入 schema 与字段限制：`backend/app/schemas/schemas.py`
- 产品增改与空更新保护：`backend/app/api/routers/admin.py`
- 响应字段映射（snake->camel）：`backend/app/api/utils.py`
- 父母本精确查询接口：`backend/app/api/routers/breeders.py`
- 默认值迁移：`backend/app/db/migrations.py`
- Alembic 基线默认值：`backend/alembic/versions/20260220_0001_baseline_schema.py`
- 前端 stage/status 中文映射：`frontend/src/constants/filterOptions.ts`
