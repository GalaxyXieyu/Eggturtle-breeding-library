# 文档入口（唯一）

更新日期：2026-02-28

## 关键原则

- **一个入口**：本文档是唯一入口，所有子文档通过本文档索引。
- **一个计划**：`out/share/DEVELOPMENT_PLAN.xlsx` 是唯一开发执行计划。
- **一个规格目录**：`docs/spec/` 存放所有业务规格，Excel 中 Spec Doc 列直接链接到该目录下文件。
- **Legacy 参考优先**：开发 UI 时优先参考 legacy 组件，Excel 中新增 Legacy Ref 列。
- **并行开发**：业务功能、Web UI 迁移/重设计、Admin UI 增强三者并行，明确不互相阻塞的部分。

## 架构定位

### apps/web - 租户端应用
- 登录后，面向单个租户的用户
- 包含：租户用户自己的产品/种龟/系列/轮播/设置管理
- 通过 RBAC 控制权限（OWNER/ADMIN 可操作，VIEWER 只读）

### apps/admin - 平台级后台
- 面向平台运营方
- 只需要：租户管理、会员/套餐管理、审计日志、平台配置
- **不需要也不应该**去管理单个租户的业务数据

### Legacy 参考
- Legacy frontend 里的完整后台管理 UI（`frontend/src/pages/admin/`）作为「产品设计蓝本」，可参考或直接迁移到 apps/web。

---

## 文档索引

### 项目概览
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 架构文档（单一事实来源）
- [UI_STYLE_GUIDE.md](./UI_STYLE_GUIDE.md) - UI 设计语言（SSOT）

### 规格（业务口径，SSOT）
- [spec/SAAS_SPEC.md](./spec/SAAS_SPEC.md) - 顶层业务规格
- [spec/RBAC_SPEC.md](./spec/RBAC_SPEC.md) - RBAC 规则

### 迁移（SSOT）
- [migration/TODO.md](./migration/TODO.md) - 迁移里程碑待办（唯一）
- [migration/API_MATRIX.md](./migration/API_MATRIX.md) - API 对照矩阵
- [migration/UI_MATRIX.md](./migration/UI_MATRIX.md) - UI 对照矩阵
- [migration/COVERAGE.md](./migration/COVERAGE.md) - 覆盖审计

### 开发流程（不在 repo 落盘）
- SOP / subagent 模板：见 OpenClaw workspace 的 `playbooks/dev-workflow.md`
- 执行计划：`docs/plan/EggsTask.csv`（短周期任务表, SSOT）+ `out/share/DEVELOPMENT_PLAN.xlsx`（长周期）

### 规格细节
- [spec/ADMIN_BACKOFFICE_SPEC.md](./spec/ADMIN_BACKOFFICE_SPEC.md) - 平台后台业务规格
- [spec/AI_PHASE_A.md](./spec/AI_PHASE_A.md) - AI Phase A 业务规格
- [spec/AI_SYSTEM_DESIGN.md](./spec/AI_SYSTEM_DESIGN.md) - AI 架构设计
- [spec/AI_QUOTA_BILLING.md](./spec/AI_QUOTA_BILLING.md) - AI 配额/计费规格

### 归档文档
- [archive/CODEBASE_STRUCTURE.md](./archive/CODEBASE_STRUCTURE.md) - 代码结构梳理（已归档）
- [archive/SAAS_REQUIREMENTS.md](./archive/SAAS_REQUIREMENTS.md) - 需求规格（已归档）

---

---

## Legacy UI 参考清单

可参考/复用的 legacy 组件：
- 产品管理：`frontend/src/pages/admin/AdminProducts.tsx`
- 图片管理：`frontend/src/pages/admin/products/images/ProductImagesManager.tsx`
- 批量导入：`frontend/src/components/admin/ProductImportDialog.tsx`
- 种龟事件：`frontend/src/pages/admin/products/forms/BreederEventsCard.tsx`
- 系列管理：`frontend/src/pages/admin/AdminSeries.tsx`
- 轮播管理：`frontend/src/pages/admin/AdminCarouselManager.tsx`
- 设置：`frontend/src/pages/admin/AdminSettings.tsx`

这些组件使用 shadcn/ui + Radix UI，与我们 Node 端选择的技术栈一致，可参考或直接迁移到 apps/web。
