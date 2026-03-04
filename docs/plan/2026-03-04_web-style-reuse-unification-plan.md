# Web 样式复用与统一改造计划（评审版）

- 日期：2026-03-04
- 状态：Draft（你确认后再开始改代码）
- 使用技能：`ui-ux-test`
- 目标仓库：`/Volumes/DATABASE/code/Eggturtle-breeding-library`

## 1. 问题背景与证据

当前 `apps/web` 的样式和展示逻辑存在以下结构性问题：

1. 样式体量大且来源混杂。
   - `apps/web/app/globals.css` 2053 行，`apps/web/app/page.module.css` 644 行。
   - 同时混用全局 CSS、CSS Module、Tailwind 长串 class。

2. 可复用样式重复定义。
   - 按钮/卡片/输入框在多个页面重复写，缺少统一组件消费。
   - `ui/button` 已存在，但仍有大量原生 `<button className=...>` 平行实现。

3. 分享端与后台端“宠物卡片”存在平行重写。
   - 后台产品卡：`apps/web/app/app/[tenantSlug]/products/page.tsx:1063`
   - 分享卡片：`apps/web/app/public/_public-product/components.tsx:220`
   - 两者结构和样式片段高度同构。

4. 业务格式化逻辑重复。
   - `formatSex` 在多个页面重复定义（当前 5 处）。
   - `formatPrice` 在多个页面重复定义（当前 2 处）。

5. 全局 CSS 中存在未引用类。
   - 已扫描出一批疑似无引用类（约 20% 量级），增加后续 AI 修改噪音。

## 2. 最终目标（本轮）

本轮目标是“先统一复用骨架，再清理冗余”，不做视觉大改。

1. 宠物卡片复用目标。
   - 后台端产品预览卡与分享端卡片统一到同一可复用组件（支持 variant）。

2. 文案/格式化复用目标。
   - `formatSex`、`formatPrice`、`formatShortDate` 收敛到统一工具文件，页面内不再重复定义。

3. 样式一致性目标。
   - 按钮/徽章/标签优先复用 `ui` 组件和共享 class 片段，减少长串 class 拷贝。

4. 可维护性目标。
   - 清理确认无引用的全局类，降低全局 CSS 干扰。

5. 质量门禁目标（按 ui-ux-test 规则）。
   - P0 用例通过率 = 100%
   - P1 用例通过率 >= 90%
   - Mobile 必测（`mobile_required: true`）

## 3. 修改范围文件

## 3.1 本轮必改文件（第一批提交）

1. 新增：`apps/web/lib/pet-format.ts`
   - 收敛 `formatSex` / `formatPrice` / `formatShortDate`。

2. 新增：`apps/web/components/pet/pet-card.tsx`
   - 提供可复用宠物卡骨架，支持 `variant: tenant | public`。

3. 新增：`apps/web/components/pet/pet-card-badges.tsx`
   - 提供状态 badge、性别 badge、价格 badge、时间 chips。

4. 新增：`apps/web/components/pet/index.ts`
   - 统一导出 pet 组件。

5. 修改：`apps/web/app/app/[tenantSlug]/products/page.tsx`
   - 用共享 `PetCard` 替换内联卡片 JSX。
   - 移除本页重复 `formatSex/formatShortDate`。

6. 修改：`apps/web/app/public/_public-product/components.tsx`
   - `BreederCard` 改为消费共享 `PetCard`。

7. 修改：`apps/web/app/public/[tenantSlug]/page.tsx`
   - 复用 `pet-format`，去掉本地 `formatSex/formatPrice` 重复实现。

8. 修改：`apps/web/app/public/[tenantSlug]/products/[productId]/page.tsx`
   - 复用 `pet-format`，去掉本地 `formatSex/formatPrice` 重复实现。

9. 修改：`apps/web/app/app/[tenantSlug]/breeders/page.tsx`
   - 复用 `pet-format`（至少替换 `formatSex`）。

10. 修改：`apps/web/app/app/[tenantSlug]/breeders/[id]/page.tsx`
    - 复用 `pet-format`（至少替换 `formatSex`）。

## 3.2 第二批可选文件（本轮后半）

1. 修改：`apps/web/app/globals.css`
   - 清理确认无引用的类（以 grep 结果为准，逐批删除）。

2. 修改：`apps/web/components/ui/button.tsx`
   - 如有必要，补充可复用 variant（避免页面继续写新按钮样式）。

3. 修改：`apps/web/app/public/_public-product/public-feed-page.tsx`
   - 抽离筛选 chips 的重复样式片段。

## 3.3 本轮不做（明确排除）

1. 不做分享路由架构大合并（`_legacy` 全量删除不在本轮）。
2. 不做登录页视觉重做（`/login` 先保持行为稳定）。
3. 不改 API 协议与服务端字段。

## 4. 分阶段执行步骤

## Phase 0：基线与冻结（不改业务代码）

1. 记录当前重复点基线：
   - 重复格式化函数数量。
   - 主要重复 class 串数量。
   - 目标页面视觉截图基线。

2. 初始化 UI/UX 测试台账（见第 5 节命令）。

## Phase 1：抽共享工具与组件

1. 新建 `pet-format.ts`，统一格式化函数。
2. 新建 `PetCard` + `PetCardBadges`，先覆盖“当前已确认同构”的字段：
   - 封面图
   - 性别标识
   - 价格标识
   - 状态标识（待配/预警）
   - 时间 chips（产蛋/交配）

## Phase 2：替换页面消费（低风险路径）

1. 先替换后台产品页卡片（`products/page.tsx`）。
2. 再替换分享端 `BreederCard`（`_public-product/components.tsx`）。
3. 最后替换各页面内重复 `formatSex/formatPrice` 定义。

