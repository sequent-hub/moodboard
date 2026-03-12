# Miro Dot Grid Protocol

Date: 2026-03-11

Board URL: https://miro.com/app/board/uXjVJdaJhdk=/

Goal: align our `dot grid` behavior with Miro as close as possible, based on repeatable zoom checkpoints.

## Scope

- Grid mode in Miro: `Dot grid`
- Zoom method: bottom-right `+` and `-` controls
- Checkpoint set: `10, 15, 20, 33, 50, 75, 100, 125, 150, 200, 250, 300, 400`

## Captured Evidence

Screenshots were captured from a live Miro session and stored at:

`C:\Users\popov\AppData\Local\Temp\cursor\screenshots`

Files:

- `miro-dot-step-00.png` -> `100%`
- `miro-dot-step-01.png` -> `75%`
- `miro-dot-step-02.png` -> `50%`
- `miro-dot-step-03.png` -> `33%`
- `miro-dot-step-04.png` -> `20%`
- `miro-dot-step-05.png` -> `15%`
- `miro-dot-step-06.png` -> `10%`
- `miro-dot-step-07.png` -> `15%`
- `miro-dot-step-08.png` -> `20%`
- `miro-dot-step-09.png` -> `50%`
- `miro-dot-step-10.png` -> `100%`
- `miro-dot-step-11.png` -> `125%`
- `miro-dot-step-12.png` -> `150%`
- `miro-dot-step-13.png` -> `200%`
- `miro-dot-step-14.png` -> `250%`
- `miro-dot-step-15.png` -> `300%`
- `miro-dot-step-16.png` -> `400%`

## Observed Miro Behavior

- Zoom changes are discrete by UI checkpoints; visual grid transitions look smooth across checkpoints.
- Dot spacing on screen increases with zoom and decreases when zooming out.
- Dot mark remains subtle and light-gray at all checkpoints.
- At low zoom (`10-50`) mark is perceived closer to a tiny point.
- At high zoom (`150+`) mark is perceived closer to a small cross-like glyph.
- In the tested session, `+` control reached `400%` on the captured board.
- Our app now supports `500%` max zoom with Miro-aligned checkpoints.

## Comparison Checklist (Miro vs Our App)

Use these same checkpoints for one-to-one comparison:

| Zoom | Miro screenshot | Miro spacing(px) | Miro mark size(px) | Our spacing(px) | Our mark size(px) | Delta notes |
|---|---|---:|---:|---:|---:|---|
| 10% | miro-dot-step-06.png | TODO | TODO | TODO | TODO | TODO |
| 15% | miro-dot-step-05.png | TODO | TODO | TODO | TODO | TODO |
| 20% | miro-dot-step-04.png | TODO | TODO | TODO | TODO | TODO |
| 33% | miro-dot-step-03.png | TODO | TODO | TODO | TODO | TODO |
| 50% | miro-dot-step-02.png | TODO | TODO | TODO | TODO | TODO |
| 75% | miro-dot-step-01.png | TODO | TODO | TODO | TODO | TODO |
| 100% | miro-dot-step-00.png | TODO | TODO | TODO | TODO | TODO |
| 125% | miro-dot-step-11.png | TODO | TODO | TODO | TODO | TODO |
| 150% | miro-dot-step-12.png | TODO | TODO | TODO | TODO | TODO |
| 200% | miro-dot-step-13.png | TODO | TODO | TODO | TODO | TODO |
| 250% | miro-dot-step-14.png | TODO | TODO | TODO | TODO | TODO |
| 300% | miro-dot-step-15.png | TODO | TODO | TODO | TODO | TODO |
| 400% | miro-dot-step-16.png | TODO | TODO | TODO | TODO | TODO |

## Notes

- This protocol fixes the same zoom checkpoints for all future comparisons.
- Behavior changes in our app should be verified against this file first.

## Current Our Metrics (auto-export)

Command:

`npm run grid:our-metrics`

Output snapshot:

| Zoom | Scale | Our effective size (world) | Our screen spacing (px) | Active phases |
|---:|---:|---:|---:|---|
| 10 | 0.10 | 160 | 16.00 | `160:0.7@1.00` |
| 15 | 0.15 | 80 | 12.00 | `80:0.8@1.00` |
| 20 | 0.20 | 80 | 16.00 | `80:0.8@1.00` |
| 33 | 0.33 | 40 | 13.20 | `40:0.9@1.00` |
| 50 | 0.50 | 20 | 10.00 | `20:1@1.00` |
| 75 | 0.75 | 20 | 15.00 | `20:1@1.00` |
| 100 | 1.00 | 20 | 20.00 | `20:1@1.00` |
| 125 | 1.25 | 20 | 25.00 | `20:1@1.00` |
| 150 | 1.50 | 20 | 30.00 | `20:1@1.00` |
| 200 | 2.00 | 20 | 40.00 | `20:1@1.00` |
| 250 | 2.50 | 20 | 50.00 | `20:1@1.00` |
| 300 | 3.00 | 20 | 60.00 | `20:1@1.00` |
| 400 | 4.00 | 20 | 80.00 | `20:1@1.00` |
| 500 | 5.00 | 20 | 100.00 | `20:1@1.00` |

## Current Miro Metrics (auto-analysis)

Command:

`npm run grid:miro-metrics`

Output snapshot:

| Zoom | Miro spacing(px) | Confidence |
|---:|---:|---|
| 10 | 16 | low (tiny dots at low zoom, aliasing likely) |
| 15 | 12 | low (tiny dots at low zoom, aliasing likely) |
| 20 | 16 | low (tiny dots at low zoom, aliasing likely) |
| 33 | 13 | medium |
| 50 | 10 | high |
| 75 | 15 | high |
| 100 | 20 | high |
| 125 | 25 | high |
| 150 | 30 | high |
| 200 | 40 | high |
| 250 | 50 | high |
| 300 | 60 | high |
| 400 | 80 | high |

## Miro vs Our (current state)

Reference points with high confidence:

| Zoom | Miro spacing(px) | Our spacing(px) | Gap |
|---:|---:|---:|---:|
| 50 | 10 | 10 | 0 |
| 75 | 15 | 15 | 0 |
| 100 | 20 | 20 | 0 |
| 125 | 25 | 25 | 0 |
| 150 | 30 | 30 | 0 |
| 200 | 40 | 40 | 0 |
| 250 | 50 | 50 | 0 |
| 300 | 60 | 60 | 0 |
| 400 | 80 | 80 | 0 |

This table shows parity on high-confidence checkpoints (`50-400%`) for screen spacing.
