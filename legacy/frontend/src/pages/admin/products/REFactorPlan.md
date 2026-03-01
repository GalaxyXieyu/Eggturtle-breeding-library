# AdminProducts Refactor Plan (<= 800 lines/file)

Owner: OpenClaw / Codex

## Context
`frontend/src/pages/admin/AdminProducts.tsx` historically grew into a ~2000+ line file mixing:
- data fetching + state management
- list UI (toolbar/filters/table/cards/pagination)
- product detail view
- create/edit forms
- image upload/delete/reorder/main selection
- misc helpers (sorting, page numbers, normalization)

We already extracted the list UI into smaller components (toolbar/filters/desktop table/mobile list/pagination).

## Goals
- Keep each TS/TSX file under ~800 lines (hard cap).
- Make `AdminProducts.tsx` a thin orchestration layer:
  - auth guard
  - query/mutations
  - page-level state
  - wiring callbacks into child components
- Improve maintainability: isolate concerns, minimize cross-coupling.
- Preserve behavior (no functional regressions) while refactoring.
- Ensure builds pass (`npm -C frontend run build`).

## Non-goals (for this refactor)
- Redesign UI/UX.
- Change backend API contracts.
- Large type/schema migrations (handled separately).

## Definition of Done
- `AdminProducts.tsx` <= 800 LOC.
- All extracted modules <= 800 LOC.
- `npm -C /Volumes/DATABASE/code/turtle_album/frontend run build` passes.
- Manual smoke check:
  - list loads, search works, filters work, pagination works
  - open detail sheet, open edit sheet
  - create flow (including image selection)
  - edit flow (save fields)
  - image ops: upload, delete, reorder, set main (if supported)

## Target File Structure
`frontend/src/pages/admin/`
- `AdminProducts.tsx` (orchestration only)
- `products/`
  - `REFactorPlan.md` (this file)
  - `pagination.ts` (done)
  - `ProductsToolbar.tsx` (done)
  - `TurtleFilters.tsx` (done)
  - `ProductsTableDesktop.tsx` (done)
  - `ProductsListMobile.tsx` (done)
  - `ProductDetailView.tsx` (NEW)
  - `ProductSheet.tsx` (NEW) - wrapper for Sheet + mode switching
  - `forms/` (NEW)
    - `productSchema.ts` (NEW) - zod schema + shared types
    - `ProductEditForm.tsx` (NEW)
    - `ProductCreateDialog.tsx` (NEW)
  - `images/` (NEW)
    - `useProductImages.ts` (NEW) - state + handlers
    - `ProductImagesManager.tsx` (NEW)
  - `utils/` (optional)
    - `sort.ts` (NEW) - stable sorting helpers
    - `normalize.ts` (NEW) - normalizeFilterValues etc.

Notes:
- We prefer extracting in a way that each new module is cohesive and testable.
- If a module grows >800 LOC, split again (e.g. `ProductEditForm` into sections).

## Step-by-Step Refactor (Incremental, Always Buildable)

### Step 1 (DONE): Extract list UI
Status: done in current branch.
- Extracted toolbar, turtle filters, desktop table, mobile list, pagination helper.
- Build passes.

### Step 2: Extract pagination + sorting + list state helpers
Purpose: remove low-level glue from `AdminProducts.tsx`.
Work:
- Move `handleSort` + sorting comparator into `products/utils/sort.ts`.
- Ensure sorting uses *next* direction, not stale `sortDirection` state.
- Keep `filteredProducts` derivation predictable.
Acceptance:
- Sort toggling works (asc/desc) and is stable.
- Build passes.

### Step 3: Extract Product Sheet wrapper
Purpose: isolate Sheet open/close + mode switching.
Work:
- Create `products/ProductSheet.tsx`:
  - props: `open`, `onOpenChange`, `product`, `mode` (view|edit), callbacks.
  - renders `ProductDetailView` or `ProductEditForm`.
- Move `renderProductDetails()` into `ProductDetailView.tsx`.
Acceptance:
- View mode matches existing UI.
- Switching to edit mode works.

### Step 4: Extract Form schema + form components
Purpose: centralize validation + remove duplicated form init/reset logic.
Work:
- Create `products/forms/productSchema.ts`:
  - export zod schema
  - export type `ProductFormValues`
  - export constants for enums (status/stage)
- Create `products/forms/ProductEditForm.tsx`:
  - receives `product`, `onSubmit`, `isSaving`, `seriesList` (if needed)
- Create `products/forms/ProductCreateDialog.tsx`:
  - handles create dialog wrapper + form
  - returns created product (or calls onSuccess)
Acceptance:
- Create/edit forms behave the same.
- No duplicate schema definitions.

### Step 5: Extract Images subsystem (hook + component)
Purpose: isolate complex image logic; reduce `AdminProducts.tsx` size significantly.
Work:
- Create `products/images/useProductImages.ts`:
  - state: `imageUploads`, `currentImageIndex`, drag indices
  - actions: `onFileChange`, `removeImage`, `reorder`, `saveOrder`, `initFromProduct`, `reset`
  - requires minimal deps via injected callbacks/services
- Create `products/images/ProductImagesManager.tsx`:
  - renders gallery UI + drag/drop interactions
  - uses hook and calls injected handlers
Acceptance:
- Edit mode uploads immediately; create mode stores previews until created.
- Delete/reorder behaves as before.

### Step 6: Final consolidation + LOC enforcement
Purpose: enforce <=800 LOC and remove dead code.
Work:
- Ensure `AdminProducts.tsx` <=800 LOC.
- Split any oversized new files.
- Remove unused imports.
- Run build.
Acceptance:
- All files under limit.
- Build passes.

## Risks / Known Issues
- Sorting currently likely uses stale `sortDirection` due to setState async (fix in Step 2).
- There are leftover fields referencing old product schema (tube/box/material/dimensions) mixed with turtle fields; refactor should not make this worse.
- Image upload code uses placeholder `new File([], ...)` for existing images; ensure extracted hook keeps this behavior or replaces it with a safer approach.

## Execution Mode (Avoid Blocking)
To avoid chat blocking:
- Use a sub-agent to implement Steps 2-6 in the background.
- The main assistant will only report:
  - which step completed
  - which files changed
  - build result
  - any behavioral risk

## Checkpoints / Deliverables
After each step:
- commit (atomic, step-scoped)
- build output summary
- short note of what to verify manually
