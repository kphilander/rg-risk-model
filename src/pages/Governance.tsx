import { FileText, GitCommitHorizontal, Globe, Layers } from 'lucide-react'
import { KpiCard } from '../components/KpiCard'
import { useStore } from '../store/useStore'
import { MODEL_CARD } from '../lib/modelCard'
import { generateReportPack } from '../lib/reportPack'
import { JURISDICTIONS } from '../core/jurisdictions'

const OPERATOR_NAME = 'Demo Operator'
const MAX_WEIGHT = 1.5
const MAX_GINI = 0.3

export function Governance() {
  const stats = useStore((s) => s.stats)
  const interventions = useStore((s) => s.interventions)
  const players = useStore((s) => s.players)
  const v = MODEL_CARD.validation
  const o = MODEL_CARD.overlay

  return (
    <div>
      {/* Hero */}
      <div className="page-head">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-2.5">
              <div>
                <h1 className="large-title">Model governance</h1>
                <p className="text-[14px] text-soft mt-0.5">Model card, validation results, and provenance for the deployed score.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold tabular-nums rounded-full px-2.5 py-1" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
                {MODEL_CARD.composition}
              </span>
              <span className="chip">{MODEL_CARD.modelType}</span>
              <span className="chip">{MODEL_CARD.windowDays}-day window</span>
            </div>
          </div>
          <button
            onClick={() => generateReportPack({ stats, interventions, players, operatorName: OPERATOR_NAME })}
            className="btn btn-primary shrink-0"
          >
            <FileText size={16} /> Generate regulator report pack
          </button>
        </div>
      </div>

      {/* Validation */}
      <div className="mt-5">
        <div className="eyebrow mb-3">Validation</div>
        <div className="kpi-strip">
          <KpiCard label={`ROC-AUC · ${v.horizonMonths}-month`} value={v.aucAtHorizon.toFixed(2)} sub={`ever-closure ${v.aucLogistic.toFixed(2)} · multivariate ceiling ${v.aucCeiling.toFixed(2)}`} />
          <KpiCard label="PR-AUC" value={v.prAuc.toFixed(2)} sub={`baseline ${v.prBaseline.toFixed(2)} (${(v.prBaseline * 100).toFixed(1)}% prevalence)`} />
          <KpiCard label="Outcome prevalence" value={`${(v.prevalence * 100).toFixed(1)}%`} sub="prospective RG-coded closures" />
          <KpiCard label="Recall @ op-point" value={`${(v.operatingPoint.recall * 100).toFixed(0)}%`} valueColor="#c46a1c" sub={`precision ${(v.operatingPoint.precision * 100).toFixed(0)}% — tuned for recall`} />
        </div>
        <div className="card mt-5 reveal !py-4">
          <p className="text-[13px] leading-relaxed text-soft">
            <span className="font-semibold" style={{ color: 'var(--text)' }}>Design.</span> {v.design}
          </p>
        </div>
      </div>

      {/* Score composition / Overlay */}
      <div className="card mt-5 reveal">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
            <Layers size={16} />
          </span>
          <div>
            <h2 className="section-title">Score composition</h2>
            <p className="section-sub">The shipped score is a composition: a validated data model plus a hand-set observation overlay. {MODEL_CARD.composition}.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Data layer — validated */}
          <div className="rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--brand)' }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: 'rgba(10,132,255,0.14)', color: 'var(--brand)' }}>Validated</span>
              <span className="text-[13px] font-semibold">Data layer · {MODEL_CARD.rulesetVersion}</span>
            </div>
            <p className="text-[12.5px] text-soft mt-2 leading-relaxed">
              The statistically-validated 0–100 score, refit to real prospective self-exclusion
              (ROC-AUC {v.aucLogistic.toFixed(2)}). Retained separately as <span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>dataScore</span> and remains individually filterable.
            </p>
          </div>

          {/* Overlay layer — heuristic */}
          <div className="rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid #c46a1c' }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: 'rgba(255,159,10,0.16)', color: '#c46a1c' }}>Heuristic · not validated</span>
              <span className="text-[13px] font-semibold">Overlay · {o.name}</span>
            </div>
            <p className="text-[12.5px] text-soft mt-2 leading-relaxed">{o.type}. Folds the staff interaction log (qualitative observations across 15 player-health markers) into the score.</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-lg px-4 py-3" style={{ background: 'var(--surface-2)' }}>
            <div className="eyebrow mb-1.5">Corroboration uplift</div>
            <p className="text-[12.5px] text-soft leading-relaxed">{o.uplift}</p>
          </div>
          <div className="rounded-lg px-4 py-3" style={{ background: 'var(--surface-2)' }}>
            <div className="eyebrow mb-1.5">Standing disclosure floor</div>
            <p className="text-[12.5px] text-soft leading-relaxed">{o.floor}</p>
          </div>
        </div>

        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
          <div className="eyebrow mb-2" style={{ color: '#c46a1c' }}>What is and isn't validated</div>
          <p className="text-[13px] text-soft leading-relaxed">{o.caveat}</p>
        </div>
      </div>

      {/* Markers & weights */}
      <div className="card mt-5 reveal">
        <h2 className="section-title">Markers &amp; weights</h2>
        <p className="section-sub">Each marker weighted by its standalone discrimination of real self-exclusion (univariate AUC → Gini).</p>
        <div className="mt-4 space-y-1">
          {MODEL_CARD.markers.map((m) => (
            <div key={m.id} className="lift rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold truncate">{m.label}</span>
                    <span
                      className="text-[10px] font-bold rounded-full px-1.5 py-0.5 shrink-0"
                      style={m.fitted
                        ? { background: 'rgba(10,132,255,0.14)', color: 'var(--brand)' }
                        : { background: 'var(--surface-3)', color: 'var(--text-faint)' }}
                    >
                      {m.fitted ? 'Fitted' : 'Prior'}
                    </span>
                  </div>
                  <div className="text-[12px] text-faint mt-0.5 truncate">{m.source}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[15px] font-bold tabular-nums" style={{ color: 'var(--brand)' }}>{m.weight.toFixed(2)}</div>
                  <div className="text-[10px] text-faint tabular-nums">{m.auc != null ? `AUC ${m.auc.toFixed(2)}` : 'no data'}</div>
                </div>
              </div>
              {/* weight bar */}
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                <div className="h-full rounded-full" style={{ width: `${(m.weight / MAX_WEIGHT) * 100}%`, background: m.fitted ? 'var(--brand)' : 'var(--text-faint)' }} />
              </div>
              {/* univariate discrimination */}
              {m.gini != null && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[10px] text-faint w-16 shrink-0">discrimination</span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (m.gini / MAX_GINI) * 100)}%`, background: 'var(--teal)' }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Jurisdiction rule-packs */}
      <div className="card mt-5 reveal">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
            <Globe size={16} />
          </span>
          <div>
            <h2 className="section-title">Jurisdiction rule-packs</h2>
            <p className="section-sub">Per-market helpline, regulator and minimum age used by interventions and the report pack. Illustrative defaults — override per deployment and verify with counsel.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-1.5">
          {JURISDICTIONS.map((g) => (
            <div key={g.id} className="lift rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold truncate">{g.name}</span>
                <span className="chip shrink-0">{g.id}</span>
                <span className="ml-auto text-[13px] font-bold tabular-nums shrink-0" style={{ color: 'var(--brand)' }}>{g.age}+</span>
              </div>
              <div className="text-[12px] text-faint mt-0.5 truncate">{g.regulator}</div>
              <div className="text-[12px] mt-0.5 truncate">
                <span className="font-semibold tabular-nums">{g.helpline}</span>
                <span className="text-faint"> · {g.helplineLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Limitations & version history */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5 reveal">
        <div className="card">
          <h2 className="section-title">Limitations &amp; fairness</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-soft">{MODEL_CARD.limitations}</p>
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
            <div className="eyebrow mb-2">Prior markers (no source-data analog)</div>
            <div className="flex flex-wrap gap-2">
              {MODEL_CARD.priors.map((p) => (
                <span key={p} className="chip">{p}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Ruleset history</h2>
          <p className="section-sub">Versioned for audit + shadow/canary rollout.</p>
          <div className="mt-4 space-y-4">
            {MODEL_CARD.history.map((h, i) => (
              <div key={h.version} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <span className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: i === MODEL_CARD.history.length - 1 ? 'var(--brand-tint)' : 'var(--surface-2)', color: i === MODEL_CARD.history.length - 1 ? 'var(--brand)' : 'var(--text-faint)' }}>
                    <GitCommitHorizontal size={15} />
                  </span>
                  {i < MODEL_CARD.history.length - 1 && <span className="w-px flex-1 mt-1" style={{ background: 'var(--hairline)' }} />}
                </div>
                <div className="pb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold tabular-nums">{h.version}</span>
                    <span className="text-[11px] text-faint">{h.date}</span>
                  </div>
                  <p className="text-[12.5px] text-soft mt-0.5 leading-snug">{h.change}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
