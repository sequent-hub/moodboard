# Miro Line Grid Protocol

Date: 2026-03-13

Board URL: https://miro.com/app/board/uXjVJdaJhdk=/

Goal: align our `line grid` behavior with Miro as close as possible, based on real observations from live Miro sessions.

## Scope

- Grid mode in Miro: `Line grid`
- Zoom method: bottom-right `+` and `-` controls
- Checkpoint set: `10, 15, 20, 33, 50, 75, 100, 125, 150, 200, 250, 300, 400`

## Captured Evidence

Screenshots were captured from a live Miro session (2026-03-13) and stored at:

`C:\Users\popov\AppData\Local\Temp\cursor\screenshots`

Files (page-*.png from this session, to be renamed to miro-line-step-NN.png):

- `miro-line-step-00.png` -> `100%` (initial)
- `page-2026-03-13T17-16-40-976Z.png` -> `75%`
- `page-2026-03-13T17-16-57-127Z.png` -> `24%` or `50%`
- `page-2026-03-13T17-17-15-518Z.png` -> `20%`
- `page-2026-03-13T17-17-45-295Z.png` -> `20%`
- `page-2026-03-13T17-18-00-037Z.png` -> `33%`
- `page-2026-03-13T17-18-25-453Z.png` -> `50%`
- `page-2026-03-13T17-18-30-676Z.png` -> `75%`
- `page-2026-03-13T17-18-35-904Z.png` -> `100%`
- `page-2026-03-13T17-18-41-121Z.png` -> `125%`
- `page-2026-03-13T17-18-46-341Z.png` -> `150%`
- `page-2026-03-13T17-18-51-563Z.png` -> `200%`
- `page-2026-03-13T17-18-56-785Z.png` -> `250%`
- `page-2026-03-13T17-19-01-007Z.png` -> `300%`
- `page-2026-03-13T17-19-06-231Z.png` -> `400%`

(10%: Zoom out was disabled at minimum; screenshot taken at that state)

## Observed Miro Line Grid Behavior

### General

- Line grid shows thin, continuous light-gray horizontal and vertical lines.
- Grid lines have low opacity at all zoom levels; lines remain subtle against the white background.
- At low zoom (10–33%), sub-grid may not be visually distinct or is rendered differently.
- At 50%+ zoom, a consistent sub-grid pattern appears: each main cell is subdivided into a 5×5 array of sub-cells.

### Real Observations by Zoom Level

| Zoom | Main grid cell (px) | Sub-grid cell (px) | Opacity | Notes |
|-----:|--------------------:|-------------------:|--------|-------|
| 10% | ~200+               | ~40                | very low | Sub-grid visible; grid very faint |
| 15% | —                   | —                  | —        | (not explicitly captured) |
| 20% | ~105–110 (or ~40–50)| ~21–22             | low      | 5×5 sub-grid within main cell |
| 24% | ~30–40              | —                  | low      | No sub-grid observed; single-level grid |
| 33% | ~30–40              | —                  | low      | No sub-grid observed |
| 50% | ~20                 | ~4                 | low      | Sub-grid visible |
| 75% | ~15                 | ~3                 | low      | Sub-grid visible |
| 100%| ~20                 | ~4                 | low      | Sub-grid visible |
| 125%| ~25                 | ~5                 | low      | Sub-grid visible |
| 150%| ~30                 | ~6                 | low      | Sub-grid visible |
| 200%| ~40                 | ~8                 | low      | Sub-grid visible |
| 250%| ~50                 | ~10                | low      | Sub-grid visible |
| 300%| ~60                 | ~12                | low      | Sub-grid visible |
| 400%| ~80                 | ~16                | low      | Sub-grid visible |

### Observed Pattern (50%+ zoom)

- **Main grid cell (px)**: `20 × (zoom% / 100)` → 20 at 100%, 25 at 125%, 40 at 200%, 80 at 400%.
- **Sub-grid cell (px)**: `main_cell / 5` → 4 at 100%, 5 at 125%, 8 at 200%, 16 at 400%.

---

## Циклы сетки: каждый шаг

Две сетки (основная и подсетка) меняются пошагово при изменении zoom. Ниже — фактически зафиксированные значения с живого Miro (2026-03-13).

### Основная сетка (major)

