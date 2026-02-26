# UI Style Direction (XHS-like, minimal)

Goal: structure like XiaoHongShu (waterfall feed + post detail), but visuals stay **minimal** (not overly cute).

## Palette (B/W + Yellow)

- Background: `#FFFFFF`
- Surface/card: `#FFFFFF`
- Text primary: `#111111`
- Text secondary: `#6B7280`
- Border/divider: `#E5E7EB`
- Accent Yellow (primary): `#F5C542` (tune to match the reference turtle yellow)
- Accent Yellow (hover/dark): `#D9A516`
- Danger: `#EF4444`
- Success: `#10B981`

Usage rules:
- Yellow is used for **primary CTA**, selected tab/chip, price highlight, and small badges.
- Everything else stays grayscale to keep the XHS-like clean feeling.

## Typography

- Chinese-friendly sans, neutral: system UI or a clean sans.
- Title: semibold, compact; avoid playful fonts.
- Numbers (price/code): use tabular numbers if available.

## Layout & Components

- Feed: Masonry/waterfall cards (image dominates). Card footer shows:
  - breeder code
  - female only: unit price label
- Series selector: horizontal chips; selected chip uses yellow background with black text.
- Sex tabs: `种母` / `种公` in one page; selected tab underline in yellow.
- Detail page: image carousel + info sections:
  - female: unit price + mating timeline + egg timeline
  - male: description only
  - optional lineage section appears only when data exists
- WeChat CTA: sticky bottom button in yellow; shows QR/WeChat number in a modal.

## Visual treatment

- Radius: 12 (cards), 9999 (chips/buttons)
- Border: 1px light gray
- Shadow: very subtle (or none) to match clean XHS vibe
- Spacing: consistent 8/12/16 rhythm
