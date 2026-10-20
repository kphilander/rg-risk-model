// Tamper-evident audit chain. The audit log IS the compliance evidence — a
// plain mutable table is "trust us"; a hash chain is verifiable. Each entry
// stores hash = SHA-256(prevHash + canonical(entry)), so altering or deleting
// any historical row breaks every subsequent link, detectable by replaying the
// chain. Adapted from an RG operator-tools audit module; hashing
// uses Web Crypto so it runs in the browser.

export const GENESIS_HASH = '0'.repeat(64)

export type AuditKind = 'intervention' | 'intervention_resolved' | 'interaction'

export interface AuditEntry {
  seq: number
  timestamp: string
  actor: string
  playerId: string | null
  playerHandle: string | null
  kind: AuditKind
  /** Human-readable one-line summary. */
  action: string
  /** The full payload (intervention / interaction record). */
  meta: unknown
  prevHash: string
  hash: string
}

/** A new entry before it is sequenced + hashed into the chain. */
export interface NewAuditEntry {
  timestamp: string
  actor: string
  playerId: string | null
  playerHandle: string | null
  kind: AuditKind
  action: string
  meta: unknown
}

/** Fields bound into the hash (order-independent, playerHandle excluded as it's
 *  derivable from playerId). */
function chainable(e: AuditEntry | (NewAuditEntry & { seq: number })) {
  return {
    seq: e.seq,
    timestamp: e.timestamp,
    actor: e.actor,
    playerId: e.playerId,
    kind: e.kind,
    action: e.action,
    meta: e.meta,
  }
}

/** Deterministic JSON — keys sorted recursively so structurally equal values
 *  always serialise (and hash) identically regardless of insertion order. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value))
}
function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = sortValue((v as Record<string, unknown>)[k])
    }
    return out
  }
  return v
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Append one entry, chaining onto the current tail. */
export async function appendEntry(chain: AuditEntry[], n: NewAuditEntry): Promise<AuditEntry> {
  const seq = chain.length
  const prevHash = chain[chain.length - 1]?.hash ?? GENESIS_HASH
  const body = { ...n, seq }
  const hash = await sha256Hex(prevHash + canonicalize(chainable(body)))
  return { ...body, prevHash, hash }
}

/** Build a full chain from scratch (used to seed synthetic history). */
export async function buildChain(entries: NewAuditEntry[]): Promise<AuditEntry[]> {
  const out: AuditEntry[] = []
  for (const n of entries) out.push(await appendEntry(out, n))
  return out
}

/** Replay the chain and report the first broken link (or that it's intact). */
export async function verifyChain(chain: AuditEntry[]): Promise<{ ok: boolean; brokenAt: number | null }> {
  let prevHash = GENESIS_HASH
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i]
    const expected = await sha256Hex(prevHash + canonicalize(chainable(e)))
    if (e.prevHash !== prevHash || e.hash !== expected) return { ok: false, brokenAt: i }
    prevHash = e.hash
  }
  return { ok: true, brokenAt: null }
}
