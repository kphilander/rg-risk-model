import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Upload, Download, Database, CheckCircle2, AlertTriangle, XCircle, ArrowRight, FileDown, Wand2, ChevronDown, ChevronRight, ShieldCheck, Trash2, FileText } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useStore } from '../store/useStore'
import { DATASETS, datasetById, type DatasetSchema } from '../core/dataSchema'
import {
  parseCsv,
  validateDataset,
  validateReferences,
  templateCsv,
  scoreDataset,
  pseudonymiseIds,
  type FileReport,
  type ParsedCsv,
  type ScoredDataset,
} from '../lib/dataImport'
import { BRAND } from '../brand'
import {
  suggestMapping,
  remap,
  coerceValue,
  mappingStatus,
  type ColumnMapping,
} from '../lib/columnMap'
import { RISK_BANDS } from '../lib/riskBands'

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const EMPTY: ParsedCsv = { header: [], rows: [] }

/** Per-file state kept in the component: their raw upload + the chosen mapping. */
interface FileState {
  raw: ParsedCsv
  mapping: ColumnMapping
  /** Which canonical columns were auto-detected (for the "auto" chip). */
  auto: Set<string>
  fileName: string
}

export function DataImport() {
  const navigate = useNavigate()
  const loadDataset = useStore((s) => s.loadDataset)
  const [files, setFiles] = useState<Partial<Record<string, FileState>>>({})
  const [scored, setScored] = useState<ScoredDataset | null>(null)
  const [scoring, setScoring] = useState(false)
  // Default ON: hash ids before they touch anything (harmless if already pseudonymous).
  const [pseudonymise, setPseudonymise] = useState(true)

  const handleFile = (id: string, file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const raw = parseCsv(String(reader.result))
      const schema = datasetById(id)!
      const mapping = suggestMapping(schema, raw.header)
      const auto = new Set(
        Object.entries(mapping)
          .filter(([, v]) => v !== null)
          .map(([k]) => k),
      )
      setFiles((s) => ({ ...s, [id]: { raw, mapping, auto, fileName: file.name } }))
      setScored(null)
    }
    reader.readAsText(file)
  }

  const changeMapping = (id: string, col: string, source: string) => {
    setFiles((s) => {
      const cur = s[id]
      if (!cur) return s
      const auto = new Set(cur.auto)
      auto.delete(col) // a manual edit clears the "auto" badge for that field
      return {
        ...s,
        [id]: { ...cur, mapping: { ...cur.mapping, [col]: source || null }, auto },
      }
    })
    setScored(null)
  }

  // Remap + validate each uploaded file whenever its mapping changes.
  const remapped = useMemo(() => {
    const out: Partial<Record<string, ParsedCsv>> = {}
    for (const d of DATASETS) {
      const fs = files[d.id]
      if (fs) out[d.id] = remap(d, fs.raw, fs.mapping)
    }
    return out
  }, [files])

  const reports = useMemo(() => {
    const out: Partial<Record<string, FileReport>> = {}
    for (const d of DATASETS) {
      const rm = remapped[d.id]
      if (rm) out[d.id] = validateDataset(d, rm)
    }
    return out
  }, [remapped])

  const refIssues = useMemo(() => {
    const ids = remapped.identities
    if (!ids) return []
    return validateReferences(
      ids,
      (['wagers', 'wallet', 'sessions'] as const)
        .filter((k) => remapped[k])
        .map((k) => ({ id: k, parsed: remapped[k]! })),
    )
  }, [remapped])

  const totalErrors = Object.values(reports).reduce((s, r) => s + (r?.errorCount ?? 0), 0)
  // Wagers alone is enough — the projection derives a roster from the events;
  // identities/wallet/sessions enrich the picture when available.
  const haveCore = !!reports.wagers?.ok
  const canScore = haveCore && totalErrors === 0

  const runScore = async () => {
    setScoring(true)
    try {
      let f = {
        identities: remapped.identities ?? EMPTY,
        wagers: remapped.wagers ?? EMPTY,
        wallet: remapped.wallet ?? EMPTY,
        sessions: remapped.sessions ?? EMPTY,
      }
      if (pseudonymise) f = await pseudonymiseIds(f)
      setScored(scoreDataset(f))
    } finally {
      setScoring(false)
    }
  }

  const clearLocal = () => {
    try {
      const doomed: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(`${BRAND.slug}.`)) doomed.push(k)
      }
      doomed.forEach((k) => localStorage.removeItem(k))
    } catch {
      /* ignore */
    }
    location.reload()
  }

  return (
    <div>
      <PageHeader
        title="Bring your own data"
        subtitle="Upload your export — a wagers file alone is enough. Columns are auto-mapped for you to confirm, and processing happens entirely in this tab: the app makes no network requests."
      />

      {/* Mapping — the primary surface */}
      <div className="reveal">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="eyebrow">Map your export · 4 files</div>
          <button
            className="btn btn-ghost !py-1.5 text-[13px]"
            onClick={() => DATASETS.forEach((d) => download(d.file, templateCsv(d.id)))}
          >
            <FileDown size={14} /> Download all templates
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Required wagers file first, then the optional enrichments. */}
          {[...DATASETS].sort((a, b) => Number(b.id === 'wagers') - Number(a.id === 'wagers')).map((d) => (
            <FileCard
              key={d.id}
              schema={d}
              state={files[d.id]}
              report={reports[d.id]}
              onFile={(f) => handleFile(d.id, f)}
              onChange={(col, src) => changeMapping(d.id, col, src)}
              onTemplate={() => download(d.file, templateCsv(d.id))}
            />
          ))}
        </div>
      </div>

      {/* Validation report — runs on the REMAPPED files */}
      {Object.keys(reports).length > 0 && (
        <div className="card mt-5 reveal">
          <h2 className="section-title">Validation</h2>
          <p className="section-sub">Row-level checks on your mapped data. Warnings are non-fatal.</p>
          <ValidationReport reports={reports} refIssues={refIssues} />
        </div>
      )}

      {/* Score + load */}
      <div className="card mt-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="section-title">Score your dataset</h2>
            <p className="section-sub">
              {canScore
                ? 'Columns mapped and rows validated — score them through the same engine the dashboard uses.'
                : 'A valid wagers file (any column names — map them above) is all that’s required. Identities, wallet & sessions are optional and enrich the picture.'}
            </p>
            <label className="mt-2 inline-flex items-center gap-2 text-[13px] text-soft cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pseudonymise}
                onChange={(e) => setPseudonymise(e.target.checked)}
                className="accent-[var(--accent,#0e8d7c)]"
              />
              <ShieldCheck size={14} style={{ color: 'var(--brand)' }} />
              Pseudonymise player IDs on load (SHA-256) — raw IDs never reach the dashboard. Harmless if your IDs are already pseudonymous.
            </label>
          </div>
          <button className="btn btn-primary shrink-0" disabled={!canScore || scoring} onClick={runScore}>
            <Database size={16} /> {scoring ? 'Scoring…' : 'Score dataset'}
          </button>
        </div>

        {scored && (
          <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--hairline)' }}>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <Stat label="Players scored" value={scored.stats.totalPlayers.toLocaleString()} />
              <Stat label="Mean risk index" value={`${scored.stats.averageScore}/100`} />
              <Stat label="High & critical" value={String(scored.stats.highRiskCount)} color="#d1432b" />
            </div>
            <div className="mt-4 flex h-2.5 w-full gap-1">
              {RISK_BANDS.map((b) => {
                const n = scored.stats.bandCounts[b.id] ?? 0
                const pct = scored.stats.totalPlayers ? (n / scored.stats.totalPlayers) * 100 : 0
                return <div key={b.id} className="rounded-full" style={{ width: `${pct}%`, background: b.color }} title={`${b.label}: ${n}`} />
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {RISK_BANDS.map((b) => (
                <span key={b.id} className="inline-flex items-center gap-1.5 text-[12px] text-faint">
                  <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                  {b.label} {scored.stats.bandCounts[b.id] ?? 0}
                </span>
              ))}
            </div>

            {scored.labels && scored.labels.size > 0 && (
              <div
                className="mt-5 flex items-start gap-3 rounded-lg px-4 py-3"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
              >
                <FileText size={17} className="mt-0.5 shrink-0" style={{ color: 'var(--accent, #0e8d7c)' }} />
                <p className="text-[13px] text-soft">
                  <strong className="font-semibold text-[color:var(--text)]">
                    {scored.labels.size.toLocaleString()} outcome label{scored.labels.size === 1 ? '' : 's'} detected
                  </strong>{' '}
                  from your <code className="text-[12px]">self_excluded</code> column — calibrate the model to your
                  population in <Link to="/model" className="font-semibold underline decoration-dotted underline-offset-2">Model studio</Link>.
                </p>
              </div>
            )}

            <button
              className="btn btn-primary mt-5"
              onClick={() => {
                loadDataset(scored.players, scored.assessments, scored.stats, scored.labels)
                navigate('/')
              }}
            >
              Load into dashboard <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-faint max-w-2xl">
          Parsing, mapping, validation and scoring all run locally in this tab — the app makes <strong>zero</strong> network
          requests (browser-enforced via its Content-Security-Policy; check DevTools → Network, or run it offline / from a
          downloaded file). Notes and interventions you log are stored only in this browser.
        </p>
        <button className="btn btn-ghost !py-1.5 text-[13px] shrink-0" onClick={clearLocal} title="Removes everything this app stored in this browser (notes, cases, audit chain, adopted model) and reloads.">
          <Trash2 size={14} /> Clear everything stored locally
        </button>
      </div>
    </div>
  )
}

/** One uploadable file: upload → map columns → inline validation, with the
 *  canonical format reference tucked behind a toggle. */
function FileCard({
  schema,
  state,
  report,
  onFile,
  onChange,
  onTemplate,
}: {
  schema: DatasetSchema
  state?: FileState
  report?: FileReport
  onFile: (f: File) => void
  onChange: (col: string, src: string) => void
  onTemplate: () => void
}) {
  const [showFormat, setShowFormat] = useState(false)
  const status = state ? mappingStatus(schema, state.mapping) : null

  return (
    <div className="card-flush lift">
      {/* Header + inline validation status */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold tracking-[-0.01em]">{schema.label}</h3>
            <code className="text-[11px] text-faint">{schema.file}</code>
            <span
              className="text-[10.5px] font-semibold rounded-full px-2 py-0.5"
              style={schema.id === 'wagers'
                ? { background: 'var(--brand-tint)', color: 'var(--brand)' }
                : { background: 'var(--surface-2)', color: 'var(--text-faint)' }}
            >
              {schema.id === 'wagers' ? 'Required' : 'Optional'}
            </span>
            {report && (report.ok
              ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#3f8a55' }}><CheckCircle2 size={13} />{report.parsedRows} rows</span>
              : <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#d1432b' }}><XCircle size={13} />{report.errorCount} error{report.errorCount === 1 ? '' : 's'}</span>)}
          </div>
          <p className="text-[12px] text-faint mt-0.5">
            {state ? <>From <code className="text-[11px]">{state.fileName}</code></> : schema.description}
          </p>
        </div>
      </div>

      {/* Mapping surface (once a file is uploaded) or the upload prompt */}
      {state ? (
        <MapColumns schema={schema} state={state} onChange={onChange} />
      ) : (
        <div className="px-5 py-6 text-center">
          <label className={`btn ${schema.id === 'wagers' ? 'btn-primary' : 'btn-ghost'} !py-1.5 text-[13px] cursor-pointer`}>
            <Upload size={14} /> Upload {schema.file}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = '' }}
            />
          </label>
          <p className="text-[11px] text-faint mt-2">Any column names — we auto-match them.</p>
        </div>
      )}

      {/* Mapping status line */}
      {status && (
        <div className="px-5 py-2 text-[12px]" style={{ borderTop: '1px solid var(--hairline)' }}>
          {status.ok ? (
            <span className="text-faint">
              {status.mapped}/{status.total} columns mapped
            </span>
          ) : (
            <span style={{ color: '#d1432b' }}>
              {status.mapped}/{status.total} mapped · missing: {status.missingRequired.join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Expected-format reference (secondary, collapsed) + actions */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3" style={{ borderTop: '1px solid var(--hairline)' }}>
        <button
          className="btn btn-ghost !py-1.5 text-[13px]"
          onClick={() => setShowFormat((v) => !v)}
        >
          {showFormat ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Show expected format
        </button>
        <button className="btn btn-ghost !py-1.5 text-[13px]" onClick={onTemplate}><Download size={14} /> Template</button>
        {state && (
          <label className="btn btn-ghost !py-1.5 text-[13px] cursor-pointer">
            <Upload size={14} /> Replace file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = '' }}
            />
          </label>
        )}
      </div>

      {showFormat && <FormatReference schema={schema} />}
    </div>
  )
}

/** The Map-columns table: one row per canonical column with a source-header
 *  select, a coerced sample preview, and an "auto" chip for detected fields. */
function MapColumns({
  schema,
  state,
  onChange,
}: {
  schema: DatasetSchema
  state: FileState
  onChange: (col: string, src: string) => void
}) {
  const firstRow = state.raw.rows[0]
  return (
    <div className="px-5 py-3 overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
            <th className="py-1.5 pr-3 font-semibold">Field</th>
            <th className="py-1.5 pr-3 font-semibold">Your column</th>
            <th className="py-1.5 font-semibold">Sample</th>
          </tr>
        </thead>
        <tbody>
          {schema.columns.map((c) => {
            const src = state.mapping[c.name] ?? ''
            const isAuto = state.auto.has(c.name)
            // Sample preview: first row's value AFTER coercion (e.g. "deposit → DEP").
            const rawVal = src && firstRow ? firstRow[src] ?? '' : ''
            const coerced = src ? coerceValue(c.name, rawVal) : ''
            const changed = src && coerced !== rawVal.trim()
            return (
              <tr key={c.name} style={{ borderColor: 'var(--hairline)' }} className="border-b last:border-0">
                <td className="py-1.5 pr-3 whitespace-nowrap align-top">
                  <span className="font-medium">{c.name}</span>
                  {c.required && <span className="ml-1 text-[10px] font-bold align-top" style={{ color: '#d1432b' }}>*</span>}
                  {isAuto && src && (
                    <span className="chip !px-1.5 !py-0.5 !text-[10px] ml-2 align-middle">
                      <Wand2 size={10} /> auto
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-3 align-top">
                  <select
                    className="input !py-1 !text-[12.5px]"
                    value={src}
                    onChange={(e) => onChange(c.name, e.target.value)}
                  >
                    <option value="">— not mapped —</option>
                    {state.raw.header.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 align-top text-faint tabular-nums">
                  {src ? (
                    changed ? (
                      <span className="whitespace-nowrap">
                        <span className="text-faint">{truncate(rawVal)}</span>
                        <ArrowRight size={11} className="inline mx-1 align-[-1px]" />
                        <span className="font-medium" style={{ color: 'var(--text)' }}>{truncate(coerced)}</span>
                      </span>
                    ) : (
                      <span>{truncate(coerced) || <span className="text-faint">—</span>}</span>
                    )
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Canonical column reference (the old FormatCard body) — kept as secondary. */
function FormatReference({ schema }: { schema: DatasetSchema }) {
  return (
    <div className="px-5 py-3 overflow-x-auto" style={{ borderTop: '1px solid var(--hairline)', background: 'var(--surface-2)' }}>
      <p className="text-[11px] text-faint mb-2">Canonical columns the engine expects. Map your headers onto these above.</p>
      <table className="w-full text-[12.5px]">
        <tbody>
          {schema.columns.map((c) => (
            <tr key={c.name} style={{ borderColor: 'var(--hairline)' }} className="border-b last:border-0">
              <td className="py-1.5 pr-3 font-medium whitespace-nowrap">
                {c.name}
                {c.required && <span className="ml-1 text-[10px] font-bold align-top" style={{ color: '#d1432b' }}>*</span>}
              </td>
              <td className="py-1.5 pr-3 text-faint whitespace-nowrap">{c.enumValues ? c.enumValues.join(' | ') : c.type}</td>
              <td className="py-1.5 text-faint tabular-nums whitespace-nowrap">{c.example}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function truncate(s: string, n = 22) {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

function ValidationReport({ reports, refIssues }: { reports: Partial<Record<string, FileReport>>; refIssues: FileReport['issues'] }) {
  const rows = DATASETS.flatMap((d) => {
    const r = reports[d.id]
    if (!r) return []
    return r.issues.map((i) => ({ file: d.file, ...i }))
  }).concat(refIssues.map((i) => ({ file: 'cross-file', ...i })))

  if (rows.length === 0) return <p className="mt-3 text-[13px] text-soft flex items-center gap-2"><CheckCircle2 size={15} style={{ color: '#3f8a55' }} /> All mapped files pass validation.</p>

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px]" style={{ color: 'var(--text-faint)' }}>
            <th className="py-2 pr-4 font-semibold">Severity</th>
            <th className="py-2 pr-4 font-semibold">File</th>
            <th className="py-2 pr-4 font-semibold">Row</th>
            <th className="py-2 pr-4 font-semibold">Column</th>
            <th className="py-2 font-semibold">Message</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--hairline)' }}>
          {rows.slice(0, 60).map((i, k) => (
            <tr key={k}>
              <td className="py-2 pr-4">
                {i.severity === 'error'
                  ? <span className="inline-flex items-center gap-1 font-semibold" style={{ color: '#d1432b' }}><XCircle size={13} /> Error</span>
                  : <span className="inline-flex items-center gap-1 font-semibold" style={{ color: '#c46a1c' }}><AlertTriangle size={13} /> Warn</span>}
              </td>
              <td className="py-2 pr-4 text-faint whitespace-nowrap"><code className="text-[12px]">{i.file}</code></td>
              <td className="py-2 pr-4 tabular-nums text-faint">{i.row ?? '—'}</td>
              <td className="py-2 pr-4 whitespace-nowrap"><code className="text-[12px]">{i.column ?? '—'}</code></td>
              <td className="py-2 text-soft">{i.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 60 && <p className="mt-2 text-[12px] text-faint">Showing first 60 of {rows.length} issues.</p>}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="text-[26px] font-bold tabular-nums mt-1" style={{ color: color ?? 'var(--text)', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}
