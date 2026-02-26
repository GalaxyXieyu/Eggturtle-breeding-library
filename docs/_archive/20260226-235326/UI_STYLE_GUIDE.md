# TurtleAlbum UI Style Guide (Current)

This document captures the current UI conventions used in `frontend/`.
It is meant as a baseline for aligning the admin UI with the existing front-end look.

## Source Of Truth

- Tailwind theme + design tokens: `frontend/tailwind.config.ts`
- CSS variables + global styles: `frontend/src/index.css`
- Admin layout example: `frontend/src/components/AdminLayout.tsx`

## Colors

### Core Theme Tokens (HSL CSS variables)

Defined in `frontend/src/index.css` under `:root`.

- Background / foreground
  - `--background: 37 38% 95%`
  - `--foreground: 32 25% 20%`
- Card / popover
  - `--card: 37 38% 98%`
  - `--card-foreground: 32 25% 20%`
  - `--popover: 37 38% 98%`
  - `--popover-foreground: 32 25% 20%`
- Primary
  - `--primary: 32 25% 60%`
  - `--primary-foreground: 37 38% 98%`
- Secondary / muted / accent (same base)
  - `--secondary: 32 15% 92%`
  - `--muted: 32 15% 92%`
  - `--accent: 32 15% 92%`
  - Foregrounds:
    - `--secondary-foreground: 32 25% 20%`
    - `--muted-foreground: 32 10% 50%`
    - `--accent-foreground: 32 25% 20%`
- Borders / inputs / focus ring
  - `--border: 32 15% 85%`
  - `--input: 32 15% 85%`
  - `--ring: 32 25% 40%`

### Cosmetic Palette (Hex)

Defined in `frontend/tailwind.config.ts` under `colors.cosmetic`.
This is the primary palette used throughout the admin pages.

Beige
- `cosmetic-beige-50:  #FDFBF8`
- `cosmetic-beige-100: #F7F3EF`
- `cosmetic-beige-200: #E9E0D5`
- `cosmetic-beige-300: #DBCEBB`
- `cosmetic-beige-400: #CDB9A1`
- `cosmetic-beige-500: #BFA587`

Gold
- `cosmetic-gold-50:  #FEFCF6`
- `cosmetic-gold-100: #F9F4E8`
- `cosmetic-gold-200: #F2E8D5`
- `cosmetic-gold-300: #ECDCC1`
- `cosmetic-gold-400: #E5CFAE`
- `cosmetic-gold-500: #D4B78C`
- `cosmetic-gold-600: #C4A66E`

Brown
- `cosmetic-brown-100: #9C8C7D`
- `cosmetic-brown-200: #8A7B6D`
- `cosmetic-brown-300: #786B5E`
- `cosmetic-brown-400: #665B4F`
- `cosmetic-brown-500: #544A40`
- `cosmetic-brown-600: #453A31`
- `cosmetic-brown-900: #1A1612`

### Common Usage Patterns (Observed)

- App background: `bg-cosmetic-beige-100`
- Surfaces (cards/headers/sidebar): `bg-white` with `border-cosmetic-beige-200`
- Primary action buttons: `bg-cosmetic-gold-400 hover:bg-cosmetic-gold-500 text-white`
- Primary highlight text: `text-cosmetic-gold-500`
- Body text: `text-cosmetic-brown-300/400/500`

## Typography

Defined in `frontend/tailwind.config.ts`.

- Sans: `Inter`
- Serif (headings/brand): `Playfair Display`

Global rule in `frontend/src/index.css`:
- `h1..h6` use serif (`font-serif`).

## Radius

Defined in `frontend/src/index.css`:
- `--radius: 0.5rem`

Mapped in `frontend/tailwind.config.ts`:
- `rounded-lg` -> `var(--radius)` (0.5rem)
- `rounded-md` -> `calc(var(--radius) - 2px)`
- `rounded-sm` -> `calc(var(--radius) - 4px)`

Observed usage in admin:
- Nav items: `rounded-md`
- Upload dropzones / image previews: `rounded-lg`

## Shadows

Global utility class in `frontend/src/index.css`:
- `.elegant-shadow { box-shadow: 0px 10px 25px rgba(0, 0, 0, 0.05); }`

Tailwind extension:
- `shadow-3xl`: `0 35px 60px -12px rgba(0, 0, 0, 0.25)`

Observed patterns:
- Cards typically rely on borders + light shadow rather than heavy elevation.

## Gradients / Brand Text

- `.gold-text` uses a left-to-right gold gradient:
  - `#BFA587 -> #D4B78C`
- Tailwind background gradients are also defined:
  - `gold-gradient`: `#E9E0D5 -> #D4B78C`
  - `beige-gradient`: `#F7F3EF -> #CDB9A1`

## Motion

- Hover lift effect:
  - `.product-card:hover` translates `-5px` with `transition: all 0.3s ease`
- Sticky filter slide-down animation:
  - `@keyframes slideDown` + `.filter-sticky` applies it

## Admin Layout Conventions (Observed)

From `frontend/src/components/AdminLayout.tsx`:
- Sidebar surface: `bg-white` + `border-r border-cosmetic-beige-200`
- Active nav:
  - `bg-cosmetic-gold-100 text-cosmetic-gold-500`
- Inactive nav:
  - `text-cosmetic-brown-300 hover:bg-cosmetic-beige-100 hover:text-cosmetic-brown-500`

## Waterfall Feed Palette (Black / White / Yellow)

The waterfall feed (`frontend/src/pages/SeriesFeed.tsx`) already uses a black/white/yellow palette.
This should become the primary reference for the admin UI theme refresh.

- Primary yellow accent: `#FFD400`
  - Used for active filter borders and highlights
  - Used as text on dark chips
- Core neutrals
  - Background gradients: `from-stone-100 via-white to-amber-50/40`
  - Surfaces: `bg-white` / `bg-white/95` (with `backdrop-blur` for sticky filters)
  - Text: `text-black`, `text-neutral-*`
  - Dark surface: `bg-neutral-900`
- Shadows (waterfall)
  - Header: `shadow-[0_18px_50px_rgba(0,0,0,0.22)]`
  - Cards: `shadow-[0_4px_20px_rgba(0,0,0,0.06)]` + hover stronger shadow

## Decisions (Confirmed)

- No dark mode for now.
- Remove gold gradient brand text (`.gold-text`) from admin.
- Admin palette should align to waterfall feed black/white/yellow (accent `#FFD400`).

## Open Questions To Confirm

1) Should the admin sidebar use `bg-white` (current), or adopt a darker `neutral-900` header-style surface?
2) Should we keep serif headings (`Playfair Display`) in admin, or switch admin to full `Inter` for a more tool-like feel?
