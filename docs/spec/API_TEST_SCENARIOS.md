# 接口测试场景

状态：生效中
更新日期：2026-02-28

本文定义 `scripts/api-tests/` 的模块化接口测试场景。

## 1. 范围与对齐关系

场景口径与以下文档保持一致：

- `docs/spec/ACCOUNT_MATRIX_PERMISSIONS.md`
- 角色验收基线（`OWNER / ADMIN / EDITOR / VIEWER` + `super-admin`）
- `docs/spec/API_ACCEPTANCE_MATRIX.md`

脚本按模块拆分，不使用单体 smoke 脚本：
- `auth.ts`
- `products.ts`
- `series.ts`
- `breeders.ts`
- `images.ts`
- `featured.ts`
- `shares.ts`
- `admin.ts`
- `account-matrix.ts`

运行入口：`scripts/api-tests/run.ts`

## 2. 安全与执行策略

- 默认 `dry-run`（只打印计划，不发请求）
- 写入类场景必须显式传 `--confirm-writes`
- 默认拒绝非本地 API，远端需显式 `--allow-remote`
- 默认输出精简日志，`--json` 输出 JSONL 便于排查
- Token 缓存路径：`.data/api-tests/token-cache.json`（1 小时）
- `--clear-token-cache` 可清理本地缓存

## 3. 场景目录

### 3.1 鉴权与身份（`auth`）

1. 健康检查
- `GET /health` -> `200`
- `status` 应为 `ok`

2. 开发验证码登录
- `POST /auth/request-code` -> `201`
- `POST /auth/verify-code` -> `201`
- 返回包含 `accessToken`、`user.id`、`user.email`

3. 当前用户
- `GET /me`（带 token）-> `200`

4. 可选租户切换
- 传 `--tenant-id` 时：`POST /auth/switch-tenant` -> `201`
- `GET /tenants/current` -> `200`

### 3.2 产品（`products`）

1. 创建产品
- `POST /products` -> `201`
- 返回包含 `product.id`、`product.code`

2. 产品列表
- `GET /products?page=1&pageSize=20` -> `200`
- 新建产品应出现在列表中

### 3.3 系列（`series`）

1. 列表包装结构
- `GET /series?page=1&pageSize=10` -> `200`
- 必须包含 `items`、`total`、`page`、`pageSize`、`totalPages`

2. 非法分页保护
- `GET /series?page=0&pageSize=10` -> `400 INVALID_REQUEST_PAYLOAD`

3. 未找到保护
- `GET /series/:id`（不存在 id）-> `404 SERIES_NOT_FOUND`

4. 可选正向与隔离校验
- 有数据时 `GET /series/:id` -> `200`
- 跨租户 token 访问同 id -> `404 SERIES_NOT_FOUND`

### 3.4 种龟（`breeders`）

1. 列表包装结构
- `GET /breeders?page=1&pageSize=10` -> `200`
- 必须包含 `items`、`total`、`page`、`pageSize`、`totalPages`

2. 参数非法保护
- `GET /breeders?page=0&pageSize=10` -> `400 INVALID_REQUEST_PAYLOAD`
- `GET /breeders/by-code/%20%20` -> `400 INVALID_REQUEST_PAYLOAD`

3. 未找到保护
- `GET /breeders/:id`（不存在 id）-> `404 BREEDER_NOT_FOUND`
- `GET /breeders/:id/events`（不存在 id）-> `404 BREEDER_NOT_FOUND`
- `GET /breeders/:id/family-tree`（不存在 id）-> `404 BREEDER_NOT_FOUND`

4. 可选正向与隔离校验
- `GET /breeders/:id` -> `200`
- `GET /breeders/by-code/:code` -> `200`
- `GET /breeders/:id/events` -> `200`，按 `eventDate desc` 排序
- `GET /breeders/:id/family-tree` -> `200`
- 跨租户 token 访问 -> `404 BREEDER_NOT_FOUND`