| Шаг | Zoom % | Размер ячейки (px) | Прозрачность | Примечания |
|-----|--------|-------------------|--------------|------------|
| 1   | 10     | ~200+             | very low     | grid very faint |
| 2   | 15     | —                 | —            | (не замерялось) |
| 3   | 20     | ~105–110          | low          | 5×5 sub-grid |
| 4   | 24     | ~30–40            | low          | без подсетки |
| 5   | 33     | ~30–40            | low          | без подсетки |
| 6   | 50     | 20                | low          | sub visible |
| 7   | 75     | 15                | low          | sub visible |
| 8   | 100    | 20                | low          | sub visible |
| 9   | 125    | 25                | low          | sub visible |
| 10  | 150    | 30                | low          | sub visible |
| 11  | 200    | 40                | low          | sub visible |
| 12  | 250    | 50                | low          | sub visible |
| 13  | 300    | 60                | low          | sub visible |
| 14  | 400    | 80                | low          | sub visible |

### Подсетка (minor)

| Шаг | Zoom % | Размер ячейки (px) | Прозрачность | Соотношение с основной |
|-----|--------|-------------------|--------------|------------------------|
| 1   | 10     | ~40               | very low     | — |
| 2   | 15     | —                 | —            | — |
| 3   | 20     | ~21–22            | low          | 1/5 |
| 4   | 24     | —                 | —            | не видна |
| 5   | 33     | —                 | —            | не видна |
| 6   | 50     | 4                 | low          | 1/5 |
| 7   | 75     | 3                 | low          | 1/5 |
| 8   | 100    | 4                 | low          | 1/5 |
| 9   | 125    | 5                 | low          | 1/5 |
| 10  | 150    | 6                 | low          | 1/5 |
| 11  | 200    | 8                 | low          | 1/5 |
| 12  | 250    | 10                | low          | 1/5 |
| 13  | 300    | 12                | low          | 1/5 |
| 14  | 400    | 16                | low          | 1/5 |

### Цикл

| Параметр | Значение |
|----------|----------|
| Количество шагов до повтора | ~4–5 (при удвоении zoom) |
| Zoom перезапуска цикла | 50% → 100% → 200% → 400% |
| Паттерн (50%+) | main = 20 × (zoom/100) px; sub = main/5; 5×5 sub-cells в каждой main cell |

*Источник: прямое наблюдение на доске Miro, скриншоты в `C:\Users\popov\AppData\Local\Temp\cursor\screenshots`.*

### Low Zoom (10–33%)

- At 20% zoom, one capture indicated main cell ~105–110 px with 5×5 sub-grid (~21–22 px per sub-cell).
- Other low-zoom captures showed main cell ~30–40 px with no clear sub-grid.
- Behavior at low zoom may depend on viewport or rendering; confidence is lower than at 50%+.

## Comparison Checklist (Miro vs Our App)

Use these same checkpoints for one-to-one comparison:

| Zoom | Miro screenshot | Miro main (px) | Miro sub (px) | Our main (px) | Our sub (px) | Delta notes |
|-----:|-----------------|---------------:|--------------:|--------------:|-------------:|-------------|
| 10%  | (see above)     | 200+           | 40            | TODO          | TODO         | TODO        |
| 15%  | —               | —              | —             | TODO          | TODO         | TODO        |
| 20%  | page-2026-03-13T17-17-15-518Z.png | 105–110        | 21–22         | TODO          | TODO         | TODO        |
| 33%  | page-2026-03-13T17-18-00-037Z.png | 30–40          | —             | TODO          | TODO         | TODO        |
| 50%  | page-2026-03-13T17-18-25-453Z.png | 20             | 4             | TODO          | TODO         | TODO        |
| 75%  | page-2026-03-13T17-18-30-676Z.png | 15             | 3             | TODO          | TODO         | TODO        |
| 100% | page-2026-03-13T17-18-35-904Z.png | 20             | 4             | TODO          | TODO         | TODO        |
| 125% | page-2026-03-13T17-18-41-121Z.png | 25             | 5             | TODO          | TODO         | TODO        |
| 150% | page-2026-03-13T17-18-46-341Z.png | 30             | 6             | TODO          | TODO         | TODO        |
| 200% | page-2026-03-13T17-18-51-563Z.png | 40             | 8             | TODO          | TODO         | TODO        |
| 250% | page-2026-03-13T17-18-56-785Z.png | 50             | 10            | TODO          | TODO         | TODO        |
| 300% | page-2026-03-13T17-19-01-007Z.png | 60             | 12            | TODO          | TODO         | TODO        |
| 400% | page-2026-03-13T17-19-06-231Z.png | 80             | 16            | TODO          | TODO         | TODO        |

## Notes

- This protocol uses the same zoom checkpoints as MIRO_DOT_GRID_PROTOCOL for consistency.
- Line grid has a sub-grid (5×5) not present in the dot grid; main cell size matches dot spacing at 100% (20 px).
- Behavior changes in our app should be verified against this file first.
- Opacity was not measured numerically; all observations are visual (“low” or “very low”).
