/** Lightweight inline SVG sparkline for table rows (no chart lib overhead). */
export function Sparkline({
  data,
  color,
  width = 96,
  height = 28,
}: {
  data: number[]
  color: string
  width?: number
  height?: number
}) {
  if (data.length < 2) return <div style={{ width, height }} />
  const min = Math.min(...data)
  const max = Math.max(...data, min + 1)
  const pad = 2
  const stepX = (width - pad * 2) / (data.length - 1)
  const y = (v: number) =>
    height - pad - ((v - min) / (max - min)) * (height - pad * 2)
  const points = data.map((v, i) => `${pad + i * stepX},${y(v)}`).join(' ')
  const areaPoints = `${pad},${height} ${points} ${pad + (data.length - 1) * stepX},${height}`
  const gid = `spark-${color.replace(/[^a-z0-9]/gi, '')}`

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gid})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={pad + (data.length - 1) * stepX} cy={y(data[data.length - 1])} r={2.4} fill={color} />
    </svg>
  )
}
