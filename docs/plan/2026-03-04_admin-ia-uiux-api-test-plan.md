# Admin IA 与测试实施清单（2026-03-04）

## 1. 目标与结论

本轮针对 `apps/admin` 完成三项主线优化：

1. 信息架构收敛为「总览 / 数据 / 租户治理」。
2. 导航与内容骨架统一，移动端交互可用性提升。
3. 中英文混用止血：后台锁定中文展示，减少认知负担。

同时整理了可执行的 UI/UX 与接口测试清单，作为今晚联调基线。

## 2. 实施范围（已落地）

### 2.1 IA 与侧边栏导航

- 导航分组改为：
  - 总览：`/dashboard`
  - 数据：`/dashboard/analytics`、`/dashboard/usage`、`/dashboard/billing`
  - 租户治理：`/dashboard/tenants`、`/dashboard/memberships`、`/dashboard/audit-logs`
- 去除重复语义入口（侧边栏不再出现 activity/revenue 的重复子入口）。
- 每个导航项增加图标字段，折叠态仍可识别。

涉及文件：
- `apps/admin/components/dashboard/nav-config.ts`
- `apps/admin/components/dashboard/dashboard-sidebar.tsx`

### 2.2 移动端适配（复用 apps/web 的模式）

复用了 `apps/web` 中成熟的移动端适配思路，而非新造一套：

- 复用点 1：`100svh` 视口高度策略（参考 `apps/web/app/globals.css` 的租户控制台壳层）。
- 复用点 2：移动端安全区 `env(safe-area-inset-bottom)` 处理。
- 复用点 3：移动端固定层 + 遮罩层交互模式（与 web 端移动浮层策略一致）。

Admin 侧落地效果：
- 桌面保持可折叠侧边栏。
- 移动端改为抽屉式侧边栏 + 遮罩关闭。
- 顶部按钮在移动端切换抽屉开关。

涉及文件：
- `apps/admin/components/dashboard/dashboard-shell.tsx`
- `apps/admin/components/dashboard/dashboard-topbar.tsx`
- `apps/admin/app/globals.css`

### 2.3 面包屑业务化

- 面包屑改为可点击导航（非当前项可点击）。
- 租户详情页支持显示实体名（优先租户名，降级短 ID）。
- IA 语义同步到面包屑（数据/租户治理层级）。

涉及文件：
- `apps/admin/components/dashboard/dashboard-topbar.tsx`

### 2.4 内容骨架统一

已将割裂明显页面迁移到统一骨架：
- `AdminPageHeader + AdminPanel + AdminTableFrame`

已改页面：
- `apps/admin/app/dashboard/page.tsx`
- `apps/admin/app/dashboard/memberships/page.tsx`

### 2.5 中文止血策略

- 禁用语言切换能力（保留主题切换）。
- locale 统一为 `zh`。
- 清理租户详情页关键英文文案（标题、按钮、提示、确认弹窗、错误文案等）。

涉及文件：
- `apps/admin/components/ui-preferences.tsx`
- `apps/admin/app/dashboard/tenants/[tenantId]/page.tsx`
- `apps/admin/app/dashboard/audit-logs/page.tsx`
- `apps/admin/app/dashboard/tenants/page.tsx`
- `apps/admin/app/dashboard/analytics/page.tsx`
- `apps/admin/app/dashboard/usage/page.tsx`
- `apps/admin/app/dashboard/billing/page.tsx`

### 2.6 第二轮枚举中文化统一（已落地）

本轮补齐“英文枚举值直出”问题，统一通过标签映射渲染：

- 新增统一标签工具：`apps/admin/lib/admin-labels.ts`
  - 套餐：`FREE/BASIC/PRO` -> `免费版/基础版/专业版`
  - 角色：`OWNER/ADMIN/EDITOR/VIEWER` -> `所有者/管理员/编辑者/查看者`
  - 订阅状态：`ACTIVE/DISABLED/EXPIRED` -> `生效中/已冻结/已过期`
  - 用量指标与状态：`products/images/shares/storageBytes`、`ok/near_limit/exceeded/unlimited`
  - 审计动作：`admin.xxx` -> 中文动作说明
