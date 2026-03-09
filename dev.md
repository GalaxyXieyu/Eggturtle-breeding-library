# 管理后台「用户治理」改造方案（统一版）

> 本文为 **dev.md 的整合版**：将早期“5 阶段重构计划”（平台总览增强 / 用户列表增强 / tabs 整合等）与后续“用户治理重规划 v2（运营驾驶舱）”统一为一条主线。
>
> **决策**：以 **v2（治理工作台 + 驾驶舱）** 为最终目标；早期方案中可复用的 API/字段/验收/风险内容已迁移到本版。

---

## 0. Context（背景）
当前管理后台存在以下问题：

1) **平台总览页面内容不足**：更像跳转页，仅有少量计数/审计记录，缺乏运营洞察与预警。
2) **用户列表信息不全**：只显示用户名称/slug/成员数/创建时间，无法按 Owner 登录账号/邮箱/手机号快速定位用户（例如找 galaxyxieyu 时只看到名称“Siri”）。
3) **用户管理页面分散**：用户目录（tenants）与成员权限（memberships）割裂，操作链路长。
4) **缺少活跃/登录的可观测**：没有 loginCount/lastLoginAt 等口径，无法判断“是否在用/最近是否登录”。

为什么需要重构：
- 用户治理的主入口应该能 **判断活跃、看到记录、直接治理**。
- 列表要能快速定位用户与 Owner；详情要能快速判断健康并给出治理动作。

---

## 1. 最终目标（v2）：治理工作台 + 用户驾驶舱

### 1.1 用户主入口改成“列表 + 详情侧栏”（治理工作台）

- 唯一主入口：`/dashboard/tenant-management`（页面标题统一为「用户」）
- 页面结构：左侧紧凑用户列表（面向治理），右侧选中用户的运营摘要（紧凑驾驶舱）。
- **不再**使用“目录 + 成员权限 + 大量重复信息”的 tabs 结构（memberships 并入右侧侧栏/详情页）。

**左侧列表（最小信息集）**
- 名称 + slug
- Owner 主标识：优先 `account`，其次 `email`，必要时 `phone`
- 套餐 / 状态（plan/status）
- 自动标签（最多展示 2 个最重要标签）

**左侧工具条（固定）**
- 搜索：name / slug / Owner 账号 / 邮箱 / 手机号
- 范围筛选：全部 / 付费 / 即将到期 / 低活跃 / 高活跃 / 无 Owner（可扩展）
- 结果计数

**右侧详情侧栏（紧凑驾驶舱摘要）**
- 自动标签（完整）
- 8 个紧凑指标（见 3.2）
- 最近 8 条业务操作（tenant 内真实业务操作，不是后台治理日志）
- 成员权限简版
- 快捷动作入口（冻结/解冻、生成激活码、跳转详情页等）

> 列表页行内移除冗余信息：不再把账号/邮箱/手机号/到期时间整块展开；按钮不常驻堆在每行。

### 1.2 用户详情页改成“完整驾驶舱”

- 详情页保留：`/dashboard/tenants/[tenantId]`
- 职责从“后台配置页”升级为：**用户画像 + 治理页**。

页面结构固定为 6 块（顺序不变）：
1) 概览头部：名称、slug、套餐、状态、自动标签
2) 活跃与登录：累计登录、30 天登录、最近登录、活跃天数、最近业务操作时间
3) 业务使用：产品数、图片总数、30 天上传数、分享数、存储使用 / 利用率
4) 最近业务操作：最近 20 条记录流，支持按类型筛选
5) 成员与权限：成员列表、角色调整、新增成员、移除成员
6) 治理动作：订阅、激活码、生命周期、后台治理日志（次级区块）

**记录优先**
- 默认展示 tenant 内真实业务动作；后台治理日志保留但降级到详情页后部的次级信息。

---

## 2. 数据与 API 方案（为 v2 服务）

### 2.1 列表页必须能定位 Owner（解决“找不到用户”）

增强 `GET /admin/tenants`：
- 返回 owner 信息（account/email/phone/name/id）
- 返回 subscription 信息（plan/expiresAt/disabledAt）并派生 `status`

搜索优化（保留原 name/slug 搜索，同时扩展 owner）：
- 支持按 Owner `account` 搜索
- 支持按 Owner `email` 搜索
- 支持按 Owner `phone` 搜索

（可复用原方案：Prisma include owner + subscription，并在 where 中 OR 扩展 owner 条件）

### 2.2 新增登录事件记录（解决“必须看登录次数”）

现有系统缺少 `loginCount / lastLoginAt` 等字段，本次必须补：

记录点（认证成功路径，固定 3 个）：
- 密码登录成功
- 邮箱验证码登录成功
- 手机验证码登录成功

统一新增 tenant 级业务审计动作（例如 `auth.login`），写入字段：
- `tenantId`
- `actorUserId`
- `loginMethod`（password / email_code / phone_code）
- `surface`（web / admin / unknown）

口径：
- 累计登录：从上线开始计数后的累计
- 30 天登录：最近 30 天窗口内登录次数
- 最近登录：最近一次登录时间

### 2.3 “业务操作流”与噪声控制

- 最近业务操作默认纳入：创建 / 编辑 / 上传 / 分享 / 兑换等写操作
- 默认排除：`share.access` 这类只读访问事件（噪声高），不纳入主列表

