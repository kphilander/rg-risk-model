# Community benchmarks

The default risk model ships fitted to one research cohort (not distributed). Whether its
weights **transport** to other operators, eras, and product mixes is an open
empirical question — and answering it only takes metrics, never data.

## Share a benchmark card

Model studio → **Export benchmark** downloads a `benchmark-card/v1` JSON with:

- model `version`, `provenance`, and `design`
- the fitted **marker weights** (and learned monotone shapes, if adopted)
- the **calibration** parameters
- holdout **metrics** (ROC-AUC, PR-AUC, Brier, ECE) and cohort size/prevalence

It contains **no account-level data** — only aggregate model facts. Cards are
safe to publish, attach to a regulator submission, or contribute back to the
project as a transportability datapoint.

## Reference points

| Model | Cohort | n | Prevalence | ROC-AUC | PR-AUC | Brier | ECE |
| --- | --- | ---:| ---:| ---:| ---:| ---:| ---:|
| `reference-fit-2026.07` | longitudinal online bettors (research cohort) | — | 4.8% | 0.673 | 0.109 | 0.045 | 0.006 |

Published self-exclusion prediction on comparable account features lands in a
similar range (see the white paper, `docs/whitepaper.pdf`, §5.4 and its
references) — if your re-fit is far above it, check for label leakage into the
feature window before celebrating.

## Contribute

Open a PR adding a row to the table above with your card attached (redact the
version string if it embeds anything internal). Cards from **re-fits with
learned shapes** (`…+shapes` versions) are especially useful — they show how
much per-operator shape learning adds beyond transported weights.
