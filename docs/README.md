# 文档入口（V4.2）

更新时间：2026-03-04

本目录已按“业务主线 + 技术实现 + UI 规范”收敛，以下 7 份文档为当前有效主文档。

## 核心文档

- [project-architecture.md](./project-architecture.md)
  - 系统边界与模块职责（用户端 / 公开分享端 / 平台管理端 / API）
- [business-flows.md](./business-flows.md)
  - 业务主流程与交互链路（创建、编辑、筛选、分享、回流）
- [api-views.md](./api-views.md)
  - 页面路由与 API 调用映射（含抽屉化后的产品管理流）
- [technical-reference.md](./technical-reference.md)
  - 关键技术口径、MUST/SHOULD 规则、组件复用边界
- [uiux-design.md](./uiux-design.md)
  - UI 设计规范与交互契约（抽屉、药丸筛选、FAB、移动端行为）
- [deploy/sealos-domain-hardening.md](./deploy/sealos-domain-hardening.md)
  - Sealos 域名/HTTPS/301 收口方案与发布后自动验收闸门
- [deployment/t77-public-attribution-first-product-runbook.md](./deployment/t77-public-attribution-first-product-runbook.md)
  - T77 公开页归因、自动绑定、首只上传奖励上线与回滚手册

## 本轮重点变更（2026-03-04）

- 公开页新增首触归因采集；注册/登录后自动消费公开页来源并建立邀请关系。
- 邀请奖励主链路切换为“首只乌龟上传成功”，双方各得 7 天会员。
- 证书二维码改为强制绝对验真 URL；海报二维码默认追加 `src=poster` 便于归因。
- 产品管理从“多入口页面”收敛为“列表 + 抽屉”单入口交互。
- 创建/编辑统一由 `ProductDrawer` 分发，图片上传与资料编辑都在抽屉内完成。
- 移动端筛选逻辑明确分支：
  - 顶部筛选按钮 -> 锚点弹层
  - 悬浮筛选按钮 -> 底部抽屉（Bottom Sheet）
- 分享按钮加入降级打开策略，避免“被拦截”误报。
- 共享样式与格式化工具（`filter-pill`、`pet-format`、`pet-card`）已落地，减少重复 CSS 和重复逻辑。

## 文档维护规则

- 文档中的交互与组件口径，必须与 `apps/web` 当前实现一致。
- 如果改动以下任一文件，必须同步更新对应文档章节：
  - `apps/web/app/app/[tenantSlug]/products/page.tsx`
  - `apps/web/components/product-drawer/*`
  - `apps/web/components/tenant-floating-share-button.tsx`
  - `apps/web/components/filter-pill.ts`
  - `apps/web/components/pet/*`
- 不再新增“平行口径文档”，优先在现有 6 份文档内迭代。

## 自动化补充文档

- [openclaw/openclaw-daily-summary.md](./openclaw/openclaw-daily-summary.md)
  - Eggturtle 每日 22:30 OpenClaw 日报方案、脚本与 cron 注册方式