## Phase 3：样式清理与收口

1. 清理确定无引用的全局类（小批次、每批可回滚）。
2. 如页面仍新增原生按钮样式，则补 `ui/button` variant 收口。

## Phase 4：回归验证与报告

1. 跑 lint/build。
2. 按 UI/UX 用例执行并回填 CSV。
3. 生成图文报告并回填任务台账。

## 5. 测试方案（按 ui-ux-test skill）

## 5.1 初始化测试资产

```bash
RUN_ID="web-style-reuse-20260304"
SKILL_ROOT="/Users/galaxyxieyu/.codex/skills/ui-ux-test"

node "$SKILL_ROOT/scripts/init_uiux_plan.js" \
  --run-id "$RUN_ID" \
  --out-dir "out/ui-ux-plan/$RUN_ID"
```

生成后会得到：
- `out/ui-ux-plan/$RUN_ID/01_scope.csv`
- `out/ui-ux-plan/$RUN_ID/02_coverage_matrix.csv`
- `out/ui-ux-plan/$RUN_ID/03_test_cases.csv`
- `out/ui-ux-plan/$RUN_ID/04_execution_log.csv`
- `out/ui-ux-plan/$RUN_ID/05_bug_list.csv`
- `out/ui-ux-plan/$RUN_ID/06_summary.csv`

## 5.2 覆盖矩阵（必须覆盖 6 维）

受影响模块至少填入：
1. `Auth/Login`（冒烟，保证未回归）
2. `Tenant Products`（核心改造模块）
3. `Public Feed`（核心改造模块）
4. `Public Product Detail`
5. `Breeders List/Detail`（格式化函数迁移）
6. `Theme & Responsive`（light/dark + mobile）

每个模块在 `02_coverage_matrix.csv` 覆盖：
- `Critical Flow`
- `Permission`
- `Data Integrity`
- `Error Recovery`
- `Responsive`
- `Observability`

## 5.3 执行前预检

```bash
bash "$SKILL_ROOT/scripts/preflight.sh" \
  --web-url "http://localhost:30010/login" \
  --admin-url "http://localhost:30020/login" \
  --api-health-url "http://localhost:30011/health" \
  --lint-cmd "pnpm --filter @eggturtle/web lint" \
  --build-cmd "pnpm --filter @eggturtle/web build"
```

## 5.4 关键测试用例建议（写入 03_test_cases.csv）

1. `TC-P0-001` Tenant Products 卡片渲染正确（桌面）
2. `TC-P0-002` Tenant Products 卡片渲染正确（移动端）
3. `TC-P0-003` Public Feed 卡片渲染正确（桌面）
4. `TC-P0-004` Public Feed 卡片渲染正确（移动端）
5. `TC-P0-005` 状态 badge（待配/预警）显示与旧逻辑一致
6. `TC-P0-006` 性别/价格/日期格式化与旧逻辑一致
7. `TC-P1-001` Light/Dark 切换后可读性和层级正常
8. `TC-P1-002` 联系方式区块在分享页/详情页一致
9. `TC-P1-003` 登录页未受本轮改造影响（冒烟）
10. `TC-P1-004` 异常/空状态（无封面、无价格、无描述）展示正常

## 5.5 执行记录规则（04_execution_log.csv）

1. 每条执行完立即回填。
2. `result` 只能用：`PASS/FAIL/BLOCKED/NOT_RUN`。
3. `FAIL` 必须标 `failure_type`：`PRODUCT/ENV/GAP`。
4. 每条必须有 `evidence_path`，建议同时填 `screenshot_path`。
5. 证据目录建议：`out/ui-smoke/$RUN_ID/<module>/<case_id>-<viewport>-<theme>.png`

## 5.6 报告生成

```bash
node "$SKILL_ROOT/scripts/generate_uiux_report.js" \
  --execution-csv "out/ui-ux-plan/$RUN_ID/04_execution_log.csv" \
  --bugs-csv "out/ui-ux-plan/$RUN_ID/05_bug_list.csv" \
  --output "out/ui-ux-plan/$RUN_ID/ui-ux-test-report-$RUN_ID.md" \
  --title "UI/UX 测试报告 - Eggturtle Web 样式复用改造" \
  --project "eggturtle-breeding-library" \
  --run-id "$RUN_ID" \
  --p0-threshold 1 \
  --p1-threshold 0.9
```

## 6. 验收标准

1. `formatSex/formatPrice/formatShortDate` 页面内重复定义清零（统一从 `pet-format` 导入）。
2. 后台产品卡 + 分享卡片使用同一共享组件（允许 variant 差异）。
3. 无新增“超长 class 拷贝块”到页面层。
4. `@eggturtle/web` lint/build 通过。
5. UI/UX 门禁：P0=100%，P1>=90%，移动端关键路径通过。

## 7. 风险与回滚

1. 风险：共享组件抽象过度，导致页面需要大量条件分支。
   - 控制：先抽最小公共子集，差异部分走 `variant` + slots。

2. 风险：全局 CSS 清理误删。
   - 控制：仅删“搜索零引用 + 页面回归通过”的类；按小批次提交。

3. 风险：分享端存在多套路由实现，改一套漏一套。
   - 控制：本轮只覆盖当前主路径（`_public-product` + `public/[tenantSlug]`），`_legacy` 单独列后续任务。

4. 回滚策略：按 phase 小步提交，出现回归可回退最近一个 phase 提交。

## 8. 开始修改前确认项

请确认以下两点，我再开始改代码：

1. 是否按“第一批必改文件”先做一轮可交付（不动 `_legacy` 大清理）？
2. `globals.css` 的未引用类清理，是本轮一起做，还是放到第二批？