### 3.5 产品图片（`images`）

1. 上传
- 先创建产品
- `POST /products/:id/images`（multipart）-> `201`

2. 元数据管理
- `PUT /products/:pid/images/:iid/main` -> `200`
- `PUT /products/:pid/images/reorder` -> `200`

3. 内容读取
- `GET /products/:pid/images/:iid/content` -> `200`（本地）或 `302`（跳转对象存储）

4. 删除
- `DELETE /products/:pid/images/:iid` -> `200`

### 3.6 精选产品（`featured`）

1. 准备 2 个产品
2. 新增精选：`POST /featured-products` -> `201`
3. 查询精选：`GET /featured-products` -> `200`
4. 重排与删除：
- `PUT /featured-products/reorder` -> `200`
- `DELETE /featured-products/:id` -> `200`

### 3.7 分享（`shares`）

1. 创建分享
- 先创建产品
- `POST /shares` -> `201`
- 返回 `share.id`、`share.shareToken`

2. 打开分享入口
- `GET /s/:shareToken` -> `302`
- `Location` 包含签名参数：`sid`、`tenantId`、`resourceType`、`resourceId`、`exp`、`sig`

3. 读取公开载荷
- `GET /shares/:sid/public?...` -> `200`
- `shareId` 与 `product.id` 应匹配

### 3.8 后台访问（`admin`）

1. 租户角色拒绝
- 非 `super-admin` token：`GET /admin/tenants` -> `403 FORBIDDEN`

2. 可选正向校验
- 传 `--super-admin-email` 时访问 `GET /admin/tenants`
- 若传 `--require-super-admin-pass`，必须为 `200`

### 3.9 账号矩阵（`account-matrix`）

该模块是角色矩阵自动验收的权威入口。

前置参数：
- 必填：`--owner-email --admin-email --editor-email --viewer-email`
- 需提供 `--tenant-id`，或使用 `--provision --super-admin-email` 自动建租户并授权

覆盖内容：
- products 读写矩阵
- featured 读写矩阵
- shares 创建与公开读取矩阵
- images 内容读取矩阵
- `/admin/*` 对租户角色拒绝
- 可选 `/admin/*` 的 `super-admin` 正向通过

## 4. 核心反向断言

必须覆盖以下拒绝/错误码：
- `VIEWER -> POST /products` -> `403 FORBIDDEN`
- `VIEWER -> POST /featured-products` -> `403 FORBIDDEN`
- `VIEWER -> POST /shares` -> `403 FORBIDDEN`
- `tenant role -> GET /admin/tenants` -> `403 FORBIDDEN`
- `tenant token -> GET /series?page=0&pageSize=10` -> `400 INVALID_REQUEST_PAYLOAD`
- `tenant token -> GET /breeders/by-code/%20%20` -> `400 INVALID_REQUEST_PAYLOAD`
- `tenant token -> GET /breeders/:id`（不存在 id）-> `404 BREEDER_NOT_FOUND`

## 5. 推荐执行命令

1. 租户模块快速扫描

```bash
pnpm api-tests -- --confirm-writes --only auth,products,series,breeders,images,featured,shares
```

2. 后台访问校验

```bash
pnpm api-tests -- --confirm-writes --only admin --super-admin-email super@example.com
```

3. 全量账号矩阵验收

```bash
pnpm api-tests -- \
  --confirm-writes \
  --only account-matrix \
  --owner-email owner@example.com \
  --admin-email admin@example.com \
  --editor-email editor@example.com \
  --viewer-email viewer@example.com \
  --tenant-id <tenant-id>
```

## 6. 日志与排障

- 默认输出精简事件，适合本地快速执行
- `--json` 输出结构化 JSONL（含 `ts`、`level`、`event`）
- Runner 会在单模块失败后继续执行其他模块，并输出 `runner.failed` 汇总
- 错误载荷日志会脱敏 token 样式字段，避免泄漏凭据
