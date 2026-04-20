import type { PlaybackFrame } from '../lib/flightLogPlayback'

type Props = {
  active: boolean
  frame: PlaybackFrame | null
  index: number
  total: number
  /** Full airport name from API (`description`), shown above the log metrics. */
  originAirportName?: string
  destinationAirportName?: string
}

function fmtCoord(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—'
  return n.toFixed(5)
}

function fmtAlt(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—'
  return `${Math.round(n)} ft`
}

function fmtKt(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—'
  return `${Number.isInteger(n) ? n : n.toFixed(1)} kt`
}

export function SimulationTelemetry({
  active,
  frame,
  index,
  total,
  originAirportName,
  destinationAirportName,
}: Props) {
  const lat = active && frame ? fmtCoord(frame.lat) : '—'
  const lon = active && frame ? fmtCoord(frame.lon) : '—'
  const alt = active && frame ? fmtAlt(frame.altitudeFt) : '—'
  const spd = active && frame ? fmtKt(frame.speedKt) : '—'
  const progress =
    active && total > 0 ? `Log ${index + 1} / ${total} · 1 entry / sec` : 'Run simulation to play the flight log'

  const showAirports = Boolean(originAirportName?.trim() || destinationAirportName?.trim())

  return (
    <div className="sim-telemetry" aria-live="polite">
      <p className="sim-telemetry-progress">{progress}</p>
      {showAirports ? (
        <div className="sim-telemetry-airports" aria-label="Route airports">
          <div className="sim-telemetry-airport">
            <span className="sim-telemetry-airport-label">Origin</span>
            <span className="sim-telemetry-airport-name">
              {originAirportName?.trim() || '—'}
            </span>
          </div>
          <span className="sim-telemetry-airport-arrow" aria-hidden>
            →
          </span>
          <div className="sim-telemetry-airport">
            <span className="sim-telemetry-airport-label">Destination</span>
            <span className="sim-telemetry-airport-name">
              {destinationAirportName?.trim() || '—'}
            </span>
          </div>
        </div>
      ) : null}
      <dl className="sim-telemetry-grid">
        <div className="sim-telemetry-item sim-telemetry-item--status">
          <dt>Status</dt>
          <dd>
            {active && frame?.statusLabel ? (
              <span className="status-pill">{frame.statusLabel}</span>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="sim-telemetry-item">
          <dt>Latitude</dt>
          <dd>{lat}</dd>
        </div>
        <div className="sim-telemetry-item">
          <dt>Longitude</dt>
          <dd>{lon}</dd>
        </div>
        <div className="sim-telemetry-item">
          <dt>Altitude</dt>
          <dd>{alt}</dd>
        </div>
        <div className="sim-telemetry-item">
          <dt>Speed</dt>
          <dd>{spd}</dd>
        </div>
      </dl>
    </div>
  )
}
