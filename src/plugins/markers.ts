// ---------------------------------------------------------------------------
// MARKER PLUGIN API — add a behavioral marker in one file.
//
//   import { defineMarker } from './plugins/markers'
//   defineMarker({
//     id: 'my-marker', label: 'My marker', domain: 'financial',
//     compute: (activity) => ({ score: 0-100, value: '…', explanation: '…' }),
//   })
//
// Plugin markers are kept OUT of the validated production score by default (the
// evidence-weighted 13). Use `computeExtendedMarkers` in sandboxes/experiments,
// or promote a plugin to production after re-validating weights. See EXTENDING.md.
// ---------------------------------------------------------------------------

import type { DailyActivity, MarkerResult } from '../types'
import { computeMarkers } from '../engine/markers'

export interface MarkerPlugin {
  id: string
  label: string
  domain?: 'financial' | 'temporal' | 'control'
  /** Aggregate weight when included in scoring (default 1). */
  weight?: number
  /** Pure function over a player's daily activity window. */
  compute: (activity: DailyActivity[]) => { score: number; value: string; explanation: string }
}

const registry: MarkerPlugin[] = []

/** Register a custom marker. Returns the plugin (chainable). */
export function defineMarker(plugin: MarkerPlugin): MarkerPlugin {
  if (registry.some((p) => p.id === plugin.id)) {
    throw new Error(`Marker plugin "${plugin.id}" is already registered`)
  }
  registry.push(plugin)
  return plugin
}

export function markerPlugins(): readonly MarkerPlugin[] {
  return registry
}

/** The validated 13 markers PLUS all registered plugins — for sandboxes/experiments. */
export function computeExtendedMarkers(
  activity: DailyActivity[],
  weights?: Record<string, number>,
): MarkerResult[] {
  const base = computeMarkers(activity, weights)
  const extra: MarkerResult[] = registry.map((p) => {
    const r = p.compute(activity)
    return {
      id: p.id,
      label: p.label,
      score: Math.max(0, Math.min(100, r.score)),
      value: r.value,
      explanation: r.explanation,
      weight: p.weight ?? weights?.[p.id] ?? 1,
    }
  })
  return [...base, ...extra]
}
