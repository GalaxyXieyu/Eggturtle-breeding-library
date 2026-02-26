# 蛋龟选育库 SaaS 需求与架构口径（Node.js 全栈）

更新日期：2026-02-26
状态：待评审（可开发口径）

本文把《TurtleAlbum_SaaS规则清单_v2》与群里已拍板决策，收敛成“能直接开工”的需求 + 架构口径。

## 0. 已拍板决策（必须遵守）

- 技术栈：**全量 Node.js/TypeScript**（前端 + 后端 + 脚本/任务），避免双语言环境。
- 租户模型：工作室/俱乐部 = 租户（tenant），租户下多成员协作。
- 支付：微信支付 + 支付宝。
- 套餐：3 档（年付为主）。
- AI：按套餐包含次数扣减；**必须二次确认后写入**。
- 数据库：PostgreSQL（部署在 Sealos 或 Sealos 租用）。
- 对象存储：预留 MinIO（S3 compatible），外链原图必须短签名 URL。

## 1. 产品定位与边界

### 1.1 目标用户

- 主流用户：10~20 只种龟的个人繁育者（低门槛年付）。
- 高级用户：20~200 只种龟的工作室/俱乐部（多成员协作）。

### 1.2 MVP 必须包含（P0）

- 多租户隔离（tenant_id 必填 + 服务端强校验）。
- RBAC（Owner/Admin/Editor/Viewer，默认拒绝）。
- 分享链接（默认只读，支持撤销/过期/统计 + 风控预留）。
- 审计日志（关键操作可检索）。
- 套餐/配额/功能开关（至少：种龟数、场景数、成员数、存储、分享访问、AI 次数、证书额度）。
- 证书验证页 + 二维码销售页（只读，支持撤销/过期）。
- 管理后台“一句话 AI 录入”（Draft -> 二次确认 -> 写入）。

### 1.3 MVP 不包含（明确不做）

- 重企业化流程（审批、多级组织、复杂工作流）。
- 复杂计费（按每只龟/月精算）。

## 2. 页面与路由（先从页面开始）

### 2.1 路由形态（建议定死）

- Tenant App（登录后）：`/app/<tenantSlug>/...`
- Public（对外只读）：
  - 分享：`/s/<token>`
  - 证书：`/cert/<certNo>`（或后续改为 `/v/<token>`，见待确认）
  - 二维码销售页：`/q/<token>`
- 平台后台：`/admin/...`

### 2.2 页面清单

- 登录与租户：
  - `/login` 邮箱登录（magic link 或邮箱验证码）
  - `/onboarding` 创建租户
  - `/tenant-select`（预留：一个用户属于多个租户）
- Tenant App（核心）：
  - 种龟档案（列表/详情/编辑）
  - 繁育事件（交配/产蛋/换公）录入与时间线展示
  - 场景（scene）管理（用于展示分组/主题/龟舍）
  - 设置：成员与角色、套餐与配额、分享管理、审计日志
  - “一句话 AI 录入”（抽屉/悬浮入口）
- Public：分享页/证书验证页/二维码销售页
- 平台后台（SaaS Admin）：租户列表、套餐/配额、功能开关、告警概览、平台审计

## 3. 多租户与鉴权（P0 口径）

### 3.1 租户隔离

- 所有业务表必须 `tenant_id NOT NULL`。
- 所有查询必须默认注入 `tenant_id` 过滤（禁止业务代码手写绕过）。
- 唯一性约束必须按 `(tenant_id, business_key)`。

### 3.2 Token 与切租户

- Access token 必须是 **tenant-scoped**：token 内包含 `user_id` + `tenant_id`（当前激活租户）。
- 用户切换租户：`POST /api/auth/switch-tenant`，服务端校验 membership 后重新签发 token。

### 3.3 RBAC

- 角色：Owner / Admin / Editor / Viewer。
- 默认拒绝（Deny by default）。
- 权限按“资源 + 动作”定义（示例）：
  - `scene.read/write`
  - `breeder.read/write`
  - `event.create`
  - `share.create/revoke/read`
  - `tenant.member.manage`
  - `audit.read`
  - `certificate.issue/revoke/read`

## 4. 分享/证书/二维码（Public）规则

- 分享链接默认只读；任何编辑必须登录并通过 RBAC。
- token 必须高熵；服务端只存 `token_hash`。
- 支持：创建、撤销、过期时间、访问统计。
- 若提供原图：必须短签名 URL（例如 5~30 分钟），禁止永久直链。
- 风控预留：按 IP/UA/链接维度限流，异常峰值可触发策略。

## 5. VIP 一句话 AI 录入（像 skills，但可控）

### 5.1 交互流程（强制二次确认）

1) 用户输入自然语言
2) `POST /api/ai/parse`：服务端解析为 Draft（不写业务表）
3) 前端展示 Draft（可编辑）
4) 用户点击“确认写入”
5) `POST /api/ai/apply`：服务端按 Draft 调用内部 service 写入

### 5.2 AI 次数扣减口径（P0，避免成本泄漏）

- **在 parse 阶段扣减 1 次**（并落库 `ai_usage_logs`），避免无限 parse。
- apply 阶段不重复扣减，但必须带 `draft_id`，服务端校验 draft 归属与状态。

## 6. 套餐/计费/配额（年付为主）

### 6.1 套餐原则

- 3 档套餐（免费/初级/高级），配额+功能开关强绑定到租户。
- 达限策略：软预警（80%）+ 硬限制新增；**不影响已发布分享只读访问**。

### 6.2 支付链路（webhook 为准）

- 创建订单 -> 拉起支付 -> 用户支付 -> webhook 回调 -> entitlement 生效。
- 任何“支付成功页”仅展示状态，最终以 webhook 落库为准。
- webhook 必须幂等（event_id 去重）。

## 7. 技术架构（全 Node.js/TypeScript）

### 7.1 推荐形态（可长期维护）

- 前端：Next.js（React）
- 后端：Node.js API（NestJS/Fastify 任选其一；建议 NestJS 便于模块化：Auth/RBAC/Billing/Audit/AI）
- ORM：Prisma（或 Drizzle）
- DB：Postgres
- 对象存储：MinIO（S3 compatible）
- 可选：Redis（限流、队列、会话；Phase 1 引入）

### 7.2 代码结构建议（单仓）

- `apps/web`（前端）
- `apps/api`（后端）
- `packages/shared`（DTO、schema、权限常量、错误码）
- `packages/scripts`（迁移/对账/备份/运营脚本，全 TS）

## 8. 部署与运维（Sealos 目标形态）

- 组件：web、api、postgres、minio（可选 redis）。
- 必须：域名 + 全站 HTTPS（支付回调/分享链接依赖）。
- 备份：PG 每日全量 + 异地（存 MinIO）；至少每月一次恢复演练。

## 9. 里程碑（建议节奏）

- Phase 0（1~3 天）：多租户骨架 + 业务核心页可跑（用于交互测试）
- Phase 1（1~2 周）：tenant 强隔离 + RBAC + 审计 + 分享 + 配额/功能开关 + AI Draft/apply
- Phase 2（1 周）：微信/支付宝支付 + webhook 幂等 + entitlement 生效 + 基础对账
- Phase 3（持续）：MinIO/签名 URL 全面接入 + 告警/风控 + 备份演练固化

## 10. 待确认（不阻塞 Phase 0）

- 邮箱登录形态：magic link vs 邮箱验证码。
- 证书验证 URL：`/cert/<certNo>` vs `/v/<token>`；二维码页是否统一走 share 体系。
- 是否引入 Redis（建议 Phase 1）。
