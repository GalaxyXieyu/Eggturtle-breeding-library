# Turtle Album (Breeder Archive) - Branch Goal

This branch repurposes the existing glam-cart system into a XiaoHongShu-style breeder archive album for turtles.

## Business Behavior (v1)

- Customers browse by **Series** first.
- Within a Series, customers can switch between **Female breeders** and **Male breeders** (same page via tabs).
- Each breeder is a post-like archive:
  - cover image + gallery images
  - **Female** shows:
    - offspring unit price (single price anchor)
    - mating records (male code + date)
    - egg-laying records (date + optional count)
  - **Male** shows:
    - gallery + description only (no egg section, no price)
  - Optional lineage:
    - sire/dam codes and optional sire/dam images
    - only shown if provided
- Transaction is **WeChat** (copy wechat number / show QR), no in-app checkout.

## Implementation Principles

- Reuse existing `Product` + `ProductImage` as the breeder model and album media model.
- Add minimal new tables: `series`, `mating_records`, `egg_records`.
- Enforce key rules at API-level:
  - mating is female<->male only
  - mating is within same series only
  - egg records are female-only

## Scope Order

Backend first (DB + APIs + admin CRUD), then frontend. Frontend visual assets will be provided later for final styling.
