# AI Phase A Quota + Billing Spec

Status: spec + API contract placeholder only (no full implementation)
Updated: 2026-02-27

## 1. Purpose

Define a minimal, enforceable quota model for AI turtle photo analysis in Phase A.
This version is designed for fast launch and cost control, not full financial settlement.

## 2. Billing and Quota Units

Primary enforcement unit (Phase A):
- `analysis_request`: each successful `POST /ai/turtle-analysis` consumes 1 unit.

Tracked telemetry units (not hard-limit by default in Phase A):
- `input_image`: number of input images in one request (1-3).
- `input_token`: provider input token usage when available.
- `output_token`: provider output token usage when available.

Recommended quota windows:
- Free plan: daily window on `analysis_request`.
- Paid plan: monthly window on `analysis_request` (or higher daily cap).
- Trial-only experiments: lifetime window allowed but optional.

## 3. Enforcement Points (Request Lifecycle)

1) Auth + tenant context check.
2) Feature switch/model policy check (tenant-level allowlist).
3) Input validation check (schema, image count, size limits).
4) Rate-limit check (user + tenant dimensions).
5) Quota pre-check on `analysis_request`.
6) Provider call.
7) Usage/audit write (tokens, model, result status, latency).
8) Final quota accounting:
   - Success: keep consumed unit.
   - Provider/system fail before completion: may refund unit based on policy.

## 4. Audit / Logging Fields

Required structured fields:
- `requestId`
- `tenantId`
- `userId`
- `action` (for example `ai.turtle_analysis`)
- `modelId`
- `provider`
- `quotaUnit` (default `analysis_request`)
- `quotaConsumed`
- `quotaRemaining` (nullable when unlimited)
- `inputImageCount`
- `promptTokens` (nullable)
- `completionTokens` (nullable)
- `totalTokens` (nullable)
- `latencyMs`
- `result` (`success` | `blocked` | `error`)
- `errorCode` (nullable)
- `createdAt`

Do not log:
- provider API keys
- raw signed URLs
- sensitive user-private payloads beyond operational minimum

## 5. Rate Limiting Notes

Phase A baseline recommendation:
- Scope: `tenantId + userId + route`.
- Short window: 10 requests / 60 seconds.
- Burst mitigation: block with retry-after hint.

Operational notes:
- Keep limiter deterministic and easy to explain to support users.
- In-memory limiter is acceptable for local single-instance dev.
- Multi-instance deploy should use shared store (for example Redis).

## 6. Error Codes (Phase A)

- `AI_FEATURE_DISABLED`
- `AI_MODEL_NOT_CONFIGURED`
- `AI_RATE_LIMITED`
- `AI_QUOTA_EXCEEDED`
- `AI_PROVIDER_ERROR`

These are declared in `packages/shared/src/error-codes.ts`.

## 7. API Placeholder Contract (Shared Types)

This spec defines contract shape only. Runtime endpoints can be implemented later.

Contract file:
- `packages/shared/src/ai.ts`

Proposed endpoints:
- `GET /ai/quota/status`
  - Response schema: `aiQuotaStatusResponseSchema`
- `POST /ai/turtle-analysis`
  - Request schema: `turtleAnalysisRequestSchema`
  - Response schema: `turtleAnalysisResponseSchema`

Current route convention reminder:
- API uses **no `/api` prefix**.

## 8. Rollout Constraints

- Keep Phase A to advice-only output with disclaimer.
- No diagnosis claims.
- No medication/treatment prescriptions.
- Any billing expansion beyond quota counters requires a separate settlement spec.
