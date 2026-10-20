// REFERENCE ADAPTER — REST pull data source. Periodically/​on-demand fetches
// already-projected feature windows from an operator (or a platform-side
// ingestion service) over HTTP. Disabled unless a baseUrl is configured, so the
// demo never makes network calls. Implements the same DataSource port as the
// synthetic source, so it is a drop-in replacement at the composition root.

import type { CanonicalPlayer } from '../core/canonical'
import type { DataSource } from '../core/ports'
import type { TenantContext } from '../core/config'

export class RestDataSource implements DataSource {
  readonly id = 'rest'
  constructor(private readonly baseUrl?: string) {}

  async load(tenant: TenantContext): Promise<CanonicalPlayer[]> {
    if (!this.baseUrl) return []
    const res = await fetch(`${this.baseUrl}/v1/tenants/${tenant.tenantId}/portfolio`, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`portfolio fetch failed: ${res.status}`)
    // A real impl validates the payload against the canonical schema version.
    return (await res.json()) as CanonicalPlayer[]
  }
}
