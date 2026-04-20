import type { LatLon } from './geo'

export type PlaybackFrame = {
  lat: number
  lon: number
  altitudeFt: number | null
  /** Interpreted as knots (matches backend `airSpeed`). */
  speedKt: number | null
  /** From `flightStatus.description` when present. */
  statusLabel: string | null
}

function parseTimestampMs(row: Record<string, unknown>): number {
  const ts = row.eventTimestamp
  if (typeof ts !== 'string') return 0
  const ms = Date.parse(ts)
  return Number.isNaN(ms) ? 0 : ms
}

function parseLogRow(row: unknown): PlaybackFrame | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const pos = r.position
  if (!pos || typeof pos !== 'object') return null
  const p = pos as Record<string, unknown>
  const x = p.x
  const y = p.y
  if (typeof x !== 'number' || typeof y !== 'number') return null

  const alt = r.altitude
  const spd = r.airSpeed

  let statusLabel: string | null = null
  const fs = r.flightStatus
  if (fs && typeof fs === 'object') {
    const desc = (fs as Record<string, unknown>).description
    if (typeof desc === 'string' && desc.trim()) statusLabel = desc.trim()
  }

  return {
    lat: y,
    lon: x,
    altitudeFt: typeof alt === 'number' ? alt : null,
    speedKt: typeof spd === 'number' ? spd : null,
    statusLabel,
  }
}

/**
 * Turns API `flightLogs` into ordered playback frames (lon/lat from `position.x` / `.y`).
 */
export function normalizeFlightLogsForPlayback(logs: unknown): PlaybackFrame[] {
  if (!Array.isArray(logs)) return []

  const withTs = logs
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const r = row as Record<string, unknown>
      const frame = parseLogRow(row)
      if (!frame) return null
      return { frame, ts: parseTimestampMs(r) }
    })
    .filter((x): x is { frame: PlaybackFrame; ts: number } => x !== null)

  withTs.sort((a, b) => a.ts - b.ts || 0)
  return withTs.map((x) => x.frame)
}

export function playbackFramesToTrail(frames: PlaybackFrame[]): LatLon[] {
  return frames.map((f) => ({ lat: f.lat, lon: f.lon }))
}
