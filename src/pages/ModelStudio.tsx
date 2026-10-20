import { BRAND } from '../brand'
import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, ChevronRight, Database, Download, FlaskConical, Info, Minus, RotateCcw, SlidersHorizontal, FileText } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useChartColors } from '../lib/useChartColors'
import { InfoPopover } from '../components/InfoPopover'
import { DEFAULT_RISK_MODEL, calibrate, type RiskModel } from '../core/riskModel'
import { fitRiskModel, type FitResult } from '../lib/fitModel'
import { buildHarmLabels } from '../data/outcomes'
import { bandForScore } from '../lib/riskBands'

// The 13 marker ids the model is defined over (stable ordering from the default).
const MARKER_IDS = Object.keys(DEFAULT_RISK_MODEL.markerWeights)

const fmt = (x: number | undefined, d = 3) => (x == null ? '—' : x.toFixed(d))
const pct = (x: number | undefined, d = 1) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`)

/** Pull {id → label} from any assessed player's marker array. */
function markerLabels(byId: Map<string, string>, model: RiskModel) {
  return Object.entries(model.markerWeights)
    .map(([id, weight]) => ({ id, weight, label: byId.get(id) ?? id }))
    .sort((a, b) => b.weight - a.weight)
}

export function ModelStudio() {
  const players = useStore((s) => s.players)
  const baseAssessments = useStore((s) => s.baseAssessments)
  const model = useStore((s) => s.riskModel)
  const setRiskModel = useStore((s) => s.setRiskModel)
  const importedLabels = useStore((s) => s.importedLabels)
  const c = useChartColors()

  const [result, setResult] = useState<FitResult | null>(null)
  const [fitting, setFitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Synthetic proxy ground-truth harm label per player (the demo's labels).
  const harmLabels = useMemo(() => buildHarmLabels(players), [players])

  // id → human label, sourced from the live assessments' marker arrays.
  const labelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of baseAssessments.values()) {
      for (const mk of a.markers) if (!m.has(mk.id)) m.set(mk.id, mk.label)
      if (m.size >= MARKER_IDS.length) break
    }
    return m
  }, [baseAssessments])

  const priorSet = useMemo(() => new Set(model.markersPrior ?? []), [model.markersPrior])
  const activeWeights = useMemo(() => markerLabels(labelById, model), [labelById, model])
  const maxWeight = Math.max(...activeWeights.map((w) => w.weight), 0.0001)

  const provenance = model.provenance
  const isOperatorFit = provenance === 'operator-fit'
  const isManual = provenance === 'manual'
  const calib = model.calibration
  const calibLabel =
    calib.type === 'logistic'
      ? `p = sigmoid(${calib.a.toFixed(3)}·agg/100 ${calib.b >= 0 ? '+' : '−'} ${Math.abs(calib.b).toFixed(3)})`
      : calib.type === 'hazard'
        ? `discrete-time hazard · ${calib.horizonMonths}-month horizon · β = ${calib.beta.toFixed(2)}`
        : calib.type === 'isotonic'
          ? `isotonic · ${calib.knots.length} knots`
          : 'uncalibrated'
  const horizonSuffix = calib.type === 'hazard' ? ` within ${calib.horizonMonths} months` : ''
  // Hazard models report headline metrics at their horizon (the probability the UI shows).
  const hz = calib.type === 'hazard' && model.metrics?.aucAtHorizon != null ? calib.horizonMonths : null
  const baseRate =
    calib.type === 'hazard' && model.metrics?.eventsWithinHorizon && model.metrics?.observableAtHorizon
      ? model.metrics.eventsWithinHorizon / model.metrics.observableAtHorizon
      : calib.type === 'hazard' && model.metrics?.baseRateAtHorizon
        ? model.metrics.baseRateAtHorizon
        : (model.metrics?.prevalence ?? 0.0479)
  // "Score → chance" ladder: the human-readable form of the calibration.
  const ladder = [20, 40, 60, 80].map((s) => ({ s, p: calibrate(s, calib) }))
  const [showMath, setShowMath] = useState(false)
  const [allWeights, setAllWeights] = useState(false)

  // Anonymised benchmark card: metrics + weights + provenance, NO player data.
  // Operators share these to compare re-fits across deployments (docs/BENCHMARKS.md).
  const exportBenchmark = () => {
    const card = {
      product: BRAND.slug,
      kind: 'benchmark-card/v1',
      exportedAt: new Date().toISOString(),
      model: {
        version: model.version,
        provenance: model.provenance,
        design: model.design,
        markerWeights: model.markerWeights,
        markerTransforms: model.markerTransforms ?? null,
        calibration: model.calibration,
        metrics: model.metrics ?? null,
        fittedOn: model.fittedOn ?? null,
        caveat: model.caveat,
      },
    }
    const blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${BRAND.slug}-benchmark-${model.version}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const runFit = () => {
    setFitting(true)
    setError(null)
    // Synchronous fit — fast for the demo portfolio; guard the UI with a flag so
    // the button reads as busy for the render tick before the work lands.
    try {
      // Prefer the operator's real imported outcome labels; fall back to the
      // synthetic harm proxy for the demo. Feature space is identical either way.
      const usingImported = !!importedLabels
      const labeled = usingImported ? players.filter((p) => importedLabels!.has(p.id)) : players
      const rows = labeled.map((p) => {
        const a = baseAssessments.get(p.id)
        const markers = a ? Object.fromEntries(a.markers.map((m) => [m.id, m.score])) : {}
        const label = usingImported ? (importedLabels!.get(p.id) === 1 ? 1 : 0) : harmLabels.get(p.id) ? 1 : 0
        return { markers, label }
      })
      const fit = fitRiskModel(rows, { markerIds: MARKER_IDS, stamp: `${labeled.length}p` })
      setResult(fit)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fit failed.')
      setResult(null)
    } finally {
      setFitting(false)
    }
  }

  const adopt = () => {
    if (!result) return
    setRiskModel(result.model)
    setResult(null)
  }

  const resetDefault = () => {
    setRiskModel(DEFAULT_RISK_MODEL)
    setResult(null)
  }

  return (
    <div>
      {/* Hero */}
      <div className="page-head">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-2.5">
              <div>
                <h1 className="large-title">Model studio</h1>
                <p className="text-[14px] text-soft mt-0.5">
                  Inspect the active risk model, recalibrate it in-browser on labelled data, and adopt it.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1"
                style={
                  isManual
                    ? { background: 'rgba(255,159,10,0.15)', color: '#c46a1c' }
                    : isOperatorFit
                      ? { background: 'color-mix(in srgb, var(--teal) 14%, transparent)', color: 'var(--teal)' }
                      : { background: 'var(--brand-tint)', color: 'var(--brand)' }
                }
              >
                {isManual ? <SlidersHorizontal size={12} /> : isOperatorFit ? <FileText size={12} /> : <FlaskConical size={12} />}
                {isManual ? 'Manually tuned' : isOperatorFit ? 'Operator-fit' : 'Reference-fit'}
              </span>
              <span className="chip tabular-nums">{model.version}</span>
              {model.fittedOn?.cohort && <span className="chip">{model.fittedOn.cohort}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Active model ─────────────────────────────────────────────────── */}
      <div className="mt-5">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="eyebrow">Active model · how good is it?</span>
          <InfoPopover
            align="left"
            width={310}
            title="Reading these numbers"
            triggerLabel="How to read the validation metrics"
            triggerClassName="focus-ring inline-flex h-5 w-5 items-center justify-center rounded-full text-faint transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            trigger={<Info size={13} />}
          >
            <p>Every number below was measured by checking the model’s predictions against what actually happened to players it had never seen. Tap any metric for what it means.</p>
            <p className="text-faint">The outcome is rare (~5%), so judge everything against that baseline — not against 100%.</p>
          </InfoPopover>
        </div>
        <div className="kpi-strip" style={{ ['--kpi-cols' as string]: 5 }}>
          <Metric
            label={hz ? `ROC-AUC · ${hz} mo` : 'ROC-AUC'}
            value={fmt(hz ? model.metrics?.aucAtHorizon : model.metrics?.rocAuc, 2)}
            sub={hz ? `ranking skill · ever ${fmt(model.metrics?.rocAuc, 2)}` : 'ranking skill'}
            explain="Take one player who later hit the harm outcome and one who didn’t: this is how often the model ranks the harmed one as riskier. 0.5 is a coin flip; 1.0 is perfect. Published models on this kind of account data typically land in the 0.6–0.75 range."
          />
          <Metric
            label="PR-AUC"
            value={fmt(model.metrics?.prAuc, 3)}
            sub={model.metrics?.prBaseline != null ? `baseline ${fmt(model.metrics.prBaseline, 3)}` : 'precision-recall'}
            explain="How precise the model can be while still catching cases. Judge it against the baseline: flagging players at random scores the base rate, so a value ~2× the baseline means flagged lists are about twice as concentrated in real cases as chance."
          />
          <Metric
            label={hz ? `Brier · ${hz} mo` : 'Brier'}
            value={fmt(hz ? model.metrics?.brierAtHorizon : model.metrics?.brier, 3)}
            sub="probability accuracy"
            explain="The average squared gap between predicted probability and outcome. Lower is better; it penalises over- and under-confidence alike."
          />
          <Metric
            label={hz ? `ECE · ${hz} mo` : 'ECE'}
            value={fmt(hz ? model.metrics?.eceAtHorizon : model.metrics?.ece, 3)}
            sub="accuracy of the stated %"
            align="right"
            explain="Expected calibration error: the average gap between stated probabilities and observed rates. 0.006 means stated percentages are off by about half a point."
          />
          <Metric
            label={model.metrics?.n != null ? 'Prevalence · n' : 'Prevalence'}
            value={pct(model.metrics?.prevalence, 1)}
            align="right"
            sub={
              model.metrics?.n != null
                ? `${model.metrics.n.toLocaleString()} rows · ${(model.metrics.positives ?? 0).toLocaleString()} pos`
                : 'harm base rate'
            }
            explain="The outcome rate in the fitting data — the baseline any model has to beat."
          />
        </div>

        {isManual && (
          <div className="card mt-5 reveal !py-4" style={{ border: '1px solid rgba(255,159,10,0.4)' }}>
            <div className="flex gap-2.5 items-start">
              <SlidersHorizontal size={16} className="mt-0.5 shrink-0" style={{ color: '#c46a1c' }} />
              <p className="text-[12.5px] leading-relaxed text-soft">
                <span className="font-semibold" style={{ color: '#c46a1c' }}>Manually tuned — unvalidated.</span>{' '}
                These weights reflect human judgement, so the validation metrics are deliberately blank and the
                harm-probability calibration was carried over from the previous model (it may no longer be accurate).
                Re-fit on labelled data to restore validated metrics, or reset to the default.
              </p>
            </div>
          </div>
        )}

        {/* Cold-start note */}
        <div className="card mt-5 reveal !py-4">
          <div className="flex gap-2.5 items-start">
            <Info size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
            <p className="text-[12.5px] leading-relaxed text-soft">
              <span className="font-semibold" style={{ color: 'var(--text)' }}>Cold-start.</span>{' '}
              The default model works out of the box — it ships fitted to later self-exclusion in a longitudinal
              research cohort of online bettors. Feed
              labelled data to improve it: re-fit below to recalibrate the marker weights and the
              harm-probability mapping to your own population, then adopt.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5 reveal">
          {/* Marker weights */}
          <div className="card lg:col-span-2">
            <div className="flex items-center gap-1.5">
              <h2 className="section-title">How much each behaviour counts</h2>
              <InfoPopover
                align="left"
                width={320}
                title="How the score is built"
                triggerLabel="How the score is built from the weights"
                triggerClassName="focus-ring inline-flex h-5 w-5 items-center justify-center rounded-full text-faint transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                trigger={<Info size={13} />}
              >
                <p>Each behaviour gets a 0–100 marker score from the player’s last 92 days. The overall score is simply the average of those markers, where heavier behaviours count more.</p>
                <p>A weight can never be negative — no behaviour can make a player look <em>safer</em>.</p>
                <p className="text-faint">The exact math: score = Σ wᵢ·markerᵢ ÷ Σ wᵢ. Weights were fitted to real later self-exclusion, blending a monotonic multivariate fit with each marker’s standalone predictive power.</p>
              </InfoPopover>
            </div>
            <p className="section-sub">
              The heaviest behaviour ({activeWeights[0]?.label.toLowerCase()}) pulls
              ~{Math.round(maxWeight / Math.max(0.0001, Math.min(...activeWeights.map((w) => w.weight))))}× harder
              on the score than the lightest. Grey bars are literature priors with no analog in the fitting data.
            </p>
            <div className="mt-4 space-y-1">
              {(allWeights ? activeWeights : activeWeights.slice(0, 6)).map((w) => {
                const prior = priorSet.has(w.id)
                return (
                  <div key={w.id} className="lift rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold truncate">{w.label}</span>
                          {prior && (
                            <span
                              className="text-[10px] font-bold rounded-full px-1.5 py-0.5 shrink-0"
                              style={{ background: 'var(--surface-3)', color: 'var(--text-faint)' }}
                              title="Literature prior — no analog in betting-only data"
                            >
                              prior
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[15px] font-bold tabular-nums shrink-0" style={{ color: 'var(--brand)' }}>
                        {w.weight.toFixed(3)}
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(w.weight / maxWeight) * 100}%`,
                          background: prior ? 'var(--text-faint)' : 'var(--brand)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            {activeWeights.length > 6 && (
              <button
                type="button"
                onClick={() => setAllWeights((v) => !v)}
                className="focus-ring mt-3 text-[13px] font-semibold"
                style={{ color: 'var(--brand)' }}
              >
                {allWeights ? 'Show top 6' : `Show all ${activeWeights.length} behaviours`}
              </button>
            )}
          </div>

          {/* Calibration */}
          <div className="card">
            <h2 className="section-title">From score to probability</h2>
            <p className="section-sub">
              The 0–100 score ranks players; this layer translates it into a calibrated probability of the
              harm outcome{horizonSuffix}.
            </p>
            <div className="mt-4 space-y-1.5">
              {ladder.map(({ s, p }) => {
                const band = bandForScore(s)
                return (
                  <div key={s} className="flex items-center gap-3 rounded-lg px-3.5 py-2.5" style={{ background: 'var(--surface-2)' }}>
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: band.color }} />
                    <span className="text-[13px] flex-1">
                      Score <b className="tabular-nums">{s}</b>
                      <span className="text-faint"> ({band.label})</span>
                    </span>
                    <span className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--brand)' }}>
                      ~{(p * 100).toFixed(p < 0.05 ? 1 : 0)}%{calib.type === 'hazard' ? ` in ${calib.horizonMonths} mo` : ' chance'}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-faint">
              The percentages look small because the outcome itself is rare
              (~{(baseRate * 100).toFixed(1)}% of everyone{horizonSuffix}) — a score-80 player is
              ~{Math.max(1, Math.round(calibrate(80, calib) / Math.max(1e-6, baseRate)))}× the average
              player’s risk.
            </p>
            <button
              className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold focus-ring rounded-md"
              style={{ color: 'var(--brand)' }}
              onClick={() => setShowMath((v) => !v)}
            >
              {showMath ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Show the exact math
            </button>
            {showMath && (
              <div className="mt-2 rounded-lg px-4 py-3" style={{ background: 'var(--surface-2)' }}>
                <code className="text-[12px] font-mono tabular-nums" style={{ color: 'var(--brand)' }}>
                  {calibLabel}
                </code>
                {calib.type === 'logistic' && (
                  <p className="mt-2 text-[11.5px] text-faint tabular-nums">
                    slope a = {calib.a.toFixed(3)} · intercept b = {calib.b.toFixed(3)} · “sigmoid” squashes any
                    number into 0–1: sigmoid(z) = 1 / (1 + e<sup>−z</sup>)
                  </p>
                )}
              </div>
            )}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
              <div className="eyebrow mb-2">Why two layers</div>
              <p className="text-[12px] leading-relaxed text-faint">
                Kept separate on purpose: if the rare-outcome probability were used as the score, nearly
                everyone would read “Low”. The score drives the bands; this layer supplies the honest
                absolute risk.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Re-fit on data ───────────────────────────────────────────────── */}
      <div className="card mt-5 reveal">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
            >
              <FlaskConical size={16} />
            </span>
            <div>
              <h2 className="section-title">Re-fit on data</h2>
              <p className="section-sub">
                Fits marker weights and calibration on your labelled players, entirely in this browser.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={exportBenchmark}
              className="btn btn-ghost"
              title="Download the active model's anonymised benchmark card (metrics + weights + provenance — no player data) for community comparison."
            >
              <Download size={15} /> Export benchmark
            </button>
            <button onClick={runFit} disabled={fitting || players.length === 0} className="btn btn-primary">
              <FlaskConical size={16} />
              {fitting ? 'Fitting…' : 'Fit on current portfolio'}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg px-4 py-3" style={{ background: 'var(--surface-2)' }}>
          <p className="text-[12.5px] leading-relaxed text-faint">
            {importedLabels ? (
              <>
                <span className="font-semibold" style={{ color: 'var(--text-soft)' }}>Fitting on your data.</span>{' '}
                Using the <b className="text-soft">{importedLabels.size.toLocaleString()}</b> outcome label
                {importedLabels.size === 1 ? '' : 's'} from your imported dataset — a non-negative logistic on those
                players’ 13 marker scores, calibrated to your population. Nothing leaves the browser.
              </>
            ) : (
              <>
                <span className="font-semibold" style={{ color: 'var(--text-soft)' }}>How the demo fits.</span>{' '}
                It labels each of the {players.length.toLocaleString()} players with the synthetic harm proxy and fits
                a non-negative logistic on their 13 marker scores. A real operator supplies true labels via{' '}
                <span className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--brand)' }}>
                  <Database size={12} /> Import data
                </span>{' '}
                — the feature space is identical.
              </>
            )}
          </p>
        </div>

        {error && (
          <div
            className="mt-4 rounded-lg px-4 py-3 text-[13px]"
            style={{ background: 'rgba(255,59,48,0.1)', color: '#d1432b' }}
          >
            {error}
          </div>
        )}

        {result && <FitResultPanel result={result} model={model} labelById={labelById} chart={c} onAdopt={adopt} onReset={resetDefault} />}
      </div>

      {/* ── Tune by hand ─────────────────────────────────────────────────── */}
      <ManualTune model={model} labelById={labelById} onApply={setRiskModel} onResetDefault={resetDefault} />

      {/* ── Methodology footnote ─────────────────────────────────────────── */}
      <div className="card mt-5 reveal !py-4">
        <div className="flex gap-2.5 items-start">
          <Info size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--text-faint)' }} />
          <p className="text-[12.5px] leading-relaxed text-faint">
            <span className="font-semibold" style={{ color: 'var(--text-soft)' }}>Methodology.</span>{' '}
            A non-negative (monotonic) logistic on the marker scores yields the 0–100 aggregate, which
            a second logistic maps to a calibrated harm probability. Both layers are validated on a
            held-out split. Self-exclusion is an under-ascertained proxy for harm, so the fit is tuned
            for recall — false positives are expected. {model.caveat}
          </p>
        </div>
      </div>
    </div>
  )
}

