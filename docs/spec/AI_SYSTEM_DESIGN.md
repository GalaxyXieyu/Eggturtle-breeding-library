# 智能分析系统设计规格（一期 + 配置）

状态：设计规格阶段（可分阶段实现）
更新日期：2026-02-28

关联文档：
- `docs/spec/SAAS_SPEC.md`
- `docs/spec/AI_PHASE_A.md`
- `docs/spec/AI_QUOTA_BILLING.md`

## 1. 范围

AI 一期能力为“建议型海龟照片分析”：
- 用户上传 1-3 张照片 + 可选基础信息
- 系统输出结构化建议文本（观察、风险、养护、复查）
- 必须包含“非医疗诊断”免责声明

同时定义：模型配置方式、租户配额与用量跟踪、日志规范。

## 2. 已确认产品决策

- 公开分享链接持有者可访问。
- AI 输出仅作建议，不做医疗诊断。
- 配额按图片张数计费，按租户计，按月重置。

## 3. 模块架构

### 3.1 后端（`apps/api`）

- `ai/`（接口层）
  - `POST /ai/turtle-analysis`（需鉴权，按租户生效）
  - 使用 `@eggturtle/shared` 的 Zod 契约做输入校验
  - 负责配额校验、用量记录、审计记录

- `ai-providers/`（模型提供方抽象）
  - 统一接口：`AiProvider`
  - 可选实现：`OpenAIProvider`、`AnthropicProvider`、`GeminiProvider`
  - 按 `provider + modelId` 选择实际调用

- `ai-config/`（模型目录与租户策略）
  - 服务级模型目录：仅非密钥信息
  - 租户级策略：启用状态、默认模型、配额策略

- `ai-quota/`（配额与限流）
  - 租户级计数器，按月重置
  - 强约束：单图上限 `10 MB`、单次总输入建议上限 `30 MB`

- `ai-usage/`（用量与成本）
  - 记录请求用量、令牌数、估算成本

### 3.2 前端（`apps/web`）

- `GET /app/[tenantSlug]/ai`：后续接入分析交互页
- `GET /app/[tenantSlug]/settings/ai`：后续接入模型与配额策略设置页（限 OWNER/ADMIN）

## 4. 数据模型建议（Prisma）

密钥只放环境变量，不落库。

- `AiTenantPolicy`
  - `tenantId`（唯一）
  - `enabled`
  - `defaultModelId`
  - `monthlyImageCreditLimit`
  - `extraImageCredits`
  - `resetDayOfMonth`

- `AiUsageEvent`
  - `tenantId`、`actorUserId`
  - `action`（例如 `turtle_analysis`）
  - `modelId`、`provider`
  - `inputImageCount`
  - `promptTokens`、`completionTokens`、`totalTokens`（可空）
  - `estimatedCostCents`
  - `createdAt`

- `AiQuotaCounter`
  - `tenantId`
  - `periodStart`
  - `usedImageCount`
  - `remainingImageCredits`

## 5. 共享契约（`@eggturtle/shared`）

定义文件：`packages/shared/src/ai.ts`

- `turtleAnalysisRequestSchema`
  - `images: [{ key, contentType?, sizeBytes? }]`
  - `species?`、`ageRange?`、`weightGrams?`、`environment?`、`question?`

- `turtleAnalysisResponseSchema`
  - `analysisId`
  - `result`（`observations`、`riskNotes`、`careChecklist`、`followUp`、`disclaimer`）
  - `quotaConsumed`
  - `quota`（`scope`、`period`、`unit`、`limit`、`used`、`remaining`、`resetAt`）
  - `modelId`
  - `limits`（`maxImages`、`maxTotalInputBytes`）

- `aiQuotaStatusResponseSchema`
  - `tenantId`、`items[]`、`checkedAt`

- 错误响应占位
  - `aiQuotaExceededErrorResponseSchema`
  - `aiInputTooLargeErrorResponseSchema`

扩展错误码：
- `AI_FEATURE_DISABLED`
- `AI_MODEL_NOT_CONFIGURED`
- `AI_RATE_LIMITED`
- `QUOTA_EXCEEDED`
- `AI_PROVIDER_ERROR`

## 6. 模型配置策略

### 6.1 服务级（环境变量）

- `AI_PROVIDER_DEFAULT`（例如 `openai`）
- `AI_MODELS_JSON`（非密钥模型目录）
  - 示例：`{"id":"gpt-4o-mini","provider":"openai","capabilities":["vision"],"priceTier":"cheap"}`

### 6.2 密钥策略

- 提供方 API Key 仅放环境变量
- 禁止写入数据库

### 6.3 租户级策略

- 租户从服务级目录中选择一个 `modelId` 作为默认模型

## 7. 配额与计费行为

- 调用模型前必须先做配额预校验。
- 一期配额单位固定为 `image_count`。
- 配额按租户生效，按月重置。
- 调用模型前先校验输入大小上限。
- 配额不足时返回可直接触发前端充值弹窗的错误载荷。
- 模型返回后写入用量事件。

## 8. 分享增长挂钩（后续）

在公开分享页（如 `/s/<token>`）增加引导：
- “我也想记录我的海龟” -> 注册
- 可选展示 AI 分析示例文案（不展示用户原图）

## 9. 日志规范（强制）

结构化字段：
- `requestId`、`tenantId`、`userId`、`action`、`errorCode`

禁止写入日志：
- 提供方 API Key
- 签名 URL 全量值
- 用户非必要隐私内容

## 10. 建议落地顺序

1. 先冻结规格（`AI_PHASE_A`、`AI_QUOTA_BILLING`、本文）
2. 落库表结构与共享契约
3. 先接桩提供方（确定性占位输出），打通前端链路
4. 接入真实提供方与配额记账
5. 接入租户侧 AI 设置页
