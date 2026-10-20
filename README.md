# Interpretable Player-Risk Model for Online Gambling: Reference Implementation

**Author:** Kahlil Simeon-Rose, Ph.D., Carson College of Business, Washington State University, Everett, WA, USA

**Model version:** `reference-hazard-2026.07` · **License:** MIT

This repository contains a reference implementation of a behavioural risk model
for responsible gambling (RG). The model identifies online gambling accounts
with a high risk of gambling-related harm. The model is interpretable by
construction, calibrated, and auditable. All components operate client-side in a
web browser.

> **Data notice.** All player data in this repository is synthetic. The
> repository contains no real player records.

## 1. Research context

Operators and vendors use machine learning (ML) systems to detect player risk.
There is no standard method to compare these systems. Ghaharian et al. (2026)
specify a benchmark framework with five components:

1. Standardized datasets.
2. Defined detection tasks.
3. Agreed performance metrics.
4. Dataset documentation.
5. Procedures for result submission and validation.

This implementation applies these principles to one open, interpretable model:

| Framework component | Implementation in this repository |
| --- | --- |
| Defined detection task | Prospective detection: first-90-active-day markers predict a later RG-coded account closure within a 12-month horizon. |
| Agreed performance metrics | ROC-AUC, PR-AUC, Brier score, and expected calibration error (ECE), with a fixed high-recall operating point. |
| Dataset documentation | A versioned canonical schema (`src/core/canonical.ts`, `src/core/dataSchema.ts`) and a synthetic sample export. |
| Result submission without data exchange | A `benchmark-card/v1` JSON export. The card contains model parameters and aggregate metrics only. |
| Validation on operator data | In-browser re-fit and recalibration on operator labels, with holdout validation. |

## 2. Model specification

### 2.1 Ordinal risk index

The model calculates 13 behavioural markers over a rolling 92-day window. Each
marker is a deterministic transform on a 0–100 scale. The marker set follows the
behavioural-markers literature (frequency, intensity, variability, and
trajectory; Braverman & Shaffer, 2012):

- Chasing losses
- Increasing bet sizes
- Increasing loss tolerance
- Deposit volatility
- Deposit-frequency escalation
- Repeated loss of winnings (reversed withdrawals)
- Payment-method switching
- Impulsive transactions
- Play frequency
- Shift to faster games
- Longer sessions
- Late-night play
- Inability to stop

The risk index *S* is a non-negative weighted mean of the marker scores. Thus,
*S* is monotonic in each marker. Fixed cut points map *S* to five ordinal bands:

| Band | Low | Moderate | Elevated | High | Critical |
| --- | --- | --- | --- | --- | --- |
| *S* | 0–19 | 20–37 | 38–51 | 52–65 | 66–100 |

Each band has a defined intervention escalation level. Each score has a
per-marker attribution and a narrative explanation.

### 2.2 Weight estimation

The default weights come from a longitudinal research cohort of online bettors.
The cohort is not distributed. The estimation procedure is:

1. Calculate the markers over the 90 days after first activity.
2. Set the label to a later RG-coded account closure. Remove accounts with a
   closure inside the feature window. This design prevents outcome leakage.
3. Fit a non-negative (monotonic) multivariate logistic model.
4. Blend the multivariate coefficients with the univariate discrimination (Gini)
   of each marker. The blend decreases the weight of redundant markers. It does
   not set a literature-anchored marker to zero.

Ten markers have fitted weights. Three markers (longer sessions, late-night play,
inability to stop) have no analog in the fitting data. These three markers have
informed prior weights. `RULESET_PROVENANCE` in `src/core/config.ts` identifies
them.

### 2.3 Probability layer

A discrete-time hazard model maps *S* to an absolute probability of harm:

```
h(j | S) = sigmoid( alpha_piece(j) + beta * S / 100 )
p_H(S)   = 1 - PRODUCT over j = 1..H of ( 1 - h(j | S) )
```

- The baseline `alpha_piece(j)` is piecewise constant over months 1–3, 4–6,
  7–12, 13–24, and 25–36.
- Censoring occurs at the administrative end of the data or at 36 months.
- The software reports `p_12`, the probability of harm within 12 months.

The probability layer is separate from the ordinal index. The outcome base rate
is low, so `p_12` is small for most players. The bands use *S*, not `p_12`.

### 2.4 Performance on the fitting cohort

| Metric | Value |
| --- | --- |
| ROC-AUC, 12-month horizon | 0.711 |
| ROC-AUC, ever-closure label (deployed rule) | 0.673 |
| ROC-AUC, constrained multivariate ceiling (5-fold OOF / in-sample) | 0.684 / 0.688 |
| PR-AUC (base rate 0.048) | 0.109 |
| Brier score, `p_12` (5-fold OOF) | 0.0226 |
| ECE, `p_12` | 0.003 |
| Precision at recall = 0.80 | 0.062 |
| Recall in top score decile (lift) | 0.288 (2.9×) |

