# 智能分析一期配额与计费规格

状态：规格与接口占位阶段（未进入完整结算实现）
更新日期：2026-02-28

## 1. 目的

定义 AI 海龟照片分析在一期的最小可执行配额模型，重点是可落地、可控成本，而非完整财务结算。

## 2. 配额模型（已确认）

核心规则：
- 配额单位：`image_count`（按上传图片张数计费，不按请求次数计）
- 配额范围：按租户
- 配额周期：按月重置
- 单次请求图片数：1-3 张

输入大小限制：
- 单图不超过 `10 MB`
- 建议单次总输入不超过 `30 MB`
- 超限请求在调用模型前直接拒绝

商业化行为：
- 基础套餐按月提供图片额度
- 试用基线：每租户每月 10 张
- 支持购买图片加油包（附加额度）
- 剩余额度不足时，API 必须返回可触发前端充值弹窗的错误载荷

## 3. 执行时机（请求生命周期）

1. 鉴权与租户上下文校验
2. 功能开关与模型策略校验
3. 输入校验（格式、张数、大小）
4. 限流校验（用户维度 + 租户维度）
5. 配额预校验（本次需要的 `image_count`）
6. 调用模型
7. 记录用量与审计日志（含耗时、模型、令牌统计）
8. 最终记账
- 成功：扣减本次图片额度
- 失败：退款策略可配置，一期默认可按“失败返还”执行

## 4. 审计与日志字段

必填结构化字段：
- `requestId`
- `tenantId`
- `userId`
- `action`（例如 `ai.turtle_analysis`）
- `modelId`
- `provider`
- `quotaUnit`（固定为 `image_count`）
- `quotaConsumed`
- `quotaRemaining`
- `quotaResetAt`
- `inputImageCount`
- `inputBytes`
- `promptTokens`（可空）
- `completionTokens`（可空）
- `totalTokens`（可空）
- `latencyMs`
- `result`（`success | blocked | error`）
- `errorCode`（可空）
- `createdAt`

日志禁止项：
- 模型提供方密钥
- 原始签名 URL
- 非必要的用户敏感数据

## 5. 限流建议

一期建议：
- 维度：`tenantId + userId + route`
- 窗口：60 秒内最多 10 次
- 突发：超限后返回带重试提示

实现建议：
- 本地单实例可使用内存限流
- 多实例部署应使用共享存储（如 Redis）

## 6. 错误语义（接口占位）

### 6.1 配额耗尽（触发付费引导）

- HTTP：优先 `402 Payment Required`，必要时可降级为 `429`
- `errorCode`：`QUOTA_EXCEEDED`
- 响应体应包含前端弹窗所需的加油包信息

示例：

```json
{
  "message": "本月图片额度已用完。",
  "errorCode": "QUOTA_EXCEEDED",
  "statusCode": 402,
  "data": {
    "remaining": 0,
    "resetAt": "2026-03-01T00:00:00.000Z",
    "purchase": {
      "packs": [
        {
          "id": "pack_100",
          "name": "100 张图片加油包",
          "imageCredits": 100,
          "priceCents": 990,
          "currency": "CNY"
        }
      ]
    }
  }
}
```

### 6.2 输入过大（单图超过 10 MB）

- HTTP：`413 Payload Too Large`
- `errorCode`：`INVALID_REQUEST_PAYLOAD`

示例：

```json
{
  "message": "存在超过 10 MB 的输入图片。",
  "errorCode": "INVALID_REQUEST_PAYLOAD",
  "statusCode": 413,
  "data": {
    "maxSingleImageBytes": 10485760,
    "actualSingleImageBytes": 14680064
  }
}
```

### 6.3 相关 AI 错误码

- `AI_FEATURE_DISABLED`
- `AI_MODEL_NOT_CONFIGURED`
- `AI_RATE_LIMITED`
- `AI_PROVIDER_ERROR`

以上错误码定义见：`packages/shared/src/error-codes.ts`。

## 7. 接口占位契约

契约文件：`packages/shared/src/ai.ts`

建议端点：
- `GET /ai/quota/status`
  - 响应：`aiQuotaStatusResponseSchema`
- `POST /ai/turtle-analysis`
  - 请求：`turtleAnalysisRequestSchema`
  - 响应：`turtleAnalysisResponseSchema`

错误响应占位：
- `aiQuotaExceededErrorResponseSchema`
- `aiInputTooLargeErrorResponseSchema`

路由约定提醒：API 不带 `/api` 前缀。

## 8. 上线约束

- 一期仅允许建议型输出，并强制免责声明。
- 禁止输出诊断结论。
- 禁止给出药物与治疗方案。
- 超出配额计数模型的完整结算能力需单独立项出规格。
