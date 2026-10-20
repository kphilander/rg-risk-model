// Plugin entry point. Import this once (e.g. in main.tsx) to register bundled
// example plugins, or import the API directly to register your own.

export { defineMarker, markerPlugins, computeExtendedMarkers } from './markers'
export type { MarkerPlugin } from './markers'

// Bundled examples (importing registers them):
import './examples/weekendConcentration'