These values agree with published first-window prospective models.

### 2.5 Staff-observation overlay (`observed-v1`)

A separate overlay adds structured staff observations to the data score:

- **Corroboration uplift.** Recency-weighted observations increase the score by
  a maximum of 18 points. The weight of each observation decreases when the
  related data marker is already high (incremental-information weighting).
- **Disclosure floor.** An open critical disclosure sets a minimum score of 50
  (Elevated). The floor does not decay with time. Only a human follow-up removes
  the floor.

The overlay is heuristic. It is not statistically validated. The data-only score
is always available (top bar → Data-only).

## 3. Limitations

- **Proxy label.** Self-exclusion is an under-ascertained proxy for harm
  (Catania & Griffiths, 2021). The model is tuned for recall. A flag on a player
  without self-exclusion is an expected result, not an error.
- **Heuristic marker transforms.** Only the weights and the calibration are
  fitted. The 0–100 marker computations are rule-based.
- **Single-cohort weights.** The default weights come from one cohort, one
  period, and one product mix. Transportability to other operators is an open
  empirical question. The re-fit path and the benchmark cards exist to test it.
- **Demographics excluded.** The deployed scorer does not use age or sex.

## 4. Privacy and deployment architecture

- **No data egress.** The production build sets a Content-Security-Policy with
  `connect-src 'none'`. The application sends no network requests. There is no
  backend and no telemetry.
- **Single-file build.** `npm run build:portable` writes one self-contained HTML
  file to `dist-portable/`. The file operates offline and from `file://`.
- **Client-side pseudonymisation.** The import function can replace player IDs
  with SHA-256 hashes before scoring.
- **Minimum data.** A single daily wagers export is sufficient. Column mapping
  is automatic. Identity, wallet, and session files are optional. An optional
  `self_excluded` column supplies outcome labels for recalibration.
- **Audit trail.** Each score-affecting action appends to a hash-chained
  (SHA-256) log. The Compliance page verifies the chain integrity.
- **Local storage only.** "Clear everything stored locally" on the Import page
  removes all application data from the browser.

## 5. Recalibration and benchmark cards

The Model studio page (`/model`) re-fits the weights and the calibration on
operator labels. All calculations occur in the browser.

- The re-fit can learn monotone per-marker shapes (PAVA on quantile-binned
  outcome rates). A holdout guard adopts the shapes only when they increase
  holdout AUC.
- **Export benchmark** writes a `benchmark-card/v1` JSON file. The card contains
  the model version, provenance, design, marker weights, calibration
  parameters, holdout metrics, and prevalence. The card contains no
  account-level data.

Refer to [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md) to contribute a card.

## 6. Synthetic data

A seeded generator makes all demonstration players. The generator samples
behavioural archetypes against an illustrative reference profile
([`src/data/referenceProfile.ts`](src/data/referenceProfile.ts)). The profile
contains aggregate distributions only (quantiles, category frequencies, and
rates). The values are round, generic figures. They do not come from an operator
or a research dataset.

## 7. Software architecture

The application uses a ports-and-adapters (hexagonal) architecture. The user
interface, the store, and the engine depend only on the interfaces in
[`src/core/ports.ts`](src/core/ports.ts). The composition root
([`src/core/runtime.ts`](src/core/runtime.ts)) selects the adapters from
environment variables (refer to [`.env.example`](.env.example)).

```
operator feed → IngestionAdapter → CanonicalEvent → Projection → CanonicalPlayer
              → ScoringEngine(RiskConfig) → Scores → { Dashboard, ActionSink, AuditSink }
```

| Port | Contract | Reference adapter | Production replacement |
| --- | --- | --- | --- |
| `DataSource` | Supplies feature windows | `SyntheticDataSource` | `RestDataSource`, stream |
| `IngestionAdapter` | Maps operator records to the canonical schema | `CsvWalletAdapter` | One adapter for each PAM feed |
| `ScoringEngine` | Calculates assessments | `ruleBasedEngine` | Remote scoring or ML service |
| `AuditSink` | Stores the intervention log | `LocalStorageAuditSink` | WORM store and data warehouse |
| `ActionSink` | Writes actions back to the operator system | `ConsoleActionSink` | `WebhookActionSink` or PAM call |

- **Canonical contract.** [`src/core/canonical.ts`](src/core/canonical.ts)
  defines one versioned schema (`SCHEMA_VERSION`) for events and feature
  windows. Downstream code never reads an operator wire format.
- **Configuration as data.** [`src/core/config.ts`](src/core/config.ts) injects
  the marker weights, band thresholds, and escalation ladder into the engine.
  `JURISDICTION_PACKS` (UKGC, MGA, ON) re-score the same portfolio. Set
  `VITE_JURISDICTION` to select a pack.

