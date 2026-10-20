import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, ShieldCheck, ShieldAlert, Check, X } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { KpiCard } from '../components/KpiCard'
import { useStore } from '../store/useStore'
import { RULESET_PROVENANCE } from '../core/config'
import type { InterventionAction } from '../types'
import type { AuditEntry } from '../core/auditChain'
import { dateTime } from '../lib/format'
import { BRAND } from '../brand'

const KIND_META: Record<AuditEntry['kind'], { label: string; color: string; bg: string }> = {
  intervention: { label: 'Intervention', color: 'var(--brand-strong)', bg: 'var(--brand-tint)' },
  intervention_resolved: { label: 'Resolution', color: '#4f8a5f', bg: 'rgba(52,199,89,0.16)' },
  interaction: { label: 'Observation', color: '#3e6488', bg: 'rgba(94,155,255,0.14)' },
}

export function Compliance() {
  const interventions = useStore((s) => s.interventions)
  const resolveIntervention = useStore((s) => s.resolveIntervention)
  const audit = useStore((s) => s.audit)
  const verifyAudit = useStore((s) => s.verifyAudit)

  const [kindFilter, setKindFilter] = useState<'all' | AuditEntry['kind']>('all')
  const [verifyState, setVerifyState] = useState<'idle' | 'checking' | { ok: boolean; brokenAt: number | null }>('idle')

  // Newest-first, filtered.
  const rows = useMemo(
    () => [...audit].reverse().filter((e) => kindFilter === 'all' || e.kind === kindFilter),
    [audit, kindFilter],
  )
  const resolvedIds = useMemo(
    () =>
      new Set(
        audit
          .filter((e) => e.kind === 'intervention_resolved')
          .map((e) => (e.meta as { interventionId?: string })?.interventionId)
          .filter(Boolean),
      ),
    [audit],
  )

  const open = interventions.filter((i) => i.status === 'logged').length
  const resolved = interventions.filter((i) => i.status === 'resolved').length

  const runVerify = async () => {
    setVerifyState('checking')
    setVerifyState(await verifyAudit())
  }

  const exportCsv = () => {
    const header = ['seq', 'timestamp', 'actor', 'player_id', 'player_handle', 'kind', 'action', 'prev_hash', 'hash']
    const lines = audit.map((e) =>
      [e.seq, e.timestamp, e.actor, e.playerId ?? '', e.playerHandle ?? '', e.kind, e.action.replace(/"/g, '""'), e.prevHash, e.hash]
        .map((v) => `"${String(v)}"`)
        .join(','),
    )
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${BRAND.slug}-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        title="Compliance & audit trail"
        subtitle="A hash-chained record of interventions and staff observations, exportable for regulatory review."
        actions={
          <button onClick={exportCsv} className="btn btn-primary" disabled={audit.length === 0}>
            <Download size={15} /> Export chain
          </button>
        }
      />

      <div className="kpi-strip mb-5">
        <KpiCard label="Audit entries" value={audit.length} sub="Hash-chained events" />
        <KpiCard label="Interventions" value={interventions.length} sub={`${open} open · ${resolved} resolved`} />
        <KpiCard label="Observations" value={audit.filter((e) => e.kind === 'interaction').length} sub="Staff signal folded into scores" />
        <KpiCard
          label="Resolution rate"
          value={`${interventions.length > 0 ? Math.round((resolved / interventions.length) * 100) : 0}%`}
          sub="Resolved / logged"
        />
      </div>

      <div className="card-flush">
        <div className="flex flex-wrap items-center gap-3 px-6 py-5 border-b">
          <div>
            <h2 className="section-title">Tamper-evident audit trail</h2>
            <p className="text-[12px] text-faint mt-0.5">
              Each entry stores <code>hash = SHA-256(prevHash + entry)</code>; altering any row breaks every link after it.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {verifyState !== 'idle' && verifyState !== 'checking' && (
              <span
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-2.5 py-1"
                style={
                  verifyState.ok
                    ? { background: 'rgba(52,199,89,0.16)', color: '#4f8a5f' }
                    : { background: 'rgba(255,59,48,0.16)', color: '#d1432b' }
                }
              >
                {verifyState.ok ? <Check size={13} /> : <X size={13} />}
                {verifyState.ok ? `Chain intact · ${audit.length} entries` : `Tampering at entry ${verifyState.brokenAt}`}
              </span>
            )}
            <button onClick={runVerify} className="btn btn-ghost !py-1.5 text-[13px]" disabled={audit.length === 0 || verifyState === 'checking'}>
              <ShieldCheck size={14} /> {verifyState === 'checking' ? 'Verifying…' : 'Verify integrity'}
            </button>
            <div className="segmented">
              {(['all', 'intervention', 'interaction'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setKindFilter(s)}
                  className={`segmented-btn capitalize ${kindFilter === s ? 'segmented-btn-active' : ''}`}
                >
                  {s === 'all' ? 'All' : s === 'intervention' ? 'Interventions' : 'Observations'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {audit.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <ShieldCheck size={32} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
            <p className="text-sm text-soft">The audit chain is empty.</p>
            <p className="text-xs text-faint mt-1">
              Interventions and staff observations you log from a{' '}
              <Link to="/players" className="font-semibold" style={{ color: 'var(--brand)' }}>
                player profile
              </Link>{' '}
              are hash-chained here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: 'var(--text-faint)' }}>
                  <th className="px-5 py-3 font-semibold">#</th>
                  <th className="px-3 py-3 font-semibold">Timestamp</th>
                  <th className="px-3 py-3 font-semibold">Player</th>
                  <th className="px-3 py-3 font-semibold">Event</th>
                  <th className="px-3 py-3 font-semibold">Actor</th>
                  <th className="px-3 py-3 font-semibold">Hash</th>
                  <th className="px-5 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((e) => {
                  const meta = KIND_META[e.kind]
                  const iv = e.kind === 'intervention' ? (e.meta as InterventionAction) : null
                  const isOpen = iv ? !resolvedIds.has(iv.id) && iv.status !== 'resolved' : false
                  return (
                    <tr key={e.hash} className="hover:bg-[var(--surface-2)] transition-colors align-top">
                      <td className="px-5 py-3 text-xs text-faint tabular-nums">{e.seq}</td>
                      <td className="px-3 py-3 text-xs text-faint whitespace-nowrap">{dateTime(e.timestamp)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {e.playerId ? (
                          <Link to={`/players/${e.playerId}`} className="font-semibold hover:underline">
                            {e.playerHandle ?? e.playerId}
                          </Link>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: meta.bg, color: meta.color }}>
                          {e.kind === 'intervention_resolved' ? <Check size={11} /> : e.kind === 'intervention' ? <ShieldAlert size={11} /> : null}
                          {meta.label}
                        </span>
                        <div className="text-[12px] text-soft mt-1 max-w-[320px]">{e.action}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-faint whitespace-nowrap">{e.actor}</td>
                      <td className="px-3 py-3">
                        <code className="text-[11px] text-faint" title={`hash ${e.hash}\nprev ${e.prevHash}`} style={{ fontFamily: 'var(--font-mono)' }}>
                          {e.hash.slice(0, 10)}…
                        </code>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isOpen && iv && (
                          <button onClick={() => resolveIntervention(iv.id)} className="btn btn-ghost !py-1 !px-2.5 text-xs">
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-5 card !p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="eyebrow">Scoring composition</span>
          <span className="text-[11px] font-semibold tabular-nums rounded-full px-2 py-0.5" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
            {RULESET_PROVENANCE.version} + observed-v1
          </span>
          <span className="text-[11px] text-faint tabular-nums">
            data ROC-AUC {RULESET_PROVENANCE.validation.rocAuc.toFixed(2)} · prevalence {(RULESET_PROVENANCE.validation.prevalence * 100).toFixed(1)}%
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-soft">
          The shipped score combines a <strong>validated data model</strong> (marker weights fitted to real prospective
          self-exclusion in a longitudinal research cohort, tuned for recall) with a <strong>heuristic staff-observation overlay</strong>{' '}
          (<code>observed-v1</code>) that is <em>not</em> statistically validated. The data-derived score is retained
          and switchable (top bar → Data-only). See{' '}
          <Link to="/governance" className="font-semibold" style={{ color: 'var(--brand)' }}>Governance</Link> for the full
          model card and overlay caveats.
        </p>
      </div>

      <p className="mt-4 text-xs text-faint">
        Records are stored locally in your browser (localStorage) for this demo and persist across reloads.
      </p>
    </div>
  )
}