- 业务页面接入映射：
  - `apps/admin/app/dashboard/usage/page.tsx`
  - `apps/admin/app/dashboard/billing/page.tsx`
  - `apps/admin/app/dashboard/tenants/[tenantId]/page.tsx`
  - `apps/admin/app/dashboard/audit-logs/page.tsx`
  - `apps/admin/app/dashboard/memberships/page.tsx`

## 3. UI/UX 测试清单（今晚执行）

环境：本地开发栈

### 3.1 入口与前置

1. 启动：`pnpm dev:start`
2. 打开后台：`http://localhost:30020/dashboard`
3. 使用管理员账号登录
4. 测试视口：
   - 桌面：1440 x 900
   - 移动：390 x 844（或 DevTools iPhone 13）

### 3.2 IA 与导航验收

1. 侧边栏仅有三组：总览 / 数据 / 租户治理。
2. 数据组仅有：活跃度 / 用量 / 营收。
3. 租户治理组仅有：租户目录 / 成员权限 / 操作记录。
4. 菜单点击后内容语义一致，不出现“不同菜单同页面感知”。

### 3.3 交互验收

1. 桌面：折叠后仍可用图标识别入口。
2. 移动：点击顶部按钮可打开/关闭抽屉。
3. 移动：点击遮罩可关闭抽屉。
4. 移动：点击菜单项后抽屉自动关闭。
5. 移动：页面可滚动，抽屉打开时无遮挡异常。

### 3.4 面包屑验收

1. 面包屑非当前项可点击返回。
2. 租户详情页显示租户名（失败时显示短 ID）。
3. 当前页面标题与面包屑最后一级一致。

### 3.5 内容骨架与表格验收

1. 总览页与成员页均使用统一骨架组件。
2. 列表页表格均在 `AdminTableFrame` 容器中。
3. 移动端表格支持横向滚动，不发生裁切溢出。

### 3.6 文案一致性验收

1. 后台页面无明显英文提示混入。
2. 租户详情页核心操作文案全中文。
3. 主题切换可用，语言切换入口不显示。
4. 套餐、角色、订阅状态、用量状态、审计动作均显示中文标签（不再直出英文枚举）。

## 4. 接口测试清单（今晚执行）

### 4.1 基础命令

1. 干跑（不发请求）：
```bash
pnpm api-tests -- --only admin
```

2. 真跑（写操作开启）：
```bash
pnpm api-tests -- --only admin --confirm-writes --clear-token-cache
```

3. 管理域回归（含多个模块）：
```bash
pnpm api-tests:gate
```

### 4.2 重点验证项

1. 权限边界：
- 非 super-admin 访问 `/admin/*` 必须拒绝。

2. 治理链路：
- 成员新增、降权、移除后权限即时生效。
- 审计导出 CSV 行为正确（含上限提示）。

3. 生命周期：
- suspend / reactivate / offboard 状态转换正确。
- 订阅状态与禁用信息一致。

### 4.3 证据归档

建议产物路径：
- `docs/plan/evidence/admin-uiux-20260304.md`
- `docs/plan/evidence/admin-api-20260304.md`

记录格式建议：
- 场景名
- 执行步骤
- 实际结果
- 结论（PASS/FAIL）
- 截图或日志路径

## 5. 回归通过标准

满足以下条件即可进入下一轮视觉微调：

1. `@eggturtle/admin` lint 通过。
2. `@eggturtle/admin` build 通过。
3. UI/UX 清单关键项全部通过。
4. API 管理域测试通过（至少 `admin` 模块）。

## 6. 下一步建议（可选）

1. 若要继续做国际化：
- 基于字典键迁移文案，不再在页面内混写 `zh/en` 长对象。

2. 若要加自动化 UI：
- 下一轮引入 Playwright 最小套件（登录、导航、租户治理三条冒烟流）。