### 2.4 聚合接口（避免前端拼多次请求）

新增聚合接口（建议）：
- `GET /admin/tenants/:tenantId/insights`

返回：
- tenant 基础信息 / owner / subscription
- 自动标签（见 3.1）
- login metrics（累计/30天/最近）
- business metrics（活跃天数/最近业务操作/30天上传等）
- usage summary（存储/利用率等）
- recent business logs（最近 8/20 条）

现有 tenant detail、members、subscription、usage 等接口保留兼容，用于次级区块。

---

## 3. 自动标签体系（系统自动计算）

### 3.1 v1 固定标签集合
标签全部由系统自动计算，不做人工标签。

- 高活跃：最近 30 天有登录且业务操作天数达到阈值
- 低活跃：最近 30 天登录少且业务操作少
- 沉默中：最近 30 天无登录且无业务操作
- 即将到期：订阅 7 天内到期
- 已冻结：订阅已禁用
- 无 Owner
- 多人协作：成员数 >= 2
- 高上传
- 高分享
- 高存储

标签判定基于 tenant 聚合口径，不是 Owner 单人视角。

### 3.2 标签展示规则
- 列表页最多显示 2 个最重要标签
- 详情页显示全部命中标签，并附简单解释（why）

---

## 4. 实施路线图（按最短闭环推进）

> 总目标是 v2，但每个 Phase 都要可验收、可回滚。

### Phase 1：API 增强（必须）
- 修改 `admin-tenants.service.ts` 的 listTenants()：补 owner + subscription
- 扩展搜索条件（name/slug + owner.account/email/phone）
- 更新 `packages/shared/src/admin.ts` 中 `AdminTenant` 类型
- 新增登录事件记录（auth.login）并定义统计口径
- 新增 `GET /admin/tenants/:tenantId/insights`

**验收**
- 搜索 `galaxyxieyu` 能定位到对应 tenant
- insights 返回 login metrics + usage + recent business logs

### Phase 2：工作台（列表 + 侧栏）
- 重写 `/dashboard/tenant-management` 为“左列表 + 右侧栏”
- 左侧：搜索 + 筛选 + 自动标签
- 右侧：8 指标 + 最近业务操作 + 快捷治理动作

**验收**
- 运营/治理在 1 屏内能判断：谁在用、谁快到期、谁沉默、谁无 Owner

### Phase 3：详情页驾驶舱升级
- `/dashboard/tenants/[tenantId]` 按 6 块结构升级
- 最近业务操作默认优先，后台治理日志降级到后部

**验收**
- 详情页能回答：是否活跃、最近做了什么、该怎么治理

### Phase 4：平台总览增强（可选）
早期方案中的“平台总览做数据中心”可作为可选增强：
- 用户统计、会员统计、用量、系统健康等集中展示
- 但 **不要**与“租户治理主入口”混淆；租户治理以 tenant-management 为主。

### Phase 5：清理与优化
- 是否移除冗余 analytics 页面（先保留，等总览指标稳定再决定）
- 性能优化：索引/分页/缓存
- 增强：导出 CSV、批量操作、可配置阈值

---

## 5. 关键文件清单（按职责归类）

### API
- `/Users/apple/coding/Eggturtle-breeding-library/apps/api/src/admin/admin-tenants.service.ts`（增强用户查询）
- `/Users/apple/coding/Eggturtle-breeding-library/apps/api/src/admin/admin-analytics.service.ts`（如保留平台总览增强）

### Shared types
- `/Users/apple/coding/Eggturtle-breeding-library/packages/shared/src/admin.ts`（更新 AdminTenant / insights 类型）

### Admin 前端
- `/Users/apple/coding/Eggturtle-breeding-library/apps/admin/app/dashboard/tenant-management/page.tsx`（工作台主入口）
- `/Users/apple/coding/Eggturtle-breeding-library/apps/admin/app/dashboard/tenants/[tenantId]/page.tsx`（详情驾驶舱）
- `/Users/apple/coding/Eggturtle-breeding-library/apps/admin/components/dashboard/nav-config.ts`（导航更新）

（旧入口如 `/dashboard/tenants/page.tsx`、`/dashboard/memberships`：按 Phase 5 决定重定向/移除）

---

## 6. 风险与注意事项

- **性能**：列表查询增加 owner/subscription join + OR 搜索，可能影响性能。
  - 建议：分页 + 关键索引（tenant_members.role / tenant_id 等），必要时增加缓存。
- **数据一致性**：某些 tenant 可能没有 OWNER，必须兜底（打“无 Owner”标签）。
- **口径一致性**：登录统计从上线开始累计，需在 UI 标注。
- **事件噪声**：最近业务操作流要控制噪声，避免只读 access 淹没写操作。

---

## 7. 验收清单（最终 DoD）

1) 治理工作台
- 左侧列表能按 owner/account/email/phone 搜索
- 显示 plan/status + 自动标签
- 右侧侧栏能展示 8 指标 + 最近业务操作 + 快捷动作

2) 用户详情驾驶舱
- 能看到登录与活跃
- 能看到最近业务操作流（默认优先）
- 成员权限与治理动作完整

3) 数据闭环
- 登录事件有记录
- insights 聚合接口可支撑前端一次加载（或少量请求）

