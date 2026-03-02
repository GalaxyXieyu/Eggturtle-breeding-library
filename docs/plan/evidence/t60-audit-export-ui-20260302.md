# T60 审计日志导出（CSV）UI 验收记录（Admin）

- 日期：2026-03-02
- 范围：`apps/admin` `/dashboard/audit-logs` 导出 CSV 入口与交互
- 实现文件：`apps/admin/app/dashboard/audit-logs/page.tsx`

## 实现要点

1. 在审计日志页头部新增 `导出 CSV` 按钮（复用 `AdminPageHeader` + `AdminPanel` + `AdminTableFrame` 样式体系）。
2. 导出请求复用“当前已应用筛选条件”（tenantId / actorUserId / action / from / to），并带 `limit=2000`。
3. 点击导出后：
   - 按钮进入 loading（`导出中...`）且禁用
   - 展示 toast（`正在准备 CSV 导出...`）
4. 成功后：
   - 使用 `Blob + a[download]` 触发浏览器下载
   - 优先使用 `Content-Disposition` 文件名；无文件名时回退 `audit-logs-<ISO日期>.csv`
   - 成功 toast / 页面反馈文案显示 `CSV 已下载`
5. 失败后：
   - toast 错误提示
   - 页面错误提示仅展示脱敏文案（不透出后端堆栈）

## 最终调用路径（按仓库现状）

- 前端页面调用：`GET /api/proxy/admin/audit-logs/export?...`
- Admin Proxy 转发：`apps/admin/app/api/proxy/admin/[...path]/route.ts` -> `${ADMIN_API_BASE}/admin/audit-logs/export?...`

## 验收步骤（UI）

1. 启动 Admin：`pnpm --filter @eggturtle/admin exec next dev -p 30021`
2. 登录后台后访问：`http://127.0.0.1:30021/dashboard/audit-logs`
3. 验证入口：页面头部可见 `导出 CSV` 按钮；筛选区提示“导出会复用当前已应用筛选条件，最多导出 2000 行”。
4. 验证失败态（本地接口未就绪）：点击导出后显示失败提示文案（示例：`导出接口暂不可用，请稍后重试。`），不暴露堆栈。
5. 验证 loading + 成功态（使用浏览器内 mock fetch 注入 200 CSV 响应）：
   - 点击后按钮显示 `导出中...`
   - 出现 info toast `正在准备 CSV 导出...`
   - 请求返回后出现成功反馈 `CSV 已下载`
   - 通过页面执行日志确认已执行 `createObjectURL` / `revokeObjectURL` 下载流程

## 证据截图

- `out/ui-smoke/20260302-204427/01-audit-export-entry.jpg`（入口与筛选提示）
- `out/ui-smoke/20260302-204427/04-audit-export-loading-toast.jpg`（点击后 loading + toast）
- `out/ui-smoke/20260302-204427/03-audit-export-loading-attempt.jpg`（接口未就绪失败提示）

## 备注

- 当前仓库里存在其他未提交改动；本任务仅提交 T60 UI 相关文件。