/** A validation stat with a click-to-open plain-language explainer.
 *  No `.lift` here: its will-change/transform makes a stacking context that
 *  would trap the popover beneath sibling cards. */
function Metric({ label, value, sub, explain, align = 'left' }: { label: string; value: string; sub: string; explain: string; align?: 'left' | 'right' }) {
  return (
    <div className="px-5 py-4" style={{ background: 'var(--surface)' }}>
      <div className="flex items-center justify-between gap-1">
        <span className="eyebrow">{label}</span>
        <InfoPopover
          align={align}
          width={300}
          title={label}
          triggerLabel={`What ${label} means`}
          triggerClassName="focus-ring inline-flex h-5 w-5 items-center justify-center rounded-full text-faint transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          trigger={<Info size={13} />}
        >
          <p>{explain}</p>
        </InfoPopover>
      </div>
      <div className="stat-num mt-2.5">{value}</div>
      <div className="mt-1.5 text-[12.5px] text-faint">{sub}</div>
    </div>
  )
}

/** Manual tuning: sliders over the marker weights with a live portfolio preview.
 *  Honest by construction — applying drops the validation metrics (they no
 *  longer describe the tuned model) and flags the calibration as carried over. */
function ManualTune({
  model,
  labelById,
  onApply,
  onResetDefault,
}: {
  model: RiskModel
  labelById: Map<string, string>
  onApply: (m: RiskModel) => void
  onResetDefault: () => void
}) {
  const baseAssessments = useStore((s) => s.baseAssessments)
  const [draft, setDraft] = useState<Record<string, number> | null>(null)

  const start = () => setDraft({ ...model.markerWeights })
  const cancel = () => setDraft(null)

  // Live preview: portfolio mean + band occupancy under the draft weights.
  const preview = useMemo(() => {
    if (!draft) return null
    const summarise = (weights: Record<string, number>) => {
      const counts: Record<string, number> = { low: 0, moderate: 0, elevated: 0, high: 0, critical: 0 }
      let sum = 0
      let n = 0
      for (const a of baseAssessments.values()) {
        let ws = 0
        let dot = 0
        for (const mk of a.markers) {
          const w = weights[mk.id] ?? 0
          ws += w
          dot += w * mk.score
        }
        const s = ws > 0 ? Math.round(dot / ws) : 0
        sum += s
        n++
        counts[bandForScore(s).id]++
      }
      return { counts, mean: n ? Math.round(sum / n) : 0 }
    }
    return { before: summarise(model.markerWeights), after: summarise(draft) }
  }, [draft, baseAssessments, model.markerWeights])

  const apply = () => {
    if (!draft) return
    onApply({
      version: `manual-${new Date().toISOString().slice(0, 10)}`,
      provenance: 'manual',
      markerWeights: { ...draft },
      calibration: model.calibration,
      // Metrics deliberately dropped: they described the previous weights.
      markersFitted: model.markersFitted,
      markersPrior: model.markersPrior,
      design: 'Manually tuned marker weights over the 0–100 markers; harm-probability calibration carried over from the previous model.',
      caveat:
        'Manually tuned — not statistically validated. The carried-over calibration may no longer be accurate; re-fit on labelled data to recalibrate.',
    })
    setDraft(null)
  }

  const rows = Object.entries(draft ?? model.markerWeights)
    .map(([id, w]) => ({ id, w, label: labelById.get(id) ?? id }))
    .sort((a, b) => b.w - a.w)

  const BAND_META: { id: string; label: string; color: string }[] = [
    { id: 'low', label: 'Low', color: '#4f8a5f' },
    { id: 'moderate', label: 'Mod', color: '#a3841a' },
    { id: 'elevated', label: 'Elev', color: '#c46a1c' },
    { id: 'high', label: 'High', color: '#d1432b' },
    { id: 'critical', label: 'Crit', color: '#b81d45' },
  ]

  return (
    <div className="card mt-5 reveal">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,159,10,0.15)', color: '#c46a1c' }}
          >
            <SlidersHorizontal size={16} />
          </span>
          <div>
            <h2 className="section-title">Tune by hand</h2>
            <p className="section-sub">
              Adjust a behaviour’s weight and watch the portfolio re-score. Manual weights are marked unvalidated.
            </p>
          </div>
        </div>
        {!draft && (
          <button onClick={start} className="btn btn-ghost shrink-0">
            <SlidersHorizontal size={15} /> Start tuning
          </button>
        )}
      </div>

      {draft && (
        <>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-1">
                <span className="text-[13px] font-medium flex-1 min-w-0 truncate" title={r.id}>
                  {r.label}
                </span>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.05}
                  value={draft[r.id] ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d!, [r.id]: Number(e.target.value) }))}
                  className="w-40 accent-[var(--accent,#0e8d7c)]"
                  aria-label={`Weight for ${r.label}`}
                />
                <span className="text-[13px] font-bold tabular-nums w-11 text-right" style={{ color: 'var(--brand)' }}>
                  {(draft[r.id] ?? 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {preview && (
            <div className="mt-4 rounded-lg px-4 py-3.5" style={{ background: 'var(--surface-2)' }}>
              <div className="eyebrow mb-2.5">Live preview · what would change</div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="text-[13px]">
                  Portfolio mean{' '}
                  <b className="tabular-nums">{preview.before.mean}</b>
                  <ArrowRight size={12} className="inline mx-1 align-[-1px] text-faint" />
                  <b className="tabular-nums" style={{ color: 'var(--brand)' }}>{preview.after.mean}</b>
                </span>
                {BAND_META.map((b) => {
                  const from = preview.before.counts[b.id] ?? 0
                  const to = preview.after.counts[b.id] ?? 0
                  return (
                    <span key={b.id} className="inline-flex items-center gap-1.5 text-[12.5px] tabular-nums">
                      <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                      {b.label} {from}
                      <ArrowRight size={11} className="text-faint" />
                      <b style={to !== from ? { color: b.color } : undefined}>{to}</b>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={apply} className="btn btn-primary">
              <ArrowRight size={15} /> Apply weights
            </button>
            <button onClick={() => setDraft({ ...model.markerWeights })} className="btn btn-ghost">
              <RotateCcw size={15} /> Reset sliders
            </button>
            <button onClick={cancel} className="btn btn-ghost">Cancel</button>
            <button onClick={() => { onResetDefault(); setDraft(null) }} className="btn btn-ghost text-faint">
              Back to default model
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** Result panel: new-vs-active metrics, the calibration curve, and weight deltas. */
function FitResultPanel({
  result,
  model,
  labelById,
  chart: c,
  onAdopt,
  onReset,
}: {
  result: FitResult
  model: RiskModel
  labelById: Map<string, string>
  chart: ReturnType<typeof useChartColors>
  onAdopt: () => void
  onReset: () => void
}) {
  const m = result.metrics
  const prev = model.metrics ?? {}

  // Metric comparison — direction says whether "up" is better for that metric.
  const metrics: { key: string; label: string; now: number | undefined; before: number | undefined; higherBetter: boolean; d: number }[] = [
    { key: 'rocAuc', label: 'ROC-AUC', now: m.rocAuc, before: prev.rocAuc, higherBetter: true, d: 3 },
    { key: 'prAuc', label: 'PR-AUC', now: m.prAuc, before: prev.prAuc, higherBetter: true, d: 3 },
    { key: 'brier', label: 'Brier', now: m.brier, before: prev.brier, higherBetter: false, d: 3 },
    { key: 'ece', label: 'ECE', now: m.ece, before: prev.ece, higherBetter: false, d: 3 },
  ]

  // New weights vs the currently active weights, sorted by new weight desc.
  const weightRows = result.weights
    .map((w) => ({
      id: w.id,
      label: labelById.get(w.id) ?? w.id,
      now: w.weight,
      before: model.markerWeights[w.id] ?? 0,
    }))
    .sort((a, b) => b.now - a.now)
  const maxWeight = Math.max(...weightRows.flatMap((w) => [w.now, w.before]), 0.0001)

  const curveData = result.calibrationCurve.map((pt) => ({
    p: Math.round(pt.p * 100),
    obs: Math.round(pt.obs * 100),
    n: pt.n,
  }))

  return (
    <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--hairline)' }}>
      <div className="flex items-center gap-2 mb-4">
        <FileText size={15} style={{ color: 'var(--brand)' }} />
        <h3 className="section-title">Re-fit result</h3>
        <span className="chip tabular-nums">{m.n.toLocaleString()} rows · {m.positives.toLocaleString()} positives</span>
        {result.shapes.deltaAuc != null && (
          <span
            className="chip tabular-nums"
            title="Monotone marker shapes (PAVA) are tried on the holdout and adopted only if they clearly beat the plain fit."
          >
            {result.shapes.used
              ? `learned shapes adopted · +${result.shapes.deltaAuc.toFixed(3)} AUC`
              : `shapes tried · ${result.shapes.deltaAuc >= 0 ? '+' : ''}${result.shapes.deltaAuc.toFixed(3)} AUC — kept plain`}
          </span>
        )}
      </div>

      {/* New vs active metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((mt) => {
          const delta = mt.now != null && mt.before != null ? mt.now - mt.before : undefined
          const better = delta == null || delta === 0 ? null : mt.higherBetter ? delta > 0 : delta < 0
          const color = better == null ? 'var(--text-faint)' : better ? '#3f8a55' : '#d1432b'
          return (
            <div key={mt.key} className="rounded-lg px-4 py-3.5" style={{ background: 'var(--surface-2)' }}>
              <div className="eyebrow mb-2">{mt.label}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-bold tabular-nums">{fmt(mt.now, mt.d)}</span>
                {delta != null && delta !== 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums" style={{ color }}>
                    {better ? <ArrowUpRight size={13} strokeWidth={2.5} /> : <ArrowDownRight size={13} strokeWidth={2.5} />}
                    {Math.abs(delta).toFixed(mt.d)}
                  </span>
                )}
                {delta === 0 && <Minus size={13} style={{ color: 'var(--text-faint)' }} />}
              </div>
              <div className="text-[11px] text-faint mt-1.5 tabular-nums">active {fmt(mt.before, mt.d)}</div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Calibration curve */}
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <h4 className="section-title">Calibration curve</h4>
          <p className="section-sub">Predicted harm probability vs observed rate — should track the diagonal.</p>
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curveData} margin={{ top: 8, right: 10, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={c.grid} strokeWidth={1} vertical={false} />
                <XAxis
                  dataKey="p"
                  type="number"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={{ fill: c.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={{ fill: c.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  unit="%"
                />
                <Tooltip
                  cursor={{ stroke: c.tooltipBorder, strokeWidth: 1 }}
                  contentStyle={{
                    background: c.tooltipBg,
                    border: `1px solid ${c.tooltipBorder}`,
                    borderRadius: 12,
                    color: c.text,
                    fontSize: 12,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                  }}
                  formatter={(value: number, _n, item) => [
                    `${value}% observed · n=${(item?.payload as { n: number })?.n ?? 0}`,
                    'Observed',
                  ]}
                  labelFormatter={(l) => `Predicted ${l}%`}
                />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: 100, y: 100 },
                  ]}
                  stroke={c.axis}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                />
                <Line
                  type="monotone"
                  dataKey="obs"
                  name="Observed"
                  stroke={c.brand}
                  strokeWidth={2.25}
                  dot={{ r: 3, strokeWidth: 0, fill: c.brand }}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 text-[11px] text-faint pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
            Dashed line is perfect calibration (y = x). Points above the line under-predict harm; below, over-predict.
          </div>
        </div>

        {/* New weights vs active */}
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <h4 className="section-title">New weights vs active</h4>
          <p className="section-sub">Refit marker weights (bar) against the currently active weights (marker).</p>
          <div className="mt-4 space-y-1">
            {weightRows.map((w) => {
              const delta = w.now - w.before
              return (
                <div key={w.id} className="rounded-lg px-3 py-2" style={{ background: 'var(--surface)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-medium truncate flex-1 min-w-0">{w.label}</span>
                    <span className="text-[13px] font-bold tabular-nums shrink-0" style={{ color: 'var(--brand)' }}>
                      {w.now.toFixed(3)}
                    </span>
                    {Math.abs(delta) >= 0.0005 && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums shrink-0 w-14 justify-end"
                        style={{ color: delta > 0 ? '#3f8a55' : '#d1432b' }}
                      >
                        {delta > 0 ? <ArrowUpRight size={12} strokeWidth={2.5} /> : <ArrowDownRight size={12} strokeWidth={2.5} />}
                        {Math.abs(delta).toFixed(3)}
                      </span>
                    )}
                  </div>
                  {/* new (brand) over active (faint marker) on a shared scale */}
                  <div className="mt-1.5 relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${(w.before / maxWeight) * 100}%`, background: 'var(--text-faint)', opacity: 0.5 }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${(w.now / maxWeight) * 100}%`, background: 'var(--brand)' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center gap-3 pt-5" style={{ borderTop: '1px solid var(--hairline)' }}>
        <button onClick={onAdopt} className="btn btn-primary">
          <ArrowRight size={16} /> Adopt model
        </button>
        <button onClick={onReset} className="btn btn-ghost">
          <RotateCcw size={16} /> Reset to default
        </button>
        <p className="text-[12px] text-faint flex-1 min-w-[220px]">
          Adopting re-scores the whole portfolio with the new weights and calibration. The active-model
          card above updates to reflect it.
        </p>
      </div>
    </div>
  )
}
