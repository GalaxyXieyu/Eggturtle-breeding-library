# API Overview（接口一览，按功能分组）

更新日期：2026-02-26

说明：本文为“现有系统（Legacy: FastAPI）”的接口清单，用于重构期做功能对齐。

- Base URL（dev）：`http://localhost:8000`
- Swagger：`GET /docs`
- Health：`GET /health`

Auth 说明（Legacy）：当前为 admin username/password 登录，返回 JWT token；多数 public 接口不要求登录，admin 接口需要。

## 1) Auth

| Method | Path | 用途 | 需要登录 |
|---|---|---|---|
| POST | /api/auth/login | admin 登录 | 否 |
| POST | /api/auth/logout | admin 登出（当前 token） | 是 |
| GET | /api/auth/verify | 校验 token | 是 |

## 2) Products（公共）

| Method | Path | 用途 | 需要登录 |
|---|---|---|---|
| GET | /api/products | 产品列表（分页/筛选/排序） | 否 |
| GET | /api/products/{product_id} | 产品详情 | 否 |
| GET | /api/products/featured | 精选产品（fallback） | 否 |
| GET | /api/products/filter-options | 过滤项（目前主要是价格范围） | 否 |

## 3) Products（后台管理：admin.py，prefix 仍是 /api/products）

| Method | Path | 用途 | 需要登录 |
|---|---|---|---|
| POST | /api/products | 创建产品 | 是 |
| PUT | /api/products/{product_id} | 更新产品 | 是 |
| DELETE | /api/products/{product_id} | 删除产品 | 是 |
| POST | /api/products/{product_id}/images | 追加上传图片（不替换全量） | 是 |
| DELETE | /api/products/{product_id}/images/{image_id} | 删除单张图片 | 是 |
| PUT | /api/products/{product_id}/images/{image_id}/set-main | 设为主图 | 是 |
| PUT | /api/products/{product_id}/images/reorder | 图片重排 | 是 |

## 4) Imports（批量导入）

| Method | Path | 用途 | 需要登录 |
|---|---|---|---|
| GET | /api/products/batch-import/template | 下载 Excel 模板 | 是（建议） |
| POST | /api/products/batch-import | 批量导入 | 是 |

## 5) Series

| Method | Path | 用途 | 需要登录 |
|---|---|---|---|
| GET | /api/series | 系列列表 | 否 |

## 6) Breeders（公共聚合视图）

| Method | Path | 用途 | 需要登录 |
|---|---|---|---|
| GET | /api/breeders | 种龟列表（聚合/筛选） | 否 |
| GET | /api/breeders/by-code/{code} | 按编号查询种龟（常用于跳转） | 否 |
| GET | /api/breeders/{breeder_id} | 种龟详情 | 否 |
| GET | /api/breeders/{breeder_id}/records | 种龟记录（旧 records） | 否 |
| GET | /api/breeders/{breeder_id}/events | 种龟事件时间线（breeder_events） | 否 |
| GET | /api/breeders/{breeder_id}/mate-load | 配偶负载/关联信息 | 否 |
| GET | /api/breeders/{breeder_id}/family-tree | 族谱（family tree） | 否 |

## 7) Admin Series

| Method | Path | 用途 | 需要登录 |
|---|---|---|---|
| GET | /api/admin/series | 系列列表（后台） | 是 |
| POST | /api/admin/series | 创建系列 | 是 |
| PUT | /api/admin/series/{series_id} | 更新系列 | 是 |
| DELETE | /api/admin/series/{series_id} | 删除系列 | 是 |

## 8) Admin Records / Events

| Method | Path | 用途 | 需要登录 |
|---|---|---|---|
| POST | /api/admin/mating-records | 新增交配记录 | 是 |
| DELETE | /api/admin/mating-records/{record_id} | 删除交配记录 | 是 |
| POST | /api/admin/egg-records | 新增产蛋记录 | 是 |
| DELETE | /api/admin/egg-records/{record_id} | 删除产蛋记录 | 是 |
| POST | /api/admin/breeder-events | 新增事件（交配/产蛋/换公等） | 是 |

## 9) Carousels / Featured / Settings

| Method | Path | 用途 | 需要登录 |
|---|---|---|---|
| GET | /api/carousels | 列表 | 否 |
| POST | /api/carousels | 创建 | 是 |
| PUT | /api/carousels/{carousel_id} | 更新 | 是 |
| DELETE | /api/carousels/{carousel_id} | 删除 | 是 |
| GET | /api/featured-products | 列表 | 否 |
| POST | /api/featured-products | 创建 | 是 |
| PUT | /api/featured-products/{featured_id} | 更新 | 是 |
| DELETE | /api/featured-products/{featured_id} | 删除 | 是 |
| GET | /api/settings | 获取设置 | 否/是（视实现） |
| PUT | /api/settings | 更新设置 | 是 |

## 10) Images

| Method | Path | 用途 | 需要登录 |
|---|---|---|---|
| GET | /api/images/{filename} | 图片代理/读取（legacy） | 否 |
