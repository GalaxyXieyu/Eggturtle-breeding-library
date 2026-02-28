# UI-UX 测试复盘与持续优化报告

更新日期: 2026-02-28

## 一句话结论

本轮 UI/UX 烟测流程已经可用，但还不够“工程化自动执行”。下一步要从“能跑一次”升级到“稳定可重复 + 自动回填 + 持续优化”。

## 本轮做得好的地方

- 已形成完整测试资产：目标范围、测试路径、评估标准、执行顺序。
- 已形成证据链：截图目录、API 补测日志、任务表回填。
- 已能区分部分环境中断与产品问题，避免误判。

## 问题点（必须改）

1. 环境预检不够前置。
- 现象：执行中才发现 API 临时不可用或 DevTools 会话中断。
- 影响：产生假失败，浪费排障时间。

2. 产物路径和命名存在漂移。
- 现象：计划文件在 `docs/plan` 与 `out/share` 两处存在副本。
- 影响：团队不确定“哪个是最终版本”。

3. 结果回填仍偏手工。
- 现象：状态统计和文档快照可能滞后。
- 影响：任务板真实度下降，协作判断失真。

4. 部分链路仍是 API-backed 兼容验证。
- 现象：products-create-upload 等场景在 UI 侧尚未完整落地。
- 影响：UI 验收与真实用户路径存在偏差。

5. 上线前总验收 SOP 尚未完全收口。
- 现象：`T33` 仍未 done。
- 影响：上线与回滚动作可执行性不够强。

## 优化点（可执行）

1. 建立 preflight 脚本。
- 固定检查 lint/build/health/端口可达。
- 失败直接标记 `ENV-BLOCKED` 并中止。

2. 统一单一路径规则。
- 计划文件以 `docs/plan` 为准。
- `out/` 只存运行时产物，不存“主计划副本”。

3. 建立报告生成与台账回填脚本。
- 从执行结果生成中文报告模板。
- 自动更新 `EggsTask.csv` 的状态候选并保留人工复核。

4. 补齐 UI 缺口链路。
- 优先把 `products-create-upload` 从 API-backed 迁回 UI 可执行。

5. 收口上线验收与回滚 SOP。
- 将命令、开关、回滚顺序和复测命令写成固定清单。

## 任务落位（已入任务表）

- `T57` UI-UX Test Skill v1 通用化（跨项目）
- `T58` UI-UX smoke preflight 自动化
- `T59` Smoke 报告生成与任务回填脚本
- `T60` Web products-create-upload UI 补齐
- `T61` 上线总验收与回滚 SOP 收口（T33 子任务化）

## 通用化落地方式

- Skill 主体保持通用：`skills/ui-ux-test/SKILL.md`
- 项目差异放入 profile：`skills/ui-ux-test/references/profile.eggturtle.yaml`
- 新项目复用时仅新增 `skills/ui-ux-test/references/profile.<project>.yaml`
- 模板统一来源：`skills/ui-ux-test/assets/templates/*`
- 自动化脚本：
  - `node skills/ui-ux-test/scripts/init_uiux_plan.js` 初始化测试表
  - `bash skills/ui-ux-test/scripts/preflight.sh` 运行前预检
  - `node skills/ui-ux-test/scripts/generate_uiux_report.js` 生成图文报告（含截图链接）

## 持续开发节奏建议

- 第一波：`T57 + T58`（先把执行稳定性打牢）
- 第二波：`T59 + T60`（把回填自动化并消灭 API-backed 缺口）
- 第三波：`T61`（形成上线前一键验收口径）
