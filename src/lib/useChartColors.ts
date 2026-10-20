import { useStore } from '../store/useStore'

export interface ChartColors {
  grid: string
  axis: string
  brand: string
  brandFill: string
  tooltipBg: string
  tooltipBorder: string
  text: string
}

/** Theme-aware colors for Recharts so charts match light/dark surfaces. */
export function useChartColors(): ChartColors {
  const theme = useStore((s) => s.theme)
  const dark = theme === 'dark'
  return {
    grid: dark ? 'rgba(255,255,255,0.07)' : 'rgba(22,25,31,0.08)',
    axis: dark ? '#7f848b' : '#7a7e86',
    brand: dark ? '#4fb3a3' : '#0f6b60',
    brandFill: dark ? 'rgba(79,179,163,0.14)' : 'rgba(15,107,96,0.08)',
    tooltipBg: dark ? '#22262c' : '#fcfbf8',
    tooltipBorder: dark ? '#3d434a' : '#c9c5b8',
    text: dark ? '#ecebe6' : '#16191f',
  }
}
