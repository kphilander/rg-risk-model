// Synthetic data source — the active default. Produces feature windows directly
// (it skips the events→window Projection real operators need). Doubles as the
// sandbox/test tenant for onboarding new operators without touching real PII.

import { generatePlayers } from '../data/generateData'
import type { CanonicalPlayer } from '../core/canonical'
import type { DataSource } from '../core/ports'

export class SyntheticDataSource implements DataSource {
  readonly id = 'synthetic'
  constructor(
    private readonly count = 250,
    private readonly seed = 'rg-risk-v1',
  ) {}

  load(): CanonicalPlayer[] {
    return generatePlayers(this.count, this.seed)
  }
}
