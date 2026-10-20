// REFERENCE ADAPTER — streaming data source for near-real-time triggers
// (spin-by-spin / live wager events). Sketches the `subscribe` half of the
// DataSource port: a websocket of canonical events the platform folds into the
// online feature store. Inert unless a url is configured.

import type { CanonicalEvent, CanonicalPlayer } from '../core/canonical'
import type { DataSource } from '../core/ports'
import type { TenantContext } from '../core/config'

export class StreamingDataSource implements DataSource {
  readonly id = 'stream'
  constructor(private readonly url?: string) {}

  // Batch bootstrap is delegated elsewhere; streaming sources hydrate from a
  // companion batch/REST source and then keep current via `subscribe`.
  load(): CanonicalPlayer[] {
    return []
  }

  subscribe(tenant: TenantContext, onEvents: (e: CanonicalEvent[]) => void): () => void {
    if (!this.url) return () => {}
    const ws = new WebSocket(`${this.url}?tenant=${encodeURIComponent(tenant.tenantId)}`)
    ws.onmessage = (msg) => {
      try {
        onEvents(JSON.parse(msg.data) as CanonicalEvent[])
      } catch {
        /* a real impl validates schemaVersion + dead-letters bad frames */
      }
    }
    return () => ws.close()
  }
}
