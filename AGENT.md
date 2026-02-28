# TurtleAlbum Breeding Library - Claude 项目配置

更新日期: 2026-02-28

## 项目概览

这是一个种龟繁殖管理的 SaaS 平台项目，从 Legacy FastAPI + React 迁移到 Node.js NestJS + React 架构。

## 架构定位

### apps/web - 租户端应用
- 登录后，面向单个租户的用户
- 包含：租户用户自己的产品/种龟/系列/轮播/设置管理
- 通过 RBAC 控制权限（OWNER/ADMIN 可操作，VIEWER 只读）
- 路由：`/app/[tenantSlug]/...`

### apps/admin - 平台级后台
- 面向平台运营方
- 只需要：租户管理、会员/套餐管理、审计日志、平台配置
- **不需要也不应该**去管理单个租户的业务数据
- 路由：`/dashboard/...`

### Legacy 参考
- Legacy frontend 里的完整后台管理 UI（`frontend/src/pages/admin/`）作为「产品设计蓝本」，可参考或直接迁移到 apps/web。

---

## 核心文档索引

### 入口文档
- [docs/README.md](docs/README.md) - 唯一文档入口
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - 架构文档（单一事实来源）
- [docs/UI_STYLE_GUIDE.md](docs/UI_STYLE_GUIDE.md) - UI 风格指南

### 业务规格 (docs/spec/)
- [SAAS_SPEC.md](docs/spec/SAAS_SPEC.md) - 顶层业务规格
- [RBAC_SPEC.md](docs/spec/RBAC_SPEC.md) - RBAC 控制规则
- [ADMIN_BACKOFFICE_SPEC.md](docs/spec/ADMIN_BACKOFFICE_SPEC.md) - 平台后台业务规格
- [AI_PHASE_A.md](docs/spec/AI_PHASE_A.md) - AI Phase A 业务规格
- [AI_SYSTEM_DESIGN.md](docs/spec/AI_SYSTEM_DESIGN.md) - AI 架构设计
- [AI_QUOTA_BILLING.md](docs/spec/AI_QUOTA_BILLING.md) - AI 配额/计费规格

### 迁移矩阵 (docs/migration/)
- [API_MATRIX.md](docs/migration/API_MATRIX.md) - Legacy FastAPI -> Node Nest API 接口对照
- [UI_MATRIX.md](docs/migration/UI_MATRIX.md) - Legacy 前端 -> Node Web/Admin 页面功能对照
- [TODO.md](docs/migration/TODO.md) - 迁移待办清单
- [COVERAGE.md](docs/migration/COVERAGE.md) - 迁移覆盖审计

### 验收证据 (docs/evidence/)
- 每个阶段的验收证据文档

---

## RBAC 控制规则

### 角色定义
| 角色 | 说明 |
|-------|------|
| OWNER | 租户创建者，拥有所有权限 |
| ADMIN | 租户管理员，可管理产品/种龟/系列/轮播/设置/成员 |
| EDITOR | 编辑者，可创建/编辑产品/种龟/事件 |
| VIEWER | 只读用户，只能查看，不能编辑 |

### 默认拒绝策略
- **Deny-by-default**：所有操作默认拒绝，需显式授权。
- 所有业务表必须 `tenant_id NOT NULL`。
- 所有查询必须默认注入 `tenant_id` 过滤。

### 权限不足时的行为

#### API 端
- 权限不足时返回 **403 Forbidden**
- 响应体：
  ```json
  {
    "error": "Forbidden",
    "message": "Insufficient permissions",
    "code": "INSUFFICIENT_PERMISSIONS"
  }
  ```

#### UI 端
- **隐藏操作入口**：权限不足的按钮/菜单不显示
- **权限提示**：若直接访问受保护页面，显示「权限不足」提示页
- **表单/操作禁用**：按钮置灰，hover 提示「权限不足」

### 实现参考
- 共享类型：`packages/shared/src/tenant.ts`
- Guard：`apps/api/src/auth/rbac.guard.ts`
- Policy：`apps/api/src/auth/rbac.policy.ts`

---

## UI 风格指南

### 颜色系统
- **当前主题**: Beige/Gold/Brown (在 `frontend/src/index.css` 定义)
- **未来方向**: Waterfall Feed 黑白黄主题 (accent: `#FFD400`)

### 核心设计令牌 (HSL)
- Background: `37 38% 95%`
- Foreground: `32 25% 20%`
- Primary: `32 25% 60%`
- Card: `37 38% 98%`

