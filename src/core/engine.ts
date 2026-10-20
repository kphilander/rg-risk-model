// Rule-based scoring engine — the default ScoringEngine implementation.
// A production deployment can drop in a `RemoteScoringEngine` that calls a
// scoring microservice (or an ML model server) behind this same interface; the
// store and UI are unaffected.

import { assessPlayer, assessAll, portfolioStats } from '../engine/scoring'
import { DEFAULT_RISK_CONFIG } from './config'
import type { ScoringEngine } from './ports'

export const ruleBasedEngine: ScoringEngine = {
  rulesetVersion: DEFAULT_RISK_CONFIG.rulesetVersion,
  assess: (player, config) => assessPlayer(player, config),
  assessAll: (players, config) => assessAll(players, config),
  summarize: (players, assessments) => portfolioStats(players, assessments),
}
