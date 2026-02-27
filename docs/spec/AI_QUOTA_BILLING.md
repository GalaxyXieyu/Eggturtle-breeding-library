# AI Phase A Quota + Billing Spec

Status: spec + API contract placeholder only (no full implementation)
Updated: 2026-02-27

## 1. Purpose

Define a minimal, enforceable quota model for AI turtle photo analysis in Phase A.
This version is designed for fast launch and cost control, not full financial settlement.

## 2. Quota Model (Confirmed)

Core quota rules:
- **Quota unit**: `image_count` (charged by number of uploaded images, not by request count).
- **Quota scope**: per-tenant.
- **Quota period**: monthly reset.
- **Per-request image count**: 1-3 images.

Input size guardrail:
- Each uploaded image must be <= `10 MB`.
- Recommended max total input size per request: <= `30 MB` (up to 3 images at 10MB each).
- Requests exceeding limits are rejected before provider call.

Monetization behavior:
- Base plan provides monthly image credits.
- Free trial baseline: 10 images / month / tenant (roughly 10 turtles).
- Tenant can purchase additional image-credit packs (add-on credits) separately.
- When remaining credits are insufficient, API must return paywall-ready payload so web can open recharge modal.

## 3. Enforcement Points (Request Lifecycle)

1) Auth + tenant context check.
2) Feature switch/model policy check (tenant-level allowlist).
3) Input validation check (schema, image count, input size <= 10 MB).
4) Rate-limit check (user + tenant dimensions).
5) Quota pre-check on `image_count` needed for current request.
6) Provider call.
7) Usage/audit write (images consumed, model, result status, latency, token telemetry).
8) Final quota accounting:
   - Success: consume requested image credits.
   - Provider/system fail before completion: refund policy is configurable, default can be refund-on-fail.

## 4. Audit / Logging Fields

Required structured fields:
- `requestId`
- `tenantId`
- `userId`
- `action` (for example `ai.turtle_analysis`)
- `modelId`
- `provider`
- `quotaUnit` (fixed: `image_count`)
- `quotaConsumed` (images consumed in this request)
- `quotaRemaining`
- `quotaResetAt`
- `inputImageCount`
- `inputBytes`
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

## 6. Error Semantics (API Placeholder)

### 6.1 Over quota (paywall trigger)

- HTTP status: `402 Payment Required` (preferred), or `429` when gateway/policy requires throttling semantics.
- `errorCode`: `QUOTA_EXCEEDED`.
- Response includes paywall metadata for UI modal.

Payload shape:

```json
{
  "message": "Monthly image credits exhausted.",
  "errorCode": "QUOTA_EXCEEDED",
  "statusCode": 402,
  "data": {
    "remaining": 0,
    "resetAt": "2026-03-01T00:00:00.000Z",
    "purchase": {
      "packs": [
        {
          "id": "pack_100",
          "name": "100-image add-on",
          "imageCredits": 100,
          "priceCents": 990,
          "currency": "CNY"
        }
      ]
    }
  }
}
```

### 6.2 Input too large (>10 MB per image)

- HTTP status: `413 Payload Too Large`.
- `errorCode`: `INVALID_REQUEST_PAYLOAD`.

Payload shape:

```json
{
  "message": "An input image exceeds 10 MB.",
  "errorCode": "INVALID_REQUEST_PAYLOAD",
  "statusCode": 413,
  "data": {
    "maxSingleImageBytes": 10485760,
    "actualSingleImageBytes": 14680064
  }
}
```

### 6.3 Related AI errors

- `AI_FEATURE_DISABLED`
- `AI_MODEL_NOT_CONFIGURED`
- `AI_RATE_LIMITED`
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

Error payload schemas:
- `aiQuotaExceededErrorResponseSchema`
- `aiInputTooLargeErrorResponseSchema`

Current route convention reminder:
- API uses **no `/api` prefix**.

## 8. Rollout Constraints

- Keep Phase A to advice-only output with disclaimer.
- No diagnosis claims.
- No medication/treatment prescriptions.
- Any billing expansion beyond quota counters requires a separate settlement spec.