### Cosmetic Palette (Hex)
- Beige 50-500: `#FDFBF8` -> `#BFA587`
- Gold 50-600: `#FEFCF6` -> `#C4A66E`
- Brown 100-900: `#9C8C7D` -> `#1A1612`

### 常见使用模式
- App background: `bg-cosmetic-beige-100`
- Surfaces (cards/headers/sidebar): `bg-white` with `border-cosmetic-beige-200`
- Primary action buttons: `bg-cosmetic-gold-400 hover:bg-cosmetic-gold-500 text-white`
- Primary highlight text: `text-cosmetic-gold-500`
- Body text: `text-cosmetic-brown-300/400/500`

### Typography
- Sans: `Inter`
- Serif (headings/brand): `Playfair Display`

### 关键文件
- Tailwind theme: `frontend/tailwind.config.ts`
- CSS variables: `frontend/src/index.css`
- Admin layout: `frontend/src/components/AdminLayout.tsx`

### Admin Layout 约定
- Sidebar surface: `bg-white` + `border-r border-cosmetic-beige-200`
- Active nav: `bg-cosmetic-gold-100 text-cosmetic-gold-500`
- Inactive nav: `text-cosmetic-brown-300 hover:bg-cosmetic-beige-100 hover:text-cosmetic-brown-500`

---

## Legacy UI 参考清单

可参考/复用的 legacy 组件（在 `frontend/` 目录）：
- 产品管理：`frontend/src/pages/admin/AdminProducts.tsx`
- 图片管理：`frontend/src/pages/admin/products/images/ProductImagesManager.tsx`
- 批量导入：`frontend/src/components/admin/ProductImportDialog.tsx`
- 种龟事件：`frontend/src/pages/admin/products/forms/BreederEventsCard.tsx`
- 系列管理：`frontend/src/pages/admin/AdminSeries.tsx`
- 轮播管理：`frontend/src/pages/admin/AdminCarouselManager.tsx`
- 设置：`frontend/src/pages/admin/AdminSettings.tsx`

这些组件使用 shadcn/ui + Radix UI，与 Node 端技术栈一致，可参考或直接迁移到 apps/web。

---

## 开发执行计划

### 执行入口
- `/Volumes/DATABASE/code/Eggturtle-breeding-library/docs/plan/EggsTask.csv` - 今晚任务计划（SSOT, git 管理）
- `docs/DEVELOPMENT_PLAN_GUIDE.md` - 开发计划结构指南

### Excel Sheet 结构
- Plan Overview - 总览
- Phase 1: Membership - 会员模块
- Phase 2: Records - 交配/产蛋/事件
- Phase 3: Operation - 运营模块（导入/轮播/设置）
- UI: Web Redesign - Web UI 重新设计
- UI: Admin Enhance - Admin UI 增强

### 任务行格式
- ID / Phase / Task / Spec Doc / Success Criteria / Verify (how)
- Status / Evidence / Depends On / Legacy Ref

### 任务同步规则（强制）
- 完成任何任务后，必须立即更新 `docs/plan/EggsTask.csv` 中对应任务行（至少包含 `Status` 与 `Evidence`）。
- 在执行 `git commit` 前，必须再次核对并同步 `docs/plan/EggsTask.csv`，避免任务状态与代码提交不一致。
- 若本次改动涉及多个任务，提交前需要逐条确认 CSV 中每个任务状态与实际完成情况一致。

---

## 当前分支与进度

- 当前分支: `feat/t30-32-admin-pages`
- 最近提交:
  - da39343 ci: add PR lint-build workflow and admin smoke evidence
  - eda99ea docs: add migration todo milestones
  - 1268226 apps/admin: tenants + memberships + audit logs

### 今日执行快照（2026-02-28）

- `apps/web` 登录页完成双语切换（中文/英文）与视觉重构：
  - 文件：`apps/web/app/login/page.tsx`、`apps/web/app/globals.css`
  - 能力：中英文文案切换、双栏登录信息块、devCode 提示块
- `apps/web` 租户端统一壳层与迁移入口已落地（Phase 1）：
  - 证据：`docs/evidence/web-ui-redesign-phase1-smoke-20260228.md`
- 数据复核结论（避免误判“账号错了”）：
  - `turtle-album`：当前有 `products`（已从 legacy 导入），但没有 `series/breeders`
  - `ux-sandbox`：已通过 `scripts/seed/synthetic_dataset.ts --confirm` 补齐 `series/breeders/events`
  - 因此测试 `series/breeders` 页面时应优先使用 `synthetic.owner@ux-sandbox.local` + `ux-sandbox` 租户
