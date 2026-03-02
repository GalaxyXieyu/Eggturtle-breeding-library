# T76 后台功能接口完善收口（2026-03-02）

## 本次收口范围

- 产品接口契约：`offspringUnitPrice` 与 `sex` 的跨字段约束与后端行为对齐。
- 分享/订阅规则：明确并回归验证“`maxShares` 不限制分享创建次数”。
- 文档对齐：更新技术口径与代码证据索引。

## 代码变更

- `packages/shared/src/product.ts`
  - 为 `createProductRequestSchema` 增加跨字段校验：`offspringUnitPrice` 仅允许 `sex=female`。
  - 为 `updateProductRequestSchema` 增加跨字段校验：当请求同时带 `sex` 与 `offspringUnitPrice` 时，非 `female` 拒绝。
- `scripts/api-tests/products.ts`
  - 调整 products 回归用例以匹配当前规则：
    - male 创建默认 `offspringUnitPrice=null`
    - male + `offspringUnitPrice` 创建应 400（`INVALID_REQUEST_PAYLOAD`）
    - female 改为 male 后自动清空 `offspringUnitPrice`
- `scripts/api-tests/subscription.ts`
  - 在 `maxShares=1` 下新增“连续两次创建分享均成功”断言，固化“分享不按 maxShares 限制次数”的现行规则。
- `docs/technical-reference.md`
  - 更新时间改为 `2026-03-02`。
  - 补充产品与分享/订阅规则对应的代码与回归测试证据。

## 验证结果

- Build / Lint / API Tests 证据目录：
  - `out/t76-backend-interface/20260302-120710/summary.md`
  - `out/t76-backend-interface/20260302-120710/shared-build.log`
  - `out/t76-backend-interface/20260302-120710/api-lint.log`
  - `out/t76-backend-interface/20260302-120710/api-build.log`
  - `out/t76-backend-interface/20260302-120710/api-tests.jsonl`
- API Tests 结果（`products,shares,subscription`）：
  - `runner.done modules=3 totalChecks=28`
  - `products.done checks=8`
  - `shares.done checks=7`
  - `subscription.done checks=13`

## 风险与备注

- products 用例中的 series 过滤断言在“租户无 series 数据”时仍按既有逻辑跳过（非阻断）。
- 订阅模型当前沿用 `maxShares` 作为产品数量覆盖值（历史兼容口径），本次已通过文档与回归用例明确现状。
