import { useMemo } from 'react'
import {
  fitRouteToViewport,
  greatCirclePoints,
  projectToBounds,
  type LatLon,
  type LonLatBounds,
} from '../lib/geo'

type Props = {
  origin: LatLon
  destination: LatLon
  originCode: string
  destinationCode: string
  /** Full simulated track from flight logs (same projection as map). */
  trailFull?: LatLon[]
  /** Number of points from the start of `trailFull` to draw in the highlight color (0 = none). */
  trailProgressCount?: number
  /** Current aircraft position from the active log row. */
  aircraft?: LatLon | null
}

const W = 1000
const H = 500

function niceStep(span: number, targetDivisions: number): number {
  if (span <= 0) return 1
  const t = span / targetDivisions
  const candidates = [0.5, 1, 2, 2.5, 5, 10, 15, 30, 45, 60, 90]
  return candidates.find((c) => c >= t) ?? 90
}

function pathFromLatLons(
  pts: LatLon[],
  bounds: LonLatBounds,
  width: number,
  height: number,
): string {
  if (pts.length === 0) return ''
  const projected = pts.map((p) => projectToBounds(p, bounds, width, height))
  return projected
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')
}

function graticuleForBounds(bounds: LonLatBounds, width: number, height: number) {
  const lonSpan = bounds.lonMax - bounds.lonMin
  const latSpan = bounds.latMax - bounds.latMin
  const lonStep = niceStep(lonSpan, 7)
  const latStep = niceStep(latSpan, 6)

  const meridians: string[] = []
  const lonStart = Math.ceil(bounds.lonMin / lonStep) * lonStep
  for (let lon = lonStart; lon <= bounds.lonMax + 1e-6; lon += lonStep) {
    const p0 = projectToBounds({ lat: bounds.latMin, lon }, bounds, width, height)
    const p1 = projectToBounds({ lat: bounds.latMax, lon }, bounds, width, height)
    meridians.push(`M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`)
  }

  const parallels: string[] = []
  const latStart = Math.ceil(bounds.latMin / latStep) * latStep
  for (let lat = latStart; lat <= bounds.latMax + 1e-6; lat += latStep) {
    const p0 = projectToBounds({ lat, lon: bounds.lonMin }, bounds, width, height)
    const p1 = projectToBounds({ lat, lon: bounds.lonMax }, bounds, width, height)
    parallels.push(`M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`)
  }

  return { meridians, parallels }
}

export function WorldRouteMap({
  origin,
  destination,
  originCode,
  destinationCode,
  trailFull,
  trailProgressCount = 0,
  aircraft,
}: Props) {
  const bounds = useMemo(
    () => fitRouteToViewport(origin, destination, W, H),
    [origin, destination],
  )

  const arcPath = useMemo(() => {
    const pts = greatCirclePoints(origin, destination, 80)
    return pathFromLatLons(pts, bounds, W, H)
  }, [origin, destination, bounds])

  const o = useMemo(() => projectToBounds(origin, bounds, W, H), [origin, bounds])
  const d = useMemo(() => projectToBounds(destination, bounds, W, H), [destination, bounds])

  const trailFullPath = useMemo(() => {
    if (!trailFull?.length) return ''
    return pathFromLatLons(trailFull, bounds, W, H)
  }, [trailFull, bounds])

  const trailProgressPath = useMemo(() => {
    if (!trailFull?.length || trailProgressCount <= 0) return ''
    const slice = trailFull.slice(0, Math.min(trailProgressCount, trailFull.length))
    return pathFromLatLons(slice, bounds, W, H)
  }, [trailFull, trailProgressCount, bounds])

  const aircraftPx = useMemo(() => {
    if (!aircraft) return null
    return projectToBounds(aircraft, bounds, W, H)
  }, [aircraft, bounds])

  const showSimTrail = Boolean(trailFull?.length)

  const graticuleLines = useMemo(
    () => graticuleForBounds(bounds, W, H),
    [bounds],
  )

  return (
    <svg
      className="world-route-map"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Great circle route from ${originCode} to ${destinationCode}`}
    >
      <defs>
        <linearGradient id="ocean" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0c1a2e" />
          <stop offset="55%" stopColor="#0f2744" />
          <stop offset="100%" stopColor="#081422" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width={W} height={H} fill="url(#ocean)" />
      <g className="graticule" opacity={0.14} stroke="#7eb8ff" strokeWidth={0.55} fill="none">
        {graticuleLines.meridians.map((pathD, i) => (
          <path key={`m-${i}`} d={pathD} />
        ))}
        {graticuleLines.parallels.map((pathD, i) => (
          <path key={`p-${i}`} d={pathD} />
        ))}
      </g>
      {showSimTrail && trailFullPath ? (
        <path
          d={trailFullPath}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.22}
        />
      ) : null}
      {showSimTrail && trailProgressPath ? (
        <path
          d={trailProgressPath}
          fill="none"
          stroke="#5eead4"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
          opacity={0.95}
        />
      ) : null}
      <path
        d={arcPath}
        fill="none"
        stroke="#5eead4"
        strokeWidth={2.2}
        strokeLinecap="round"
        filter="url(#glow)"
        opacity={showSimTrail ? 0.28 : 0.95}
      />
      <g className="airport" transform={`translate(${o.x}, ${o.y})`}>
        <circle r={6} fill="#0b1220" stroke="#fbbf24" strokeWidth={2} />
        <text x={10} y={4} fill="#e2e8f0" fontSize={14} fontFamily="inherit">
          {originCode}
        </text>
      </g>
      <g className="airport" transform={`translate(${d.x}, ${d.y})`}>
        <circle r={6} fill="#0b1220" stroke="#fbbf24" strokeWidth={2} />
        <text x={10} y={4} fill="#e2e8f0" fontSize={14} fontFamily="inherit">
          {destinationCode}
        </text>
      </g>
      {aircraftPx ? (
        <g className="aircraft-marker" transform={`translate(${aircraftPx.x}, ${aircraftPx.y})`}>
          <circle r={10} fill="#0f172a" stroke="#5eead4" strokeWidth={2.5} opacity={0.95} />
          <path
            d="M 0 -6 L 7 6 L 0 3 L -7 6 Z"
            fill="#38bdf8"
            stroke="#e0f2fe"
            strokeWidth={0.6}
          />
        </g>
      ) : null}
    </svg>
  )
}
