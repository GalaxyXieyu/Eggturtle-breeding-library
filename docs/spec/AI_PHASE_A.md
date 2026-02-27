# AI Phase A: Turtle Photo Analysis (Advice-Only)

Status: Spec only (do not implement yet)
Owner: Team
Updated: 2026-02-27

Related specs:
- `docs/spec/SAAS_SPEC.md`
- `docs/spec/AI_SYSTEM_DESIGN.md`
- `docs/spec/AI_QUOTA_BILLING.md`

## Goal

Provide a low-risk, high-perceived-value feature:
- User uploads turtle photos + basic context
- System returns structured advice text
- Must clearly state "not medical diagnosis"

This feature also supports monetization via usage quota (free tier limited).

## Inputs

- Photos: 1-3 images
- Basic info (optional unless noted):
  - Species/breed (optional)
  - Age range (optional)
  - Weight (optional)
  - Environment (optional): water temp, basking, tank size, diet
  - User question (optional)

## Outputs (Structured Text)

The response must include the following sections (in Chinese):

1) Observations
- Body condition / shell shape observations
- Use cautious language ("可能/疑似/建议进一步观察")

2) Risk Notes
- Explicit disclaimer: advice-only, not medical diagnosis
- If suspicious: recommend professional vet consultation

3) Care Suggestions (Checklist)
- Actionable steps (feeding, water quality, basking, UVB, enclosure)

4) Follow-up
- What to re-check and when (e.g., "建议隔 2 周同角度再拍对比")
- What signals require urgent attention

## Safety / Compliance

- Never claim diagnosis.
- Avoid recommending medication or invasive treatment.
- Avoid collecting unnecessary sensitive personal data.

## Quota / Monetization (Phase A Baseline)

Phase A quota/billing details are defined in:
- `docs/spec/AI_QUOTA_BILLING.md`

Launch baseline:
- Enforced unit: `image_count` (charged by uploaded image count)
- Quota scope: per-tenant
- Quota period: monthly reset
- Free trial baseline: 10 images / month / tenant (roughly 10 turtles)
- Input size guardrail: each image <= `10 MB`
- Over quota: return paywall-ready error payload so web can open recharge modal

API placeholder contracts are defined in:
- `packages/shared/src/ai.ts`

## Sharing / Growth Hook (Later)

On public share pages, provide CTA:
- "I also want to record my turtles" -> sign up
- Positioning: works for hobby users and sellers

## Non-Goals (Phase A)

- No disease diagnosis.
- No long-term trend analysis.
- No breeding/lineage reasoning.
- No automated decisions that affect user assets.
