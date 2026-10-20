# Extending the RG Risk Model

The RG Risk Model is built to be **built on** — by operators (bring your own data, wire
your own interventions) and by researchers (add markers, run experiments, validate
models). Everything hangs off a small set of stable seams (ports & registries), so
most extensions are a **single new file**. This is the guide.

- **Architecture map:** ports in [`src/core/ports.ts`](src/core/ports.ts),
  canonical data contract in [`src/core/canonical.ts`](src/core/canonical.ts),
  composition root (wiring) in [`src/core/runtime.ts`](src/core/runtime.ts).

---

## 1. Add a behavioral marker

A marker is a pure function over a player's daily activity window that returns a
0–100 sub-score + a plain-language reason.

```ts
// src/plugins/examples/myMarker.ts
import { defineMarker } from '../markers'

defineMarker({
  id: 'rapid-redeposit',
  label: 'Rapid re-deposit',
  domain: 'financial',        // financial | temporal | control (colours the dot)
  weight: 0.9,                // aggregate weight when included in scoring
  compute: (activity) => {
    const played = activity.filter((d) => d.played)
    const chased = played.filter((d) => d.net < 0 && d.depositCount >= 3).length
    const share = played.length ? chased / played.length : 0
    return {
      score: Math.min(100, share * 250),
      value: `${Math.round(share * 100)}% of losing days`,
      explanation: `Re-deposited 3+ times on ${chased} losing days — a rapid-reload pattern.`,
    }
  },
})
```

Register it by importing the file (see [`src/plugins/index.ts`](src/plugins/index.ts)).
`markerPlugins()` lists all registered markers; `computeExtendedMarkers(activity)`
scores the validated 13 **plus** your plugins.

> Plugin markers stay **out of the validated production score** by default (the
> evidence-weighted 13 in [`src/core/config.ts`](src/core/config.ts)). To promote
> one to production, add it to the engine and **re-fit weights** against real
> outcomes (see §5) — adding a marker changes the model.

A working example ships in
[`src/plugins/examples/weekendConcentration.ts`](src/plugins/examples/weekendConcentration.ts).

---

## 2. Add / bring your own data

Every data feed maps onto the **canonical contract** via a `DataSource` (or an
`IngestionAdapter` for raw operator records). Pick your entry point:

**a) In-app importer (easiest — no code, no config):** open **Import data**
(`/data`), download the CSV templates, drop your files in. Every row is validated
against the format contract (with actionable errors), then scored in your browser
and loadable into the dashboard — nothing is uploaded. The four-file format is
defined once in [`src/core/dataSchema.ts`](src/core/dataSchema.ts) (the single
source for templates, validation, and the adapters): `identities.csv`,
`wagers.csv` (daily betting), `wallet.csv` (deposits/withdrawals/cancellations),
`sessions.csv`.

**b) Batch / SFTP (headless):** drop the same four files into `public/sample-data/`
and run with `VITE_DATA_SOURCE=csv` (see [`.env.example`](.env.example)). Pipeline:
`CSV → ingestion adapters → CanonicalEvent[] → projection → scored players`
([`src/adapters/csvBatch.ts`](src/adapters/csvBatch.ts) +
[`src/core/projection.ts`](src/core/projection.ts)).

**c) Your own source (a few lines):** implement the `DataSource` port and select
it in `runtime.ts`.

```ts
// src/adapters/myFeed.ts
import type { DataSource } from '../core/ports'
import type { CanonicalPlayer } from '../core/canonical'

export class MyFeed implements DataSource {
  readonly id = 'my-feed'
  async load(): Promise<CanonicalPlayer[]> {
    const rows = await fetch('/my/portfolio').then((r) => r.json())
    return rows.map(toCanonicalPlayer) // your mapping → the canonical shape
  }
}
```

**d) Per-operator record mapping:** implement an `IngestionAdapter` (one small
adapter per feed) — see [`src/adapters/csv.ts`](src/adapters/csv.ts) for the
wallet/wager/session/identity examples. Adapters are the only place that knows an
operator's wire format.

---

## 3. Add an intervention / write-back

Actions logged by analysts flow to an `ActionSink`. The demo logs to the console;
production posts to a webhook or the operator's PAM.

```ts
// src/core/sinks.ts (or your own file)
import type { ActionSink } from './ports'
export class MyPamSink implements ActionSink {
  readonly id = 'my-pam'
  async dispatch(action, tenant) {
    await fetch(`${MY_PAM}/limits`, { method: 'POST', body: JSON.stringify(action) })
  }
}
```

Wire it in [`src/core/runtime.ts`](src/core/runtime.ts) (`selectActionSink`).

---

## 4. Define an experiment

Pose an intervention question declaratively: a cohort + competing policies + a
metric. Add it to [`src/lab/experiments.ts`](src/lab/experiments.ts) (or call
`registerExperiment`) and it appears in the **Lab**.

```ts
import type { ExperimentSpec, Policy } from './experiment'

const control: Policy = { id: 'control', label: 'No action', intervene: () => null }

export const myExperiment: ExperimentSpec = {
  id: 'limit-vs-nudge',
  name: 'Deposit limit vs nudge for chasers',
  question: 'For loss-chasers, does a hard limit (L4) beat a nudge (L2)?',
  metric: 'harm_averted',                       // risk_change | harm_averted | crossed_below_high
  cohort: (r) => r.a.topMarkers[0].id === 'chasing-losses',
  arms: [
    control,
    { id: 'nudge', label: 'Nudge (L2)', intervene: () => 2 },
    { id: 'limit', label: 'Limit (L4)', intervene: () => 4 },
  ],
}
```

`runExperiment(spec, players, assessments)` returns per-arm effect estimates with
95% CIs, an uplift, a significance flag, and a plain-language readout. The outcome
model is synthetic + seeded (reproducible) — swap `simulateFinalScore` in
[`src/lab/experiment.ts`](src/lab/experiment.ts) for your own causal model or real
pre/post data.

---

## 5. Validate a model (researchers)

The default marker weights are fitted and validated against **real** prospective
self-exclusion in a longitudinal research cohort (not distributed). The model
card on the **Governance** page reports ROC-AUC, PR-AUC, per-marker univariate
discrimination, and the high-recall operating point. To validate on your own
labelled data, re-fit in **Model studio** and export a benchmark card
([`docs/BENCHMARKS.md`](docs/BENCHMARKS.md)): a comparable, reproducible score
that shares metrics, never data — the basis of the open benchmark.

---

## Conventions

- **UI:** reuse the design-system classes in [`src/index.css`](src/index.css)
  (`.card`, `.section-title`, `.lift`, `.reveal`, …) and CSS variables only —
  never hardcode light/dark colours. New pages get a route in `App.tsx` + a nav
  entry in `Sidebar.tsx`.
- **Determinism:** seed all randomness via `makeRng(seed)` ([`src/lib/rng.ts`](src/lib/rng.ts)).
- **Types:** strict mode; the canonical shapes are the contract — don't leak an
  operator's raw format past its adapter.