- 生产数据拉取复核（来源：`/Volumes/DATABASE/code/turtle_album/backend/data/app.db`）：
  - dry-run 导出统计：`users=1`、`products=32`、`product_images=32`（合计 65 条记录，满足“50+”口径）
  - `--confirm` 导出文件：`out/turtle_album_export_from_prod_20260228_reimport.json`
  - `--confirm` 导入结果：`products updated=32`、`images updated=32`
  - 当前导入脚本仅覆盖 `users/products/product_images`，不包含 `series/breeders/events`
- 2026-02-28 MCP 实测补充：
  - 登录页中英文切换可用（`中文`/`English`）
  - `admin@turtlealbum.local` 仅属于 `turtle-album`；访问 `ux-sandbox` 会提示 `User is not a member of this tenant`
  - `synthetic.owner@ux-sandbox.local` 访问 `ux-sandbox/series` 显示 `3/3` 条 series，链路正常
- 2026-02-28 合并回退后的重建补充：
  - `apps/web` 与 `apps/admin` 已统一改为 Admin Mode 紧凑比例（小字号/小间距/小控件/紧凑表格行高）
  - `apps/admin` 全部核心页面改为中文文案（登录、总览、租户、成员、审计日志、侧边栏/顶栏）
  - 登录链路已升级为“双模式”：账号密码 + 邮箱验证码（admin/web 同步可用）
  - 密码登录后端已落地并迁移：
    - 共享协议：`packages/shared/src/auth.ts`
    - API：`POST /auth/password-login` + `verify-code` 支持可选 `password`
    - 数据库迁移：`apps/api/prisma/migrations/20260228160000_auth_password_login`
  - 已确认“有图片有数据”的主租户：`turtle-album`
    - 当前统计：`products=32`、`product_images=64`（该租户图片数据最完整）
  - 本地可用账号（已设置密码）：
    - 租户端（图片数据主账号）：`admin@turtlealbum.local` / `Turtle@2026!`
    - 平台后台（super-admin）：`synthetic.superadmin@local.test` / `Super@2026!`
    - 本地后台 allowlist 已写入：`apps/admin/.env.local`
  - 当前删除其它租户会影响 smoke/回归样例，默认先不做破坏性清理；如确认清理再执行“只保留 turtle-album”。
- 2026-02-28 UI_STYLE_GUIDE 对齐优化补充（apps/web）：
  - 登录页重构为“单卡片居中”标准布局，移除冗余说明块，保留中英文切换与双模式登录（密码/验证码）
  - 批量收口 v0 页面视觉风格（`/app`、`/tenant-select`、`/app/[tenantSlug]/series|breeders|featured-products|tenants|breeders/[id]`、`/public/share`）
  - 新增统一样式基座（页面壳层、面板、表格、状态提示、紧凑按钮），并按 Admin Mode 紧凑密度统一
  - 移动端适配已实测（390px 视口）：登录页、工作台、种龟列表、分享页均可用
  - 代码与实测证据：
    - 主要文件：`apps/web/app/globals.css`、`apps/web/app/login/page.tsx`、`apps/web/app/app/*`、`apps/web/app/public/share/page.tsx`
    - 验证：`pnpm --filter @eggturtle/web lint` 通过（仅 `next/image` 规则 warning）；Chrome MCP 截图确认桌面/移动端布局
- 2026-02-28 任务归属调整与收口：
  - `T40`（Milestone1 收口）已由“宇宇”接手并完成，证据：`docs/plan/evidence/milestone1-closeout-20260228.md`
  - `T41`（Membership/Quota v1 规划审阅）已由“宇宇”接手并完成，证据：`docs/plan/evidence/membership-v1-plan-review-20260228.md`
  - 其余进行中任务继续由 openclaw/宇仔推进（按 `docs/plan/EggsTask.csv` 为准）

---

## 关键原则

1. **一个入口**: docs/README.md 是唯一文档入口
2. **一个计划**: Excel 是唯一开发执行计划
3. **一个规格目录**: docs/spec/ 存放所有业务规格
4. **Legacy 参考优先**: 开发 UI 时优先参考 legacy 组件
5. **并行开发**: 业务功能、Web UI 迁移/重设计、Admin UI 增强三者并行
6. **任务闭环**: 每次任务完成与每次 Git 提交前，都必须同步 `docs/plan/EggsTask.csv`

---

## 决策记录

- 暂无暗黑模式计划
- Admin 移除金色渐变品牌文字 (`.gold-text`)
- Admin 调色板应与 waterfall feed 黑白黄对齐 (accent `#FFD400`)
