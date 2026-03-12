---
name: eggturtle-ops-hub
description: Route EggTurtle repo work across development (开发), operations (运维), and business operations (运营). Use when the request is repo-specific but the right lane is unclear, spans multiple lanes, needs handoff rules, or should reuse an existing focused skill instead of creating more tiny skills.
---

# Eggturtle Ops Hub

## Purpose

- Use this skill as the default entry point for repo-level work that is not already an obvious specialist workflow.
- Keep the structure as one hub plus a few deep skills. Do not create sibling skills for every page, command, or incident.
- Prefer routing and reuse over expansion. Add detail in `references/` before creating another top-level skill.

## Triage

1. Classify the request into one primary lane:
   - development -> read `references/development.md`
   - operations -> read `references/operations.md`
   - business operations -> read `references/business-operations.md`
2. Ask at most one clarifying question if the lane is ambiguous.
3. If the task spans lanes, pick one primary lane and call out the secondary lane explicitly in the plan or handoff.
4. If the task is a data migration, bulk import/export, or other write-heavy operator workflow, also read `../eggturtle-data-ops/SKILL.md`.
5. If the task is specifically a Turtle Album product upload workflow, also read `../openclaw-product-upload.skill.md`.

## Working Rules

- Reuse existing repo scripts, docs, and focused skills before inventing new workflows.
- Separate code change, runtime change, and operator change in the output.
- Call out write risk, rollback path, and required confirmations whenever the task can mutate data or production state.
- Read only the matching reference file unless the task is truly multi-lane.

## Split Policy

Create a new child skill only when most of these are true:

- the same workflow recurs at least three times
- the workflow is high-risk or irreversible and needs fixed guardrails
- reusable scripts, assets, or long-form references are clearly justified
- adding the detail to this hub would make the hub harder to scan or route

If those conditions are not met, extend one reference file instead of creating another skill.

## Current Repo Anchors

- Main code surfaces: `apps/`, `packages/`, `scripts/`, `docs/`, `.github/workflows/`
- Local environment and runtime entrypoint: `dev.sh`
- Existing focused skill: `../eggturtle-data-ops/SKILL.md`
- Existing legacy/special-case playbook: `../openclaw-product-upload.skill.md`
