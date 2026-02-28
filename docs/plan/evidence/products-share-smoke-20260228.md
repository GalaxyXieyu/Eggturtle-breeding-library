# T67 产品管理 + 分享全链路 UX Smoke Checklist (2026-02-28)

> 目标：PR 合并后可直接按本清单执行一次端到端 UX smoke，并输出可复核证据。

## 1) 前置条件

### 环境与端口
- Web: `http://localhost:30010`
- API: `http://localhost:30011`
- 健康检查：`GET /health` 返回 `200`
- 建议 API 环境变量：
  - `NODE_ENV=development`
  - `AUTH_DEV_CODE_ENABLED=true`（便于验证码登录）
  - `WEB_PUBLIC_BASE_URL=http://localhost:30010`

### 账号与租户
- 执行账号（OWNER/EDITOR）：`synthetic.owner@ux-sandbox.local`
- 租户：`tenantSlug=ux-sandbox`
- 登录方式：邮箱验证码（devCode）

### Seed 数据（执行前至少满足）
1. 已完成 Prisma 迁移与基础种子：
   - `pnpm --filter @eggturtle/api prisma:migrate`
   - `pnpm --filter @eggturtle/api prisma:seed`
2. 已准备 UX 合成数据（推荐）：
   - `pnpm --filter @eggturtle/api exec ts-node ../../scripts/seed/synthetic_dataset.ts --confirm`
3. 本次 smoke 使用 2 张本地图片（推荐复用仓库已有图片）：
   - `apps/web/public/images/mg_01.jpg`
   - `apps/web/public/images/mg_02.jpg`

## 2) 证据目录与命名规范（稳定）

### 目录规范
- 运行目录：`out/evidence/products-share-smoke/<YYYYMMDD-HHmmss>/`
- 固定子目录：
  - `screenshots/`
  - `network/`
  - `console/`
  - `logs/`

### 截图命名规范
- 格式：`S<step>-<slug>.png`
- 示例：`S04-upload-image-1.png`
- 规则：
  - `Sxx` 永远两位数（`S01`...`S12`）
  - `<slug>` 使用小写短横线，禁止中文与空格
  - 同一步重试用后缀：`-r1`、`-r2`

### 一键初始化证据目录（可选）
- 脚本：`scripts/smoke/init_products_share_evidence.sh`
- 用法：
  - 自动 Run ID：`scripts/smoke/init_products_share_evidence.sh`
  - 指定 Run ID：`scripts/smoke/init_products_share_evidence.sh 20260228-210000`

## 3) 可执行步骤（产品新建 -> 分享只读验证）

| Step | 操作 | 预期结果 | 截图文件名 |
|---|---|---|---|
| S01 | 登录后进入目标租户产品管理页（通过工作台入口点击“产品管理”） | 页面可见产品列表与“新建产品”入口 | `S01-products-page-ready.png` |
| S02 | 新建产品（填写 code/name/description）并提交 | 成功提示出现，列表出现新产品 | `S02-product-created.png` |
| S03 | 进入该产品编辑态，修改文案字段并暂存 | 编辑表单加载正常，改动已呈现 | `S03-product-edit-updated-fields.png` |
| S04 | 上传第 1 张图片（`mg_01.jpg`） | 图片 1 上传成功并出现在图片列表 | `S04-upload-image-1.png` |
| S05 | 上传第 2 张图片（`mg_02.jpg`） | 图片 2 上传成功并出现在图片列表 | `S05-upload-image-2.png` |
| S06 | 调整两张图片排序（拖拽或上移/下移） | 顺序变化可见且持久化 | `S06-images-reordered.png` |
| S07 | 将目标图片设置为封面（主图） | 封面标识落在目标图片 | `S07-cover-image-set.png` |
| S08 | 点击保存产品 | 保存成功提示；刷新后编辑结果仍在 | `S08-product-save-success.png` |
| S09 | 点击“生成分享”并复制链接/token | 拿到可访问分享入口 `/s/:token` | `S09-share-token-generated.png` |
| S10 | 新标签页打开 `/s/:token` | 首跳为 `302`，Location 指向 `/public/share?...` | `S10-open-share-entry.png` |
| S11 | 到达 `/public/share` 页面 | 页面展示公开产品信息与图片 | `S11-public-share-page.png` |
| S12 | 验证只读（无编辑/删除/上传入口） | UI 无写操作按钮；直接调写接口返回 401/403 | `S12-public-share-readonly.png` |

> 建议在 `network/` 同步保存：
> - `S10-share-entry-302.txt`（`/s/:token` 响应头）
> - `S11-public-share-200.json`（公开分享接口返回体脱敏版）

## 4) 失败定位（API / Console / Network）

### API 定位
- 重点接口与期望：
  - `POST /products` -> `201`
  - `POST /products/:id/images` -> `201`（两次）
  - `PUT /products/:pid/images/reorder` -> `200`
  - `PUT /products/:pid/images/:iid/main` -> `200`
  - `POST /shares` -> `201`
  - `GET /s/:shareToken` -> `302`
  - `GET /shares/:shareId/public?...` -> `200`
- 快速检查：
  - `curl -i "http://localhost:30011/s/<shareToken>"`

### Console 定位
- 捕获前端控制台错误到：`console/console-errors.log`
- 重点关注：
  - `Failed to fetch`
  - `401/403`（租户 token 或角色不匹配）
  - 图片上传相关 `413/415`（大小/类型）

### Network 定位
- 导出失败场景 HAR：`network/failure.har`
- 优先检查：
  - `/s/:token` 是否返回 `302` 和 `Location`
  - `/shares/:shareId/public` 查询参数 `sid/tenantId/resourceType/resourceId/exp/sig` 是否齐全
  - 图片内容请求是否存在跨租户或鉴权错误

## 5) 执行记录模板（每次 smoke 追加）

- Run ID：`<YYYYMMDD-HHmmss>`
- 执行人：`<name>`
- 环境：`web/api/base branch`
- 结果：`PASS / FAIL / BLOCKED`
- 失败点（若有）：`Step + 现象 + 关键状态码`
- 证据目录：`out/evidence/products-share-smoke/<Run ID>/`
