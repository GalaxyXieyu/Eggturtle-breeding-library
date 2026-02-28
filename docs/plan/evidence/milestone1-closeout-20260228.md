# Milestone 1 Closeout（2026-02-28）

负责人：宇宇

## 里程碑范围
Milestone 1 目标是完成 Series/Breeders 只读链路（API + Web 入口 + 可展示数据 + 基础回归）。

## 交付与证据
- PR#7（Series/Breeders API + contracts + api-tests）
  - https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/7
- PR#8（Web 入口页 + demo 数据）
  - https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/8
- PR#9（seed 日志脱敏修复）
  - https://github.com/GalaxyXieyu/Eggturtle-breeding-library/pull/9
- API 回归证据
  - `out/t37-series-breeders-full-run/20260228-070349/summary.md`
- Web smoke 证据
  - `docs/evidence/m1-web-series-breeders-smoke-20260228.md`

## 验收清单（可复核）
- [x] API：`/series`、`/series/:id`、`/breeders`、`/breeders/:id`、`/breeders/:id/events`、`/breeders/:id/family-tree`
- [x] UI：`/app/[tenantSlug]/series`、`/app/[tenantSlug]/breeders`、`/app/[tenantSlug]/breeders/[id]`
- [x] Demo 数据：series/breeders/events 可稳定展示
- [x] 安全卫生：移除 seed 日志中的敏感连接串

## 回滚开关（你问的这个）
“回滚开关”指的是：**不发新代码也能快速降低风险/关闭能力的环境配置开关**。

当前可用开关：
- `SUPER_ADMIN_ENABLED=false`
  - 作用：关闭 super-admin 能力（`/admin/*` 被 guard 阻断）
- `SUPER_ADMIN_EMAILS=`（清空）
  - 作用：即使开启 super-admin，也无人可通过 allowlist
- `NEXT_PUBLIC_SUPER_ADMIN_ENABLED=false`
  - 作用：前端隐藏 super-admin 入口（防误操作）
- `AUTH_DEV_CODE_ENABLED=false`
  - 作用：关闭开发环境验证码直显，避免误用

## 禁用入口策略（应急）
- 平台侧：将 `NEXT_PUBLIC_SUPER_ADMIN_ENABLED=false`，并重启 admin/web 服务。
- 租户侧（Milestone 1 入口）：临时从 dashboard 移除 `series/breeders` 入口按钮（小补丁可秒回滚）。

## 回滚预案（执行顺序）
1. 先切环境开关（上面 4 个），立刻止损。
2. 若问题仍在，回滚对应 PR（优先回滚最近引入风险的 PR）。
3. 回归验证：`pnpm -r lint && pnpm -r build` + 关键 smoke。

## 结论
Milestone 1 满足收口条件，可标记为完成。
