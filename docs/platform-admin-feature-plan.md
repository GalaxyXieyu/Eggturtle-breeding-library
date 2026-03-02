# Platform Admin SaaS 能力审查与补齐计划

更新时间：2026-03-02  
目标：从 SaaS 平台治理角度审查 `apps/admin` 与 `/admin` API，识别缺口并形成可执行补齐清单。

## 1. 现状基线（已上线能力）

当前平台管理端已经具备以下基础能力：

1. 超管入口与会话校验（`apps/admin/app/dashboard/layout.tsx`）。
2. 租户目录与搜索、租户详情页（`apps/admin/app/dashboard/tenants/page.tsx`、`apps/admin/app/dashboard/tenants/[tenantId]/page.tsx`）。
3. 订阅计划与配额修改（`GET/PUT /admin/tenants/:tenantId/subscription`）。
4. 租户创建与激活码创建（`POST /admin/tenants`、`POST /admin/subscription-activation-codes`）。
5. 跨租户成员管理（`apps/admin/app/dashboard/memberships/page.tsx`）。
6. 平台审计日志检索（`apps/admin/app/dashboard/audit-logs/page.tsx` + `/admin/audit-logs`）。

## 2. SaaS 能力矩阵（审查结论）

状态说明：`已实现` / `部分实现` / `缺失`

| 能力域 | 当前状态 | 代码证据 | 主要缺口 | 风险 | 优先级 | 建议阶段 |
|---|---|---|---|---|---|---|
| 租户目录与基础管理 | 已实现 | `apps/admin/app/dashboard/tenants/page.tsx`、`apps/api/src/admin/admin.controller.ts` | 缺少批量操作（批量冻结/导出） | 运维效率低 | P1 | Phase 1 |
| 租户创建与激活码发放 | 部分实现 | `apps/api/src/admin/admin.service.ts:220`、`apps/api/src/subscriptions/tenant-subscriptions.service.ts:118` | 缺少发码记录查询、失效/撤销工作台 | 发码不可追踪 | P1 | Phase 1 |
| 租户生命周期治理（冻结/恢复/下线） | 部分实现 | `apps/api/src/subscriptions/tenant-subscriptions.service.ts:485`（支持 `DISABLED/EXPIRED` 计算） | 无专用治理流程、无“软下线”与数据迁移流程 | 高风险租户无法快速处置 | P0 | Phase 0 |
| 成员与权限治理 | 已实现（基础） | `apps/admin/app/dashboard/memberships/page.tsx`、`apps/api/src/admin/admin.service.ts:423` | 缺少平台角色分级（只区分 super admin） | 权限过粗导致误操作风险 | P1 | Phase 2 |
| 平台审计查询 | 已实现（查询） | `apps/admin/app/dashboard/audit-logs/page.tsx`、`apps/api/src/admin/super-admin-audit-logs.service.ts:49` | 无审计导出、无告警规则 | 事后追责链路不完整 | P0 | Phase 0 |
| 活跃度看板（DAU/WAU/MAU） | 缺失 | 现有导航仅 `总览/租户/成员/审计`：`apps/admin/components/dashboard/nav-config.ts` | 无租户活跃分层、无留存趋势 | 无法评估平台健康度 | P0 | Phase 1 |
| 付费看板（MRR/ARR/转化/流失） | 缺失 | 无 `/admin/analytics` 或 billing 页面 | 无收入指标、无续费/流失分析 | 无法进行商业决策 | P0 | Phase 1 |
| 支付回调与对账闭环 | 部分实现（脚手架） | `apps/api/src/payments/payments.service.ts:83`、`:89`（webhook 未实现） | 无订单落库、无回调幂等、无对账 | 收入数据不可信 | P0 | Phase 1 |
| 用量计量与配额可视化 | 部分实现（后端限制） | `apps/api/src/subscriptions/tenant-subscriptions.service.ts:328`、`:383` | 无平台用量面板与超限预警 | 客诉难定位，销售无法解释配额 | P0 | Phase 1 |
| 安全治理（MFA/SSO/会话风控） | 缺失 | 当前仅验证码/密码登录：`apps/api/src/auth/auth.controller.ts` | 无二次认证、无平台会话管理 | 账号被盗风险 | P1 | Phase 2 |
| 合规与数据治理（导出/删除/留存） | 缺失 | 当前无平台数据治理 API | 无数据删除工单/留存策略界面 | 合规风险 | P1 | Phase 2 |
| 客服运营工作台（工单/公告/批处理） | 缺失 | 当前页面无运营模块 | 问题处理分散在线下流程 | 支持效率低 | P2 | Phase 3 |
| 平台可观测性与SLA | 缺失 | 无平台级 SLA 面板/API | 无故障趋势与可用性看板 | 运营不可视 | P1 | Phase 2 |
| 开放生态能力（Tenant API Key/Webhook） | 缺失 | 无对应域模型与接口 | 难以对接外部系统 | 扩展受限 | P2 | Phase 3 |

