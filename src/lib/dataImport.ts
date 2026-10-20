// Bring-your-own-data: parse + validate CSVs against the format contract
// (src/core/dataSchema.ts), generate templates, and score an uploaded dataset
// entirely client-side via the existing ingestion adapters + projection.

import type { PlayerProfile, RiskAssessment } from '../types'
import type { PortfolioStats } from '../engine/scoring'
import { assessAll, portfolioStats } from '../engine/scoring'
import { DATASETS, datasetById, type DatasetSchema } from '../core/dataSchema'
import { EventProjection } from '../core/projection'
import type { CanonicalEvent, IdentityRecord } from '../core/canonical'
import type { TenantContext } from '../core/config'
import {
  CsvSessionAdapter,
  CsvWagerAdapter,
  CsvWalletAdapter,
  identityFromRow,
  type RawIdentityRow,
  type RawSessionRow,
  type RawWagerRow,
  type RawWalletRow,
} from '../adapters/csv'

export interface ParsedCsv {
  header: string[]
  rows: Record<string, string>[]
}

/** Minimal RFC-4180-ish CSV parser (handles quoted fields + embedded commas). */
export function parseCsv(text: string): ParsedCsv {
  const lines: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  const src = text.replace(/\r\n?/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); lines.push(row); field = ''; row = [] }
    else field += ch
  }
  if (field.length || row.length) { row.push(field); lines.push(row) }
  const nonEmpty = lines.filter((r) => r.some((c) => c.trim() !== ''))
  if (nonEmpty.length === 0) return { header: [], rows: [] }
  const header = nonEmpty[0].map((h) => h.trim())
  const rows = nonEmpty.slice(1).map((cells) => {
    const o: Record<string, string> = {}
    header.forEach((h, i) => (o[h] = (cells[i] ?? '').trim()))
    return o
  })
  return { header, rows }
}

export interface ValidationIssue {
  row: number | null // 1-indexed data row (null = file-level)
  column: string | null
  message: string
  severity: 'error' | 'warning'
}

export interface FileReport {
  datasetId: DatasetSchema['id']
  file: string
  parsedRows: number
  issues: ValidationIssue[]
  errorCount: number
  warningCount: number
  ok: boolean
  sample: Record<string, string>[]
}

const isNum = (s: string) => s.trim() !== '' && !Number.isNaN(Number(s))
const isDate = (s: string) => s.trim() !== '' && !Number.isNaN(new Date(s).getTime())
const MAX_ISSUES = 200

/** Validate one parsed file against its schema. */
export function validateDataset(schema: DatasetSchema, parsed: ParsedCsv): FileReport {
  const issues: ValidationIssue[] = []
  const push = (i: ValidationIssue) => { if (issues.length < MAX_ISSUES) issues.push(i) }

  // Missing required columns (file-level).
  for (const col of schema.columns) {
    if (col.required && !parsed.header.includes(col.name)) {
      push({ row: null, column: col.name, message: `Missing required column "${col.name}".`, severity: 'error' })
    }
  }
  // Unknown columns → warning (ignored, not fatal).
  const known = new Set(schema.columns.map((c) => c.name))
  for (const h of parsed.header) {
    if (!known.has(h)) push({ row: null, column: h, message: `Unrecognised column "${h}" — it will be ignored.`, severity: 'warning' })
  }

  parsed.rows.forEach((r, idx) => {
    const rowNo = idx + 1
    for (const col of schema.columns) {
      const v = r[col.name] ?? ''
      if (v === '') {
        if (col.required) push({ row: rowNo, column: col.name, message: `"${col.name}" is required but empty.`, severity: 'error' })
        continue
      }
      if (col.type === 'number' && !isNum(v)) push({ row: rowNo, column: col.name, message: `"${col.name}" = "${v}" is not a number.`, severity: 'error' })
      else if (col.type === 'date' && !isDate(v)) push({ row: rowNo, column: col.name, message: `"${col.name}" = "${v}" is not a valid date (use YYYY-MM-DD).`, severity: 'error' })
      else if (col.type === 'enum' && col.enumValues && !col.enumValues.includes(v))
        push({ row: rowNo, column: col.name, message: `"${col.name}" = "${v}" — expected one of ${col.enumValues.join(', ')}.`, severity: 'error' })
    }
  })

  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  return {
    datasetId: schema.id,
    file: schema.file,
    parsedRows: parsed.rows.length,
    issues,
    errorCount,
    warningCount,
    ok: errorCount === 0 && parsed.rows.length > 0,
    sample: parsed.rows.slice(0, 5),
  }
}

