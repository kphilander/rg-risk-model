// ---------------------------------------------------------------------------
// COMPOSITION ROOT
//
// The one place that picks concrete adapters for the ports. Everything else
// depends on interfaces only, so going from "synthetic demo" to "live operator"
// is a change here (driven by env vars), not a rewrite. e.g.:
//   VITE_DATA_SOURCE=rest  VITE_API_BASE_URL=…  VITE_JURISDICTION=UKGC
// ---------------------------------------------------------------------------

import { resolveRiskConfig, type RiskConfig, type TenantContext } from './config'
import { ruleBasedEngine } from './engine'
import {
  CompositeActionSink,
  ConsoleActionSink,
  LocalStorageAuditSink,
  WebhookActionSink,
} from './sinks'
import { SyntheticDataSource } from '../adapters/synthetic'
import { RestDataSource } from '../adapters/rest'
import { CsvBatchDataSource } from '../adapters/csvBatch'
import type { ActionSink, AuditSink, DataSource, ScoringEngine } from './ports'

const env = import.meta.env as unknown as Record<string, string | undefined>

const tenant: TenantContext = {
  tenantId: env.VITE_TENANT_ID ?? 'demo',
  operatorName: env.VITE_OPERATOR_NAME ?? 'Demo Operator',
  // 'MGA' resolves to the platform-default thresholds; switch to 'UKGC' / 'ON'
  // to see jurisdiction rule packs re-score the same portfolio.
  jurisdiction: env.VITE_JURISDICTION ?? 'MGA',
  currency: env.VITE_CURRENCY ?? 'EUR',
}

function selectDataSource(): DataSource {
  switch (env.VITE_DATA_SOURCE) {
    case 'csv':
      // End-to-end batch path: CSV → adapters → projection → feature windows.
      return new CsvBatchDataSource({ basePath: env.VITE_CSV_BASE_PATH ?? '/sample-data' })
    case 'rest':
      return new RestDataSource(env.VITE_API_BASE_URL)
    case 'synthetic':
    default:
      return new SyntheticDataSource()
  }
}

function selectActionSink(): ActionSink {
  const sinks: ActionSink[] = [new ConsoleActionSink()]
  if (env.VITE_WEBHOOK_URL) sinks.push(new WebhookActionSink(env.VITE_WEBHOOK_URL))
  return new CompositeActionSink(sinks)
}

export interface Platform {
  tenant: TenantContext
  config: RiskConfig
  dataSource: DataSource
  engine: ScoringEngine
  audit: AuditSink
  actions: ActionSink
}

export const platform: Platform = {
  tenant,
  config: resolveRiskConfig(tenant),
  dataSource: selectDataSource(),
  engine: ruleBasedEngine,
  audit: new LocalStorageAuditSink(),
  actions: selectActionSink(),
}
