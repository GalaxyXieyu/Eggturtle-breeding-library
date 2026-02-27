# AI System Design (Phase A + Config)

Status: Design/spec only (Phase A implementation can be staged)
Updated: 2026-02-27

## Scope

Phase A (Advice-only turtle photo analysis):
- User uploads 1-3 photos + optional basic info
- System returns structured text (observations / risk notes / care checklist / follow-up)
- Must include non-diagnosis disclaimer

Also define: how to configure models in backend (admin/tenant settings), quota/usage tracking, and logging.

## Key Product Decisions (Confirmed)

- Public sharing links are viewable by anyone with the link.
- AI outputs are advice-only, not medical diagnosis.
- Free users have limited attempts (quota); paid can get more.

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

- `ai-quota/` (free trial / rate limiting)
  - Per-user counters with reset window (daily or lifetime trial)
  - Hard limits (max images, max size, max requests/min)

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
  - `freeQuotaDaily` (int) OR `freeTrialTotal` (int)
  - `payPerUseEnabled` (bool) (optional)

- `AiUsageEvent`
  - `tenantId`, `actorUserId`
  - `action` (e.g. `turtle_analysis`)
  - `modelId`, `provider`
  - `inputImageCount`
  - `promptTokens`, `completionTokens`, `totalTokens` (nullable if provider does not return)
  - `estimatedCostCents`
  - `createdAt`

- `AiQuotaCounter`
  - `tenantId`, `actorUserId`
  - `windowStart` (date)
  - `usedCount`

## API Contracts (@eggturtle/shared)

Add in `packages/shared/src/ai.ts`:
- `turtleAnalysisRequestSchema`
  - `images: [{ key: string }]` OR accept multipart upload and return `imageKeys`
  - `species?`, `ageRange?`, `weightGrams?`, `environment?`, `question?`
- `turtleAnalysisResponseSchema`
  - `observations: string[]`
  - `riskNotes: string[]`
  - `careChecklist: string[]`
  - `followUp: string[]`
  - `disclaimer: string`

Error codes (extend `ErrorCode`):
- `AI_QUOTA_EXCEEDED`
- `AI_FEATURE_DISABLED`
- `AI_MODEL_NOT_CONFIGURED`
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
- Record usage event after provider returns.
- For Phase A launch:
  - Free users: small daily quota (e.g. 3/day) OR new-user trial total (e.g. 10 total)
  - Over quota: block + upsell (or pay-per-use later)

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

1) Land specs only (`docs/spec/AI_PHASE_A.md`, this doc)
2) Add DB tables + shared schema
3) Implement API with stub provider returning deterministic placeholder text (for UI wiring)
4) Integrate real provider + usage counters + cost estimation
5) Add tenant settings UI