/** Cross-file check: referenced player_ids must exist in identities. */
export function validateReferences(
  identities: ParsedCsv,
  others: { id: string; parsed: ParsedCsv }[],
): ValidationIssue[] {
  const known = new Set(identities.rows.map((r) => r.player_id))
  if (known.size === 0) return []
  const out: ValidationIssue[] = []
  for (const { id, parsed } of others) {
    const orphans = new Set<string>()
    for (const r of parsed.rows) if (r.player_id && !known.has(r.player_id)) orphans.add(r.player_id)
    if (orphans.size)
      out.push({ row: null, column: 'player_id', severity: 'warning', message: `${id}: ${orphans.size} player_id(s) not found in identities (rows kept, treated as unknown players).` })
  }
  return out
}

/** Header + one example row for a dataset — the downloadable template. */
export function templateCsv(datasetId: string): string {
  const s = datasetById(datasetId)
  if (!s) return ''
  const header = s.columns.map((c) => c.name).join(',')
  const example = s.columns.map((c) => c.example).join(',')
  return `${header}\n${example}\n`
}

/** Deterministically pseudonymise player ids across all files (SHA-256 →
 *  `P-` + 10 hex), entirely client-side. The same source id always maps to the
 *  same pseudonym, so re-imports and cross-file references stay consistent —
 *  and raw ids never reach the dashboard, reports, or local storage. */
export async function pseudonymiseIds<T extends Record<string, ParsedCsv>>(files: T): Promise<T> {
  const distinct = new Set<string>()
  for (const f of Object.values(files)) for (const r of f.rows) if (r.player_id) distinct.add(r.player_id)
  const enc = new TextEncoder()
  const map = new Map<string, string>()
  for (const id of distinct) {
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(id))
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
    map.set(id, `P-${hex.slice(0, 10)}`)
  }
  const out: Record<string, ParsedCsv> = {}
  for (const [k, f] of Object.entries(files)) {
    out[k] = {
      header: f.header,
      rows: f.rows.map((r) => (r.player_id ? { ...r, player_id: map.get(r.player_id)! } : r)),
    }
  }
  return out as T
}

export interface ScoredDataset {
  players: PlayerProfile[]
  assessments: Map<string, RiskAssessment>
  stats: PortfolioStats
  /** Outcome labels (player_id → 0|1) if the upload carried a self_excluded column. */
  labels?: Map<string, number>
}

const IMPORT_TENANT: TenantContext = {
  tenantId: 'import', operatorName: 'Imported', jurisdiction: 'MGA', currency: 'EUR',
}

/** Run parsed files through adapters → projection → engine, entirely in-browser. */
export function scoreDataset(files: {
  identities: ParsedCsv
  wagers: ParsedCsv
  wallet: ParsedCsv
  sessions: ParsedCsv
}): ScoredDataset {
  const wager = new CsvWagerAdapter()
  const wallet = new CsvWalletAdapter()
  const session = new CsvSessionAdapter()

  const events: CanonicalEvent[] = [
    ...files.wagers.rows.flatMap((r) => wager.toCanonical(r as unknown as RawWagerRow, IMPORT_TENANT)),
    ...files.wallet.rows.flatMap((r) => wallet.toCanonical(r as unknown as RawWalletRow, IMPORT_TENANT)),
    ...files.sessions.rows.flatMap((r) => session.toCanonical(r as unknown as RawSessionRow, IMPORT_TENANT)),
  ]
  const identities: IdentityRecord[] = files.identities.rows.map((r) => identityFromRow(r as unknown as RawIdentityRow))

  // Window ends at the latest activity date in the upload (fallback: today).
  const times = events.map((e) => new Date(e.ts).getTime()).filter((t) => !Number.isNaN(t))
  const asOf = times.length ? new Date(Math.max(...times)) : new Date()

  const players = new EventProjection({ identities, windowDays: 92, asOf }).project(events)
  const assessments = assessAll(players)
  const stats = portfolioStats(players, assessments)
  // Optional outcome labels for in-browser calibration (if identities carried them).
  const labels = new Map<string, number>()
  for (const r of files.identities.rows) {
    const v = (r.self_excluded ?? '').trim()
    if (v === '0' || v === '1') labels.set(r.player_id, Number(v))
  }
  return { players, assessments, stats, labels: labels.size ? labels : undefined }
}

export const IMPORT_DATASETS = DATASETS