## 3. 分期补齐计划（SaaS 视角）

### Phase 0（先控风险，2 周）

1. 租户生命周期治理：冻结、恢复、下线流程（含操作原因、审批备注）。
2. 审计导出能力：按租户/时间导出 CSV。
3. 高风险操作双确认：订阅降级、成员移除、租户冻结。

交付验收：
- 出现违规/欠费租户时，平台可在 5 分钟内完成冻结并留痕。
- 平台操作可导出审计证据，支持复盘。

### Phase 1（商业与增长，3-4 周）

1. 活跃度看板：DAU、WAU、MAU、活跃租户数、7 日留存。
2. 付费看板：付费租户数、MRR、ARR、升级/降级、流失率。
3. 支付闭环：回调落库、幂等键、支付状态与订阅状态对齐。
4. 用量看板：每租户产品数、图片数、存储量、超限告警。

交付验收：
- 能按天查看活跃与收入趋势。
- 回调异常可追踪，收入指标可复算。

### Phase 2（安全与合规，4-6 周）

1. 平台会话治理：设备会话列表、强制登出、敏感操作二次验证。
2. 合规流程：租户数据导出、删除申请、留存策略配置。
3. 平台可观测性：关键 API 成功率、慢请求、任务失败告警。

交付验收：
- 平台账号安全与数据合规具备可执行流程。
- 关键指标异常能告警并定位。

### Phase 3（生态与规模化，按商业节奏）

1. 客服运营台：工单、公告、批量通知。
2. 开放能力：Tenant API Key、回调配置、重试机制。
3. 渠道与伙伴管理（如后续进入代理/ISV 模式）。

## 4. 建议新增平台 API（第一批）

1. `POST /admin/tenants/:tenantId/lifecycle/suspend`
2. `POST /admin/tenants/:tenantId/lifecycle/reactivate`
3. `POST /admin/tenants/:tenantId/lifecycle/offboard`
4. `GET /admin/audit-logs/export`
5. `GET /admin/analytics/activity/overview`
6. `GET /admin/analytics/revenue/overview`
7. `GET /admin/tenants/:tenantId/usage`
8. `GET /admin/billing/reconciliation`

## 5. 指标口径建议（避免后续扯皮）

1. 活跃租户：`7 天内发生至少 1 次写操作的租户`。
2. 付费租户：`subscription.plan != FREE 且 status = ACTIVE`。
3. MRR：`当月有效订阅的月化金额总和`（先按套餐映射，后续接真实订单）。
4. 流失率：`当月从付费转非付费的租户 / 月初付费租户`。

## 6. 需要你确认的产品策略

1. 平台是否需要“冻结租户后只读访问”而非完全禁用？
2. 付费看板是否先按“套餐映射金额”上线，再切真实订单金额？
3. 是否把“租户用量超限告警”作为默认开关（默认开启）？
4. 是否在 Phase 1 同步做“激活码管理列表（查询/禁用/备注）”？
