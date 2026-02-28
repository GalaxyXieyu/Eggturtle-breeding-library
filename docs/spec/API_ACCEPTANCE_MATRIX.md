# 接口验收矩阵

状态：生效中
更新日期：2026-02-28

本矩阵将 API 模块验收口径映射到 `scripts/api-tests/` 的可执行场景；`docs/spec/API_TEST_SCENARIOS.md` 为场景事实来源。

## 1. 环境前置条件

- `NODE_ENV=development`
- `AUTH_DEV_CODE_ENABLED=true`
- API 基地址可访问（默认 `http://localhost:30011`）
- 执行时显式确认写入：`--confirm-writes`

## 2. 模块验收矩阵（T26.4）

| 模块 | 场景 | 接口/动作 | 期望状态 | 来源 |
| --- | --- | --- | --- | --- |
| auth | 健康检查 | `GET /health` | `200` | `API_TEST_SCENARIOS.md` §3.1(1) |
| auth | 请求登录验证码 | `POST /auth/request-code` | `201` | `API_TEST_SCENARIOS.md` §3.1(2) |
| auth | 校验登录验证码 | `POST /auth/verify-code` | `201` | `API_TEST_SCENARIOS.md` §3.1(2) |
| auth | 当前用户 | `GET /me` | `200` | `API_TEST_SCENARIOS.md` §3.1(3) |
| auth | 可选切换租户 | `POST /auth/switch-tenant` | `201` | `API_TEST_SCENARIOS.md` §3.1(4) |
| auth | 可选当前租户 | `GET /tenants/current` | `200` | `API_TEST_SCENARIOS.md` §3.1(4) |
| products | 创建产品 | `POST /products` | `201` | `API_TEST_SCENARIOS.md` §3.2(1) |
| products | 查询产品列表 | `GET /products?page=1&pageSize=20` | `200` | `API_TEST_SCENARIOS.md` §3.2(2) |
| series | 查询系列列表 | `GET /series?page=1&pageSize=10` | `200` | `API_TEST_SCENARIOS.md` §3.3(1) |
| series | 非法分页保护 | `GET /series?page=0&pageSize=10` | `400 INVALID_REQUEST_PAYLOAD` | `API_TEST_SCENARIOS.md` §3.3(2) |
| series | 系列不存在保护 | `GET /series/:id`（未知 id） | `404 SERIES_NOT_FOUND` | `API_TEST_SCENARIOS.md` §3.3(3) |
| breeders | 查询种龟列表 | `GET /breeders?page=1&pageSize=10` | `200` | `API_TEST_SCENARIOS.md` §3.4(1) |
| breeders | 非法编号保护 | `GET /breeders/by-code/%20%20` | `400 INVALID_REQUEST_PAYLOAD` | `API_TEST_SCENARIOS.md` §3.4(2) |
| breeders | 种龟详情不存在保护 | `GET /breeders/:id`（未知 id） | `404 BREEDER_NOT_FOUND` | `API_TEST_SCENARIOS.md` §3.4(3) |
| breeders | 事件时间线不存在保护 | `GET /breeders/:id/events`（未知 id） | `404 BREEDER_NOT_FOUND` | `API_TEST_SCENARIOS.md` §3.4(3) |
| breeders | 家谱不存在保护 | `GET /breeders/:id/family-tree`（未知 id） | `404 BREEDER_NOT_FOUND` | `API_TEST_SCENARIOS.md` §3.4(3) |
| breeders | 可选正向时间线结构 | `GET /breeders/:id/events`（存在 id） | `200` | `API_TEST_SCENARIOS.md` §3.4(4) |
| breeders | 可选正向家谱结构 | `GET /breeders/:id/family-tree`（存在 id） | `200` | `API_TEST_SCENARIOS.md` §3.4(4) |
| images | 上传图片 | `POST /products/:id/images` | `201` | `API_TEST_SCENARIOS.md` §3.5(1) |
| images | 设为主图 | `PUT /products/:pid/images/:iid/main` | `200` | `API_TEST_SCENARIOS.md` §3.5(2) |
| images | 重排图片 | `PUT /products/:pid/images/reorder` | `200` | `API_TEST_SCENARIOS.md` §3.5(2) |
| images | 读取图片内容 | `GET /products/:pid/images/:iid/content` | `200` 或 `302` | `API_TEST_SCENARIOS.md` §3.5(3) |
| images | 删除图片 | `DELETE /products/:pid/images/:iid` | `200` | `API_TEST_SCENARIOS.md` §3.5(4) |
| featured | 新增精选产品 | `POST /featured-products` | `201` | `API_TEST_SCENARIOS.md` §3.6(2) |
| featured | 查询精选列表 | `GET /featured-products` | `200` | `API_TEST_SCENARIOS.md` §3.6(3) |
| featured | 重排精选 | `PUT /featured-products/reorder` | `200` | `API_TEST_SCENARIOS.md` §3.6(4) |
| featured | 删除精选 | `DELETE /featured-products/:id` | `200` | `API_TEST_SCENARIOS.md` §3.6(4) |
| shares | 创建分享 | `POST /shares` | `201` | `API_TEST_SCENARIOS.md` §3.7(1) |
| shares | 打开分享入口 | `GET /s/:shareToken` | `302` | `API_TEST_SCENARIOS.md` §3.7(2) |
| shares | 读取公开分享载荷 | `GET /shares/:sid/public?...` | `200` | `API_TEST_SCENARIOS.md` §3.7(3) |
| admin | 租户角色拒绝 | `GET /admin/tenants`（租户 token） | `403` | `API_TEST_SCENARIOS.md` §3.8(1) |
| admin | 超级管理员可选正向 | `GET /admin/tenants`（super-admin token） | `200`（仅在 `--require-super-admin-pass` 下强制） | `API_TEST_SCENARIOS.md` §3.8(2) |

## 3. 核心反向断言

| 主体 | 接口 | 期望状态 | 来源 |
| --- | --- | --- | --- |
| VIEWER | `POST /products` | `403 FORBIDDEN` | `API_TEST_SCENARIOS.md` §4 |
| VIEWER | `POST /featured-products` | `403 FORBIDDEN` | `API_TEST_SCENARIOS.md` §4 |
| VIEWER | `POST /shares` | `403 FORBIDDEN` | `API_TEST_SCENARIOS.md` §4 |
| 租户角色 | `GET /admin/tenants` | `403 FORBIDDEN` | `API_TEST_SCENARIOS.md` §4 |
| 租户读取 | `GET /series?page=0&pageSize=10` | `400 INVALID_REQUEST_PAYLOAD` | `API_TEST_SCENARIOS.md` §4 |
| 租户读取 | `GET /breeders/by-code/%20%20` | `400 INVALID_REQUEST_PAYLOAD` | `API_TEST_SCENARIOS.md` §4 |
| 租户读取 | `GET /breeders/:id`（未知 id） | `404 BREEDER_NOT_FOUND` | `API_TEST_SCENARIOS.md` §4 |

## 4. 全量执行命令（T26.5）

```bash
NODE_ENV=development \
AUTH_DEV_CODE_ENABLED=true \
pnpm api-tests -- \
  --confirm-writes \
  --clear-token-cache \
  --json \
  --only auth,products,series,breeders,images,featured,shares,admin
```

该命令会对全模块发起真实请求，并输出可用于留痕的 JSONL 日志。