### 7.1 Batch-CSV ingestion path

```
public/sample-data/*.csv → CSV ingestion adapters → CanonicalEvent[]
  → EventProjection (events → 92-day windows) → ScoringEngine → dashboard
```

To operate the CSV path:

1. Optional: regenerate the synthetic sample export.

   ```bash
   npx tsx scripts/make-sample-export.ts
   ```

2. Set the data source to CSV.

   ```bash
   echo "VITE_DATA_SOURCE=csv" > .env.local
   ```

3. Start the development server.

   ```bash
   npm run dev
   ```

The sample export has four files: `identities.csv`, `wagers.csv` (daily betting
summaries), `wallet.csv` (deposits, withdrawals, and cancellations), and
`sessions.csv`. [`src/core/projection.ts`](src/core/projection.ts) folds the rows
into feature windows. For an operator integration, replace the sample files and
write one `IngestionAdapter` for each feed.

## 8. Installation

Requirements: Node.js 18 or later.

1. Install the dependencies.

   ```bash
   npm install
   ```

2. Start the development server (http://localhost:5173).

   ```bash
   npm run dev
   ```

3. Make a production build.

   ```bash
   npm run build
   ```

Stack: React 18, TypeScript, Vite, Tailwind CSS, React Router, Recharts, Zustand.

## 9. Extension points

Each extension point needs changes in one file, where possible. Refer to
[`EXTENDING.md`](EXTENDING.md).

- **Marker plugin.** Use `defineMarker({ id, label, compute })` in
  [`src/plugins/`](src/plugins/). Plugin markers stay separate from the
  13 validated markers.
- **Data source.** Supply CSV files (`VITE_DATA_SOURCE=csv`) or implement the
  `DataSource` port.
- **Intervention write-back.** Implement the `ActionSink` port.
- **Experiment.** Declare a cohort, competing policies, and a metric. The Lab
  page (`/lab`) gives per-arm effect estimates with 95% confidence intervals.
- **Model validation.** Re-fit in Model studio on labelled outcomes. Export a
  benchmark card.

## 10. Repository structure

| Path | Content |
| --- | --- |
| `src/core/` | Ports, canonical schema, tenant and risk configuration, projection, sinks, composition root |
| `src/adapters/` | Data sources (synthetic, CSV batch, REST and stream references) and CSV ingestion adapters |
| `src/engine/markers.ts` | The 13 marker calculators |
| `src/engine/scoring.ts` | Aggregation to the 0–100 index, bands, trend, peer percentile |
| `src/engine/narrative.ts` | Narrative explanations |
| `src/engine/observed.ts` | Staff-observation overlay |
| `src/core/riskModel.ts` | Default model parameters, hazard calibration, `applyModel`, `calibrate` |
| `src/lib/fitModel.ts` | In-browser re-fit, calibration, and shape learning |
| `src/lib/riskBands.ts` | Risk bands and intervention escalation |
| `src/data/referenceProfile.ts` | Illustrative distributions for the synthetic generator |
| `src/data/generateData.ts` | Seeded synthetic player and 92-day activity generator |
| `src/brand.ts` | Product name and user-interface labels |
| `scripts/model.json` | Fitted model artifact (parameters and aggregate metrics) |
| `scripts/make-sample-export.ts` | Synthetic CSV export generator |
| `docs/whitepaper.pdf` | Technical white paper (LaTeX source: `docs/whitepaper.tex`) |

## 11. Citation

To cite this software:

> Simeon-Rose, K. (2026). *Interpretable player-risk model for online gambling:
> Reference implementation* (Version reference-hazard-2026.07) [Computer
> software]. Washington State University.

```bibtex
@software{simeonrose2026riskmodel,
  author       = {Simeon-Rose, Kahlil},
  title        = {Interpretable Player-Risk Model for Online Gambling: Reference Implementation},
  version      = {reference-hazard-2026.07},
  year         = {2026},
  institution  = {Washington State University},
  license      = {MIT}
}
```

To cite the benchmark framework:

> Ghaharian, K., Dragicevic, S., Percy, C., Nelson, S. E., Murch, W. S.,
> Heirene, R. M., Simeon-Rose, K., & Schrans, T. (2026). The need for
> benchmarks to advance AI-enabled player risk detection in gambling. *Journal
> of Gambling Studies*. https://doi.org/10.1007/s10899-026-10483-6

## References

- Braverman, J., & Shaffer, H. J. (2012). How do gamblers start gambling:
  Identifying behavioural markers for high-risk internet gambling. *European
  Journal of Public Health, 22*(2), 273–278.
- Catania, M., & Griffiths, M. D. (2021). Understanding online voluntary
  self-exclusion in gambling: An empirical study using account-based behavioral
  tracking data. *International Journal of Environmental Research and Public
  Health, 18*(4), 2000.
- Ghaharian, K., et al. (2026). Refer to Section 11.
