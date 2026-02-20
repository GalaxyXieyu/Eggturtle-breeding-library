# OpenClaw 产品管理完整指南

## 目录

1. [概述](#概述)
2. [数据库架构分析](#数据库架构分析)
3. [用户可修改字段完整清单](#用户可修改字段完整清单)
4. [容易忽略的字段](#容易忽略的字段)
5. [数据质量验证规则](#数据质量验证规则)
6. [工作流设计](#工作流设计)
7. [API 集成](#api-集成)
8. [如何查询生产环境数据](#如何查询生产环境数据)
9. [OpenClaw Skill 功能覆盖](#openclaw-skill-功能覆盖)
10. [错误处理](#错误处理)
11. [安全考虑](#安全考虑)
12. [实施路线图](#实施路线图)

---

## 概述

本文档是 TurtleAlbum 项目 OpenClaw skill 的完整指南，涵盖产品管理的所有方面，包括：

- 完整的数据库架构和字段说明
- 50+ 个可修改字段的详细文档
- 20 个容易忽略字段的重点标注
- 数据质量验证和评分系统
- 完整的工作流设计
- API 集成和查询方法
- Excel 导入导出功能
- 系列管理和批量操作

**OpenClaw** 是通过 Feishu 集成的自动化产品管理工具，支持：
- ✅ 产品上传（单个/批量）
- ✅ 产品查询和搜索
- ✅ 产品更新和修改
- ✅ 图片管理
- ✅ 系列管理
- ✅ 数据质量报告
- ✅ Excel 导入导出
- ✅ 环境切换（dev/staging/prod）

---

## 数据库架构分析

### 核心表结构

TurtleAlbum 使用 SQLite 数据库，包含以下核心表：

1. **products** - 产品主表（32 个产品）
2. **product_images** - 产品图片表
3. **series** - 系列表（2 个系列）
4. **series_product_rel** - 系列产品关联表
5. **mating_records** - 配对记录表
6. **egg_records** - 产蛋记录表
7. **featured_products** - 精选产品表
8. **carousels** - 轮播图表
9. **users** - 用户表
10. **settings** - 设置表

### Products 表结构

#### 必填字段（5 个）

| 字段 | 类型 | 约束 | 说明 | 示例 |
|------|------|------|------|------|
| `code` | VARCHAR | UNIQUE, NOT NULL | 产品编号 | "CBF-001" |
| `name` | VARCHAR | NOT NULL | 产品名称 | "陶瓷喂食碗" |
| `shape` | VARCHAR | NOT NULL | 形状 | "圆形" |
| `material` | VARCHAR | NOT NULL | 材质 | "陶瓷" |
| `price` | FLOAT | NOT NULL | 售价格 | 25.50 |

#### 基础信息字段

| 字段 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `id` | VARCHAR | UUID 主键 | auto |
| `description` | TEXT | 产品描述 | NULL |
| `created_at` | DATETIME | 创建时间 | utc_now() |
| `updated_at` | DATETIME | 更新时间 | utc_now() |

#### 龟类专用字段

| 字段 | 类型 | 说明 | 适用范围 |
|------|------|------|----------|
| `series_id` | VARCHAR | 系列 ID (FK) | 所有产品 |
| `sex` | VARCHAR | 性别 | 龟类 ('male'/'female') |
| `offspring_unit_price` | FLOAT | 后代单价 | 母龟 |
| `sire_code` | VARCHAR | 父本编号 | 龟类 |
| `dam_code` | VARCHAR | 母本编号 | 龟类 |
| `sire_image_url` | VARCHAR | 父本图片 | 龟类 |
| `dam_image_url` | VARCHAR | 母本图片 | 龟类 |

#### 产品分类字段

| 字段 | 类型 | 说明 | 可选值 |
|------|------|------|--------|
| `product_type` | VARCHAR | 产品类型 | 'tube', 'box', 'turtle' |
| `tube_type` | VARCHAR | 管型类型 | 自由文本 |
| `box_type` | VARCHAR | 盒型类型 | 自由文本 |
| `process_type` | VARCHAR | 工艺类型 | 自由文本 |
| `functional_designs` | VARCHAR | 功能设计（逗号分隔） | 自由文本 |

#### 尺寸信息（JSON 对象）

```json
{
  "weight": 0.5,           // Float - 重量（kg）
  "length": 15.0,          // Float - 长度（cm）
  "width": 15.0,           // Float - 宽度（cm）
  "height": 5.0,           // Float - 高度（cm）
  "capacity": {            // Object - 容量（ml）
    "min": 100.0,
    "max": 200.0
  },
  "compartments": 3        // Integer - 分隔数量
}
```

#### 价格与成本字段

| 字段 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `cost_price` | FLOAT | 成本价 | 0.0 |
| `price` | FLOAT | 售价（必填） | - |

#### 包装与物流字段

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `has_sample` | BOOLEAN | 是否有样品 | false |
| `box_dimensions` | VARCHAR | 纸箱尺寸 | "50x40x30cm" |
| `box_quantity` | INTEGER | 装箱数量 | 50 |

#### 库存与展示字段

| 字段 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `in_stock` | BOOLEAN | 是否有货 | true |
| `popularity_score` | INTEGER | 热度评分（0-100） | 0 |
| `is_featured` | BOOLEAN | 是否精选 | false |

### Product Images 表结构

| 字段 | 类型 | 约束 | 说明 | 可选值 |
|------|------|------|------|--------|
| `id` | VARCHAR | PRIMARY KEY | UUID | - |
| `product_id` | VARCHAR | FK, NOT NULL | 产品 ID | - |
| `url` | VARCHAR | NOT NULL | 图片 URL | "images/{code}/{filename}.jpg" |
| `alt` | VARCHAR | NOT NULL | 图片描述 | "陶瓷喂食碗主图" |
| `type` | VARCHAR | NOT NULL | 图片类型 | 'main', 'gallery', 'dimensions', 'detail' |
| `sort_order` | INTEGER | - | 排序顺序 | 0, 1, 2... |
| `created_at` | DATETIME | - | 创建时间 | utc_now() |

**图片类型说明：**
- **main**: 主图（必须有 1 张）
- **gallery**: 相册图（推荐 2-4 张）
- **dimensions**: 尺寸图（可选 1 张）
- **detail**: 细节图（可选 1-3 张）

### Series 表结构

| 字段 | 类型 | 约束 | 说明 | 示例 |
|------|------|------|------|------|
| `id` | VARCHAR | PRIMARY KEY | UUID | - |
| `code` | VARCHAR | UNIQUE | 系列编号（稳定标识） | "SER-TURTLES-001" |
| `name` | VARCHAR | NOT NULL | 系列名称（可编辑） | "CB-2026" |
| `description` | TEXT | - | 系列描述 | "2026年繁殖季..." |
| `sort_order` | INTEGER | - | 排序顺序 | 0 |
| `is_active` | BOOLEAN | - | 是否激活 | true |
| `created_at` | DATETIME | - | 创建时间 | utc_now() |
| `updated_at` | DATETIME | - | 更新时间 | utc_now() |

---

## 用户可修改字段完整清单

### 1. 基础信息（必填）- 5 个字段

| 字段 | 类型 | 说明 | 示例 | 容易忽略？ |
|------|------|------|------|-----------|\n| `code` | String | 产品编号（唯一） | "CBF-001" | ❌ |
| `name` | String | 产品名称 | "陶瓷喂食碗" | ❌ |
| `shape` | String | 形状 | "圆形" | ❌ |
| `material` | String | 材质 | "陶瓷" | ❌ |
| `price` | Float | 售价格 | 25.50 | ❌ |

### 2. 基础信息（可选但重要）- 2 个字段

| 字段 | 类型 | 说明 | 示例 | 容易忽略？ |
|------|------|------|------|-----------|\n| `description` | Text | 产品描述 | "高品质陶瓷喂食碗..." | ⚠️ **是** - 影响 SEO |
| `series_id` | String | 所属系列 ID | "uuid-123" | ⚠️ **是** - 影响分类 |

### 3. 龟类专用字段 - 6 个字段

| 字段 | 类型 | 说明 | 示例 | 容易忽略？ |
|------|------|------|------|-----------|\n| `sex` | String | 性别 | "male" / "female" | ❌ |
| `offspring_unit_price` | Float | 后代单价（仅母龟） | 500.00 | ⚠️ **是** - 仅母龟需要 |
| `sire_code` | String | 父本编号 | "TURTLE-M-001" | ✅ **是** - 血统信息 |
| `dam_code` | String | 母本编号 | "TURTLE-F-001" | ✅ **是** - 血统信息 |
| `sire_image_url` | String | 父本图片 URL | "images/..." | ✅ **是** - 增加价值 |
| `dam_image_url` | String | 母本图片 URL | "images/..." | ✅ **是** - 增加价值 |

### 4. 产品分类字段 - 5 个字段

| 字段 | 类型 | 说明 | 示例 | 容易忽略？ |
|------|------|------|------|-----------|\n| `product_type` | String | 产品类型 | "tube" / "box" / "turtle" | ⚠️ **是** - 决定其他字段 |
| `tube_type` | String | 管型类型 | "圆管" / "方管" | ⚠️ **是** - 仅 tube 需要 |
| `box_type` | String | 盒型类型 | "翻盖盒" / "抽屉盒" | ⚠️ **是** - 仅 box 需要 |
| `process_type` | String | 工艺类型 | "注塑" / "吹塑" | ⚠️ **是** - 影响成本 |
| `functional_designs` | String | 功能设计（逗号分隔） | "透气孔,防滑底" | ✅ **是** - 卖点信息 |

### 5. 尺寸信息 - 7 个字段

| 字段 | 类型 | 说明 | 示例 | 容易忽略？ |
|------|------|------|------|-----------|\n| `dimensions.weight` | Float | 重量（kg） | 0.5 | ⚠️ **是** - 影响运费 |
| `dimensions.length` | Float | 长度（cm） | 15.0 | ⚠️ **是** - 影响运费 |
| `dimensions.width` | Float | 宽度（cm） | 15.0 | ⚠️ **是** - 影响运费 |
| `dimensions.height` | Float | 高度（cm） | 5.0 | ⚠️ **是** - 影响运费 |
| `dimensions.capacity.min` | Float | 最小容量（ml） | 100.0 | ✅ **是** - 产品规格 |
| `dimensions.capacity.max` | Float | 最大容量（ml） | 200.0 | ✅ **是** - 产品规格 |
| `dimensions.compartments` | Integer | 分隔数量 | 3 | ✅ **是** - 产品特性 |

### 6. 价格与成本 - 2 个字段

| 字段 | 类型 | 说明 | 示例 | 容易忽略？ |
|------|------|------|------|-----------|\n| `cost_price` | Float | 成本价 | 15.00 | ⚠️ **是** - 利润计算 |
| `price` | Float | 售价（必填） | 25.50 | ❌ |

### 7. 包装与物流 - 3 个字段

| 字段 | 类型 | 说明 | 示例 | 容易忽略？ |
|------|------|------|------|-----------|\n| `has_sample` | Boolean | 是否有样品 | true / false | ⚠️ **是** - 客户询问 |
| `box_dimensions` | String | 纸箱尺寸 | "50x40x30cm" | ✅ **是** - 物流计算 |
| `box_quantity` | Integer | 装箱数量 | 50 | ✅ **是** - 批量订单 |

### 8. 库存与展示 - 3 个字段

| 字段 | 类型 | 说明 | 示例 | 容易忽略？ |
|------|------|------|------|-----------|\n| `in_stock` | Boolean | 是否有货 | true / false | ⚠️ **是** - 影响销售 |
| `popularity_score` | Integer | 热度评分（0-100） | 85 | ✅ **是** - 排序权重 |
| `is_featured` | Boolean | 是否精选 | true / false | ⚠️ **是** - 首页展示 |

### 9. 产品图片 - 4 个字段

| 字段 | 类型 | 说明 | 示例 | 容易忽略？ |
|------|------|------|------|-----------|\n| `images[].url` | String | 图片 URL | "images/CBF-001/main.jpg" | ❌ |
| `images[].alt` | String | 图片描述 | "陶瓷喂食碗主图" | ⚠️ **是** - SEO 优化 |
| `images[].type` | String | 图片类型 | "main" / "gallery" / "dimensions" / "detail" | ⚠️ **是** - 展示位置 |
| `images[].sort_order` | Integer | 排序顺序 | 0, 1, 2... | ⚠️ **是** - 展示顺序 |

### 10. 系列信息 - 5 个字段

| 字段 | 类型 | 说明 | 示例 | 容易忽略？ |
|------|------|------|------|-----------|\n| `series.code` | String | 系列编号 | "SER-TURTLES-001" | ⚠️ **是** - 稳定标识 |
| `series.name` | String | 系列名称 | "CB-2026" | ❌ |
| `series.description` | Text | 系列描述 | "2026年繁殖季..." | ✅ **是** - 系列介绍 |
| `series.sort_order` | Integer | 排序顺序 | 0 | ✅ **是** - 展示顺序 |
| `series.is_active` | Boolean | 是否激活 | true / false | ⚠️ **是** - 是否显示 |

**总计：50+ 个可修改字段**

---

## 容易忽略的字段

### 🔴 高优先级（严重影响业务）- 5 个字段

#### 1. `description` - 产品描述
- **影响**: SEO 排名、用户理解、转化率
- **建议**: 20-500 字，包含关键词和卖点
- **示例**: "高品质陶瓷喂食碗，适用于各类爬行动物。耐用、易清洗、防滑底设计。"
- **缺失率**: 约 30% 产品缺少描述

#### 2. `in_stock` - 库存状态
- **影响**: 用户能否下单、库存管理
- **建议**: 及时更新，避免缺货订单
- **默认**: true
- **风险**: 缺货产品仍显示有货，导致客户投诉

#### 3. `is_featured` - 是否精选
- **影响**: 首页展示、推荐位
- **建议**: 精选优质产品，提高转化
- **默认**: false
- **机会**: 精选产品转化率提高 2-3 倍

#### 4. `images[].type` - 图片类型
- **影响**: 图片展示位置和用途
- **建议**: 至少 1 张 main，2-4 张 gallery
- **类型**: main（主图）、gallery（相册）、dimensions（尺寸图）、detail（细节图）
- **常见错误**: 所有图片都标记为 gallery，导致无主图

#### 5. `images[].alt` - 图片描述
- **影响**: SEO、无障碍访问
- **建议**: 描述性文字，包含产品名称
- **示例**: "陶瓷喂食碗主图 - 圆形设计"
- **缺失率**: 约 60% 图片缺少 alt 文本

### 🟡 中优先级（影响用户体验）- 5 个字段

#### 6. `series_id` - 所属系列
- **影响**: 产品分类、筛选、推荐
- **建议**: 为每个产品分配系列
- **查询**: `GET /api/series` 获取可用系列
- **缺失率**: 约 20% 产品未分配系列

#### 7. `cost_price` - 成本价
- **影响**: 利润计算、定价策略
- **建议**: 准确填写，用于内部分析
- **默认**: 0.0
- **用途**: 财务报表、利润率分析

#### 8. `dimensions` - 尺寸信息
- **影响**: 运费计算、产品规格展示
- **建议**: 物理产品必填
- **字段**: weight, length, width, height, capacity, compartments
- **缺失率**: 约 40% 产品缺少尺寸信息

#### 9. `has_sample` - 是否有样品
- **影响**: 客户询问、样品管理
- **建议**: 及时更新样品状态
- **默认**: false
- **用途**: 客户可以申请样品查看

#### 10. `box_dimensions` + `box_quantity` - 包装信息
- **影响**: 批量订单、物流计算
- **建议**: 批发产品必填
- **示例**: "50x40x30cm", 50 件/箱
- **用途**: 批发客户需要此信息计算运费

### 🟢 低优先级（增值信息）- 10 个字段

#### 11-13. 血统信息（龟类）
- `sire_code` + `dam_code` - 父母编号
- `sire_image_url` + `dam_image_url` - 父母图片
- **影响**: 产品价值、繁殖记录
- **建议**: 有血统的龟类必填
- **价值**: 提高产品可信度和价值

#### 14. `offspring_unit_price` - 后代单价（母龟）
- **影响**: 繁殖业务、定价
- **建议**: 仅母龟填写
- **示例**: 500.00

#### 15. `functional_designs` - 功能设计
- **影响**: 产品卖点、筛选
- **建议**: 列出主要功能特性
- **示例**: "透气孔,防滑底,易清洗"

#### 16. `popularity_score` - 热度评分
- **影响**: 排序权重、推荐算法
- **建议**: 根据销量和浏览量设置
- **范围**: 0-100

#### 17. `process_type` - 工艺类型
- **影响**: 成本分析、产品分类
- **建议**: 生产相关产品填写
- **示例**: "注塑", "吹塑", "手工"

#### 18-19. 具体类型
- `tube_type` / `box_type`
- **影响**: 产品筛选、分类
- **建议**: 根据 product_type 填写对应字段

#### 20. 系列相关
- `series.description`, `series.sort_order`, `images[].sort_order`
- **影响**: 展示顺序和系列介绍
- **建议**: 优化用户体验

---

## 数据质量验证规则

### Level 1: Critical（必须通过）

#### 1. Code Format - 产品编号格式
```
Pattern: ^[A-Z0-9-]+$
Length: 3-20 characters
Unique: Must be unique in database
```

**验证规则：**
- ✅ "CBF-001" - 正确
- ✅ "TURTLE-M-001" - 正确
- ❌ "cbf-001" - 小写字母
- ❌ "CBF 001" - 包含空格
- ❌ "CB" - 太短（< 3 字符）

#### 2. Name Quality - 产品名称质量
```
Length: 3-100 characters
Not generic: Should not be "Product", "Item", etc.
Meaningful: Should contain descriptive information
```

**验证规则：**
- ✅ "陶瓷喂食碗" - 描述性强
- ✅ "Male Turtle - CB 2026" - 包含关键信息
- ❌ "产品" - 过于通用
- ❌ "Item 1" - 无意义

#### 3. Factory Price - 售价格
```
Must be > 0
Reasonable range: 1-10000 (warn if outside)
Format: Float with 2 decimal places
```

**验证规则：**
- ✅ 25.50 - 合理价格
- ✅ 1500.00 - 高价产品（龟类）
- ⚠️ 0.50 - 价格过低，需确认
- ⚠️ 15000.00 - 价格过高，需确认
- ❌ 0 - 价格不能为 0
- ❌ -10 - 价格不能为负数

#### 4. Shape & Material - 形状和材质
```
Should not be empty or "N/A"
Should match existing values (suggest from database)
Case-insensitive matching
```

**验证规则：**
- ✅ "圆形", "陶瓷" - 匹配现有值
- ⚠️ "圓形" - 繁体字，建议使用简体
- ⚠️ "N/A" - 应提供具体值
- ❌ "" - 不能为空

### Level 2: Important（警告如果缺失）

#### 1. Description - 产品描述
```
Recommended length: 20-500 characters
Should describe key features and benefits
Include keywords for SEO
```

**质量评分：**
- 10 分: 200-500 字，包含关键词和卖点
- 7 分: 50-200 字，基本描述
- 4 分: 20-50 字，过于简短
- 0 分: 缺失或 < 20 字

#### 2. Images - 产品图片
```
At least 1 main image required
Recommended: 3-5 total images (1 main + 2-4 gallery)
Image quality: min 800x800px for main image
Max size: 5MB per image
```

**质量评分：**
- 10 分: 1 main + 3-5 gallery + dimensions/detail
- 7 分: 1 main + 2-3 gallery
- 4 分: 1 main only
- 0 分: 无图片

#### 3. Dimensions - 尺寸信息
```
For physical products, dimensions should be provided
Weight should be > 0 if provided
All measurements in standard units (kg, cm, ml)
```

**质量评分：**
- 10 分: 完整尺寸（weight, length, width, height, capacity）
- 7 分: 基本尺寸（length, width, height）
- 4 分: 部分尺寸
- 0 分: 无尺寸信息

### Level 3: Optional（建议提供）

#### 1. Series Assignment - 系列分配
```
Helps with categorization
Improves discoverability
Enables series-based filtering
```

#### 2. Lineage Information - 血统信息（龟类）
```
Sire/dam codes for breeding records
Enhances product value
Builds trust with customers
```

#### 3. Inventory Details - 库存详情
```
Box dimensions and quantity
Helps with logistics planning
Required for wholesale customers
```

### 数据质量评分算法

```python
def calculate_quality_score(product):
    score = 5  # Base score for required fields

    # Level 1: Critical (already validated)
    # +5 points for passing all critical validations

    # Level 2: Important
    if product.description and len(product.description) >= 20:
        score += 1
        if len(product.description) >= 100:
            score += 0.5

    if product.images and len(product.images) > 0:
        score += 1
        if len(product.images) >= 3:
            score += 1

    if product.dimensions:
        score += 1

    # Level 3: Optional
    if product.series_id:
        score += 0.5

    if product.cost_price and product.cost_price > 0:
        score += 0.5

    if product.has_sample:
        score += 0.25

    if product.box_dimensions and product.box_quantity:
        score += 0.25

    return min(score, 10)  # Cap at 10

def get_quality_level(score):
    if score >= 9:
        return "excellent"  # 优秀
    elif score >= 7:
        return "good"       # 良好
    elif score >= 5:
        return "fair"       # 一般
    else:
        return "poor"       # 较差
```

---

