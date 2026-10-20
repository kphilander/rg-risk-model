// Audit + action sink implementations. The demo wires localStorage (audit) and
// a console/no-op action sink. Production swaps in a WORM/warehouse audit sink
// and a webhook/PAM action sink — same interfaces, no caller changes.

import type { InterventionAction } from '../types'
import type { ActionSink, AuditSink } from './ports'
import type { TenantContext } from './config'
import { BRAND } from '../brand'

// --- Audit -----------------------------------------------------------------

/** Browser-local append-only log (demo persistence). */
export class LocalStorageAuditSink implements AuditSink {
  constructor(private readonly key = `${BRAND.slug}.interventions.v1`) {}

  load(): InterventionAction[] {
    try {
      const raw = localStorage.getItem(this.key)
      return raw ? (JSON.parse(raw) as InterventionAction[]) : []
    } catch {
      return []
    }
  }

  private write(log: InterventionAction[]) {
    try {
      localStorage.setItem(this.key, JSON.stringify(log))
    } catch {
      /* ignore quota / private-mode errors */
    }
  }

  append(entry: InterventionAction) {
    this.write([entry, ...this.load()])
  }

  update(id: string, patch: Partial<InterventionAction>) {
    this.write(this.load().map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }
}

// --- Actions (write-back) --------------------------------------------------

/** Logs the write-back that *would* be sent to the operator (demo default). */
export class ConsoleActionSink implements ActionSink {
  readonly id = 'console'
  dispatch(action: InterventionAction, tenant: TenantContext) {
    // In production this becomes a webhook POST or a direct PAM API call.
    // eslint-disable-next-line no-console
    console.info(`[write-back → ${tenant.operatorName}] L${action.level} ${action.action} for ${action.playerHandle}`)
  }
}

/** Posts the action to an operator-supplied webhook (sketch — disabled unless
 *  a URL is configured, so the demo never makes network calls). */
export class WebhookActionSink implements ActionSink {
  readonly id = 'webhook'
  constructor(private readonly url?: string) {}
  async dispatch(action: InterventionAction, tenant: TenantContext) {
    if (!this.url) return
    try {
      await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.tenantId, action }),
      })
    } catch {
      /* a real impl would retry with backoff + dead-letter */
    }
  }
}

/** Fan an action out to several sinks. */
export class CompositeActionSink implements ActionSink {
  readonly id = 'composite'
  constructor(private readonly sinks: ActionSink[]) {}
  async dispatch(action: InterventionAction, tenant: TenantContext) {
    await Promise.all(this.sinks.map((s) => s.dispatch(action, tenant)))
  }
}
