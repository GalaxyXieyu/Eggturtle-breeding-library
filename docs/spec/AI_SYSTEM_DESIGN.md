# AI System Design (Phase A + Config)

Status: Design/spec only (Phase A implementation can be staged)
Updated: 2026-02-27

Related specs:
- `docs/spec/SAAS_SPEC.md`
- `docs/spec/AI_PHASE_A.md`
- `docs/spec/AI_QUOTA_BILLING.md`

## Scope

Phase A (Advice-only turtle photo analysis):
- User uploads 1-3 photos + optional basic info
- System returns structured text (observations / risk notes / care checklist / follow-up)
- Must include non-diagnosis disclaimer

Also define: how to configure models in backend (admin/tenant settings), quota/usage tracking, and logging.

## Key Product Decisions (Confirmed)

- Public sharing links are viewable by anyone with the link.
- AI outputs are advice-only, not medical diagnosis.
- Quota is measured by image count, scoped per-tenant, reset monthly.

## Architecture Overview

### Modules (apps/api)

- `ai/` (API layer)
  - `POST /ai/turtle-analysis` (auth required, tenant-scoped)
  - Validates inputs with Zod (from `@eggturtle/shared`)
  - Enforces quota + writes usage/audit logs

- `ai-providers/` (provider abstraction)
  - `AiProvider` interface
  - Implementations:
    - `OpenAIProvider` / `AnthropicProvider` / `GeminiProvider` (optional; pick one first)
  - Provider selection by `provider` + `modelId`

- `ai-config/` (model catalog + tenant policy)
  - Server-level model catalog: non-secret definitions
  - Tenant-level policy: which model is enabled/selected, feature toggles

- `ai-quota/` (tenant credits / rate limiting)
  - Per-tenant counters with monthly reset
  - Hard limits (max images, max single image size 10 MB, max total input size 30 MB, max requests/min)

- `ai-usage/` (billing/analytics)
  - Stores usage events with token counts + estimated cost

### Web (apps/web)

- `GET /app/[tenantSlug]/ai` (later): run analysis UI
- `GET /app/[tenantSlug]/settings/ai` (later): owner/admin selects model + quota policy

## Data Model (Prisma) Proposal

Keep secrets in env, not DB.

- `AiTenantPolicy`
  - `tenantId` (unique)
  - `enabled` (bool)
  - `defaultModelId` (string)
  - `monthlyImageCreditLimit` (int)
  - `extraImageCredits` (int, add-on packs)
  - `resetDayOfMonth` (int, usually 1)

- `AiUsageEvent`
  - `tenantId`, `actorUserId`
  - `action` (e.g. `turtle_analysis`)
  - `modelId`, `provider`
  - `inputImageCount`
  - `promptTokens`, `completionTokens`, `totalTokens` (nullable if provider does not return)
  - `estimatedCostCents`
  - `createdAt`

- `AiQuotaCounter`
  - `tenantId`
  - `periodStart` (month start datetime)
  - `usedImageCount`
  - `remainingImageCredits`

## API Contracts (@eggturtle/shared)

Defined in `packages/shared/src/ai.ts` (placeholder contracts):
- `turtleAnalysisRequestSchema`
  - `images: [{ key: string, contentType?: string, sizeBytes?: number }]`
  - `species?`, `ageRange?`, `weightGrams?`, `environment?`, `question?`
- `turtleAnalysisResponseSchema`
  - `analysisId`
  - `result` (`observations`, `riskNotes`, `careChecklist`, `followUp`, `disclaimer`)
  - `quotaConsumed` (image count consumed in this request)
  - `quota` (`scope`, `period`, `unit`, `limit`, `used`, `remaining`, `resetAt`)
  - `modelId`
  - `limits` (`maxImages`, `maxTotalInputBytes`)
- `aiQuotaStatusResponseSchema`
  - `tenantId`, `items[]`, `checkedAt`
- Error payload placeholders
  - `aiQuotaExceededErrorResponseSchema`
  - `aiInputTooLargeErrorResponseSchema`

Error codes (extend `ErrorCode`):
- `AI_FEATURE_DISABLED`
- `AI_MODEL_NOT_CONFIGURED`
- `AI_RATE_LIMITED`
- `QUOTA_EXCEEDED`
- `AI_PROVIDER_ERROR`

## Model Configuration (How Admin Chooses Models)

### Server-level (env)

- `AI_PROVIDER_DEFAULT` (e.g. `openai`)
- `AI_MODELS_JSON` (non-secret catalog)
  - Example items: `{ "id": "gpt-4o-mini", "provider": "openai", "capabilities": ["vision"], "priceTier": "cheap" }`

### Secrets (env)

- Provider API keys live in env only.
- Never store API keys in DB.

### Tenant-level (DB)

- Tenant policy chooses one model id from the catalog.

## Quota / Billing Behavior

- Enforce quota before provider call.
- Quota unit for Phase A is image count (`image_count`).
- Quota scope is tenant-level and resets monthly.
- Enforce model input size limit before provider call (max single image bytes = 10 MB; recommended max total input bytes = 30 MB).
- On quota exhaustion, return paywall-ready error payload so web can open recharge modal with add-on packs.
- Record usage event after provider returns.

## Sharing & Growth Hook (Later)

On public share pages (e.g. `/s/<token>`):
- Add CTA: "I also want to record my turtles" -> signup
- Optional: show sample AI analysis teaser (no user photos)

## Logging Style (Required)

Structured fields in logs:
- `requestId`, `tenantId`, `userId`, `action`, `errorCode`

Never log:
- provider API keys
- signed URLs
- user private data

## Implementation Plan (Suggested)

1) Land specs only (`docs/spec/AI_PHASE_A.md`, `docs/spec/AI_QUOTA_BILLING.md`, this doc)
2) Add DB tables + shared schema (`packages/shared/src/ai.ts` already provides placeholder contracts)
3) Implement API with stub provider returning deterministic placeholder text (for UI wiring)
4) Integrate real provider + usage counters + cost estimation
5) Add tenant settings UI
