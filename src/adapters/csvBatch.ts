// Batch CSV / SFTP data source — the lowest-common-denominator operator feed,
// wired end-to-end:  CSV rows → IngestionAdapters → CanonicalEvents → Projection
// → CanonicalPlayer[]. Implements the same DataSource port as the synthetic
// source, so the rest of the app is unchanged. Reads its files from a static
// path (the demo ships a generated sample export under public/sample-data/).

import type { CanonicalEvent, CanonicalPlayer, IdentityRecord } from '../core/canonical'
import type { DataSource } from '../core/ports'
import type { TenantContext } from '../core/config'
import { EventProjection } from '../core/projection'
import {
  CsvSessionAdapter,
  CsvWagerAdapter,
  CsvWalletAdapter,
  identityFromRow,
  type RawIdentityRow,
  type RawSessionRow,
  type RawWagerRow,
  type RawWalletRow,
} from './csv'

/** Minimal CSV parser (clean, comma-free fields — a production build would use
 *  a streaming parser like papaparse and validate against the schema version). */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const cells = line.split(',')
    const row: Record<string, string> = {}
    header.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()))
    return row
  })
}

export interface CsvBatchOptions {
  basePath?: string
  windowDays?: number
  /** End of the scoring window; must match how the export was dated. */
  asOf?: Date
}

export class CsvBatchDataSource implements DataSource {
  readonly id = 'csv-batch'
  private readonly basePath: string
  private readonly windowDays: number
  private readonly asOf: Date
  private readonly wager = new CsvWagerAdapter()
  private readonly wallet = new CsvWalletAdapter()
  private readonly session = new CsvSessionAdapter()

  constructor(opts: CsvBatchOptions = {}) {
    this.basePath = opts.basePath ?? '/sample-data'
    this.windowDays = opts.windowDays ?? 92
    this.asOf = opts.asOf ?? new Date('2026-06-29T09:00:00Z')
  }

  private async fetchCsv(name: string): Promise<Record<string, string>[]> {
    const res = await fetch(`${this.basePath}/${name}`)
    if (!res.ok) throw new Error(`${name}: ${res.status}`)
    return parseCsv(await res.text())
  }

  async load(tenant: TenantContext): Promise<CanonicalPlayer[]> {
    const [identityRows, wagerRows, walletRows, sessionRows] = await Promise.all([
      this.fetchCsv('identities.csv'),
      this.fetchCsv('wagers.csv'),
      this.fetchCsv('wallet.csv'),
      this.fetchCsv('sessions.csv'),
    ])

    // 1. Map raw rows onto the canonical model (anti-corruption layer).
    const identities: IdentityRecord[] = identityRows.map((r) =>
      identityFromRow(r as unknown as RawIdentityRow),
    )
    const events: CanonicalEvent[] = [
      ...wagerRows.flatMap((r) => this.wager.toCanonical(r as unknown as RawWagerRow, tenant)),
      ...walletRows.flatMap((r) => this.wallet.toCanonical(r as unknown as RawWalletRow, tenant)),
      ...sessionRows.flatMap((r) => this.session.toCanonical(r as unknown as RawSessionRow, tenant)),
    ]

    // 2. Project events → per-player feature windows the engine scores.
    return new EventProjection({
      identities,
      windowDays: this.windowDays,
      asOf: this.asOf,
    }).project(events)
  }
}
