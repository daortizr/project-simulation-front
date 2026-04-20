import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlightDatalogModal } from './components/FlightDatalogModal'
import { SimulationTelemetry } from './components/SimulationTelemetry'
import { WorldRouteMap } from './components/WorldRouteMap'
import { useAirplanes } from './hooks/useAirplanes'
import { useAirports } from './hooks/useAirports'
import { useFlightsPage } from './hooks/useFlightsPage'
import { extractFlightLogRows } from './lib/datalogTable'
import type { LatLon } from './lib/geo'
import { createFlight, fetchFlightHistory } from './services/flightsApi'
import type { FlightDto } from './services/flights.types'
import { airplaneOptionLabel } from './lib/airplaneLabel'
import { airportDtoToLatLon, shortAirportLabel } from './lib/airportDto'
import type { PlaybackFrame } from './lib/flightLogPlayback'
import {
  normalizeFlightLogsForPlayback,
  playbackFramesToTrail,
} from './lib/flightLogPlayback'
import './App.css'

const FLIGHTS_PAGE_SIZE = 10

function App() {
  const { state: airportsState, reload: reloadAirports } = useAirports()
  const { state: airplanesState, reload: reloadAirplanes } = useAirplanes()
  const [startId, setStartId] = useState('')
  const [endId, setEndId] = useState('')
  const [airplaneId, setAirplaneId] = useState('')

  const [flightsPage, setFlightsPage] = useState(1)
  const [datalogFlightId, setDatalogFlightId] = useState<string | null>(null)
  const [simBusy, setSimBusy] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)
  const [playback, setPlayback] = useState<{
    flightId: string
    frames: PlaybackFrame[]
    routeOrigin?: LatLon
    routeDestination?: LatLon
    originCode?: string
    destinationCode?: string
    originAirportName?: string
    destinationAirportName?: string
  } | null>(null)
  const [playbackIndex, setPlaybackIndex] = useState(0)
  const [historyPlaybackBusyId, setHistoryPlaybackBusyId] = useState<string | null>(null)
  const [tablePlaybackError, setTablePlaybackError] = useState<string | null>(null)

  const { state: flightsState, reload } = useFlightsPage(flightsPage, FLIGHTS_PAGE_SIZE)

  /** Keep start/end valid vs loaded list (first load, reload, or removed ids). */
  useEffect(() => {
    if (airportsState.kind !== 'ok') return
    const list = airportsState.airports
    if (list.length === 0) return

    if (list.length < 2) {
      const only = list[0]?.id ?? ''
      if (startId !== only) setStartId(only)
      if (endId !== '') setEndId('')
      return
    }

    const startValid = startId && list.some((a) => a.id === startId)
    const endValid = endId && list.some((a) => a.id === endId)
    let s = startValid ? startId : list[0].id
    let e = endValid ? endId : list[1].id
    if (s === e) {
      const other = list.find((a) => a.id !== s)
      e = other?.id ?? list[1].id
    }

    if (s !== startId) setStartId(s)
    if (e !== endId) setEndId(e)
  }, [airportsState, startId, endId])

  useEffect(() => {
    if (airplanesState.kind !== 'ok') return
    const list = airplanesState.airplanes
    if (list.length === 0) {
      if (airplaneId !== '') setAirplaneId('')
      return
    }
    const valid = airplaneId && list.some((a) => a.id === airplaneId)
    const next = valid ? airplaneId : list[0].id
    if (next !== airplaneId) setAirplaneId(next)
  }, [airplanesState, airplaneId])

  useEffect(() => {
    setPlaybackIndex(0)
  }, [playback?.flightId])

  useEffect(() => {
    if (!playback?.frames.length) return undefined
    const len = playback.frames.length
    const id = window.setInterval(() => {
      setPlaybackIndex((i) => Math.min(i + 1, len - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [playback?.flightId, playback?.frames.length])

  const origin = useMemo(() => {
    if (airportsState.kind !== 'ok') return null
    return airportsState.airports.find((a) => a.id === startId) ?? null
  }, [airportsState, startId])

  const destination = useMemo(() => {
    if (airportsState.kind !== 'ok') return null
    return airportsState.airports.find((a) => a.id === endId) ?? null
  }, [airportsState, endId])

  const handleStartChange = (id: string) => {
    setStartId(id)
    if (id === endId && airportsState.kind === 'ok') {
      const fallback = airportsState.airports.find((a) => a.id !== id)
      if (fallback) setEndId(fallback.id)
    }
  }

  const handleEndChange = (id: string) => {
    setEndId(id)
    if (id === startId && airportsState.kind === 'ok') {
      const fallback = airportsState.airports.find((a) => a.id !== id)
      if (fallback) setStartId(fallback.id)
    }
  }

  const routeLabel =
    playback?.originCode && playback?.destinationCode
      ? `${playback.originCode} → ${playback.destinationCode}`
      : origin && destination
        ? `${shortAirportLabel(origin.description)} → ${shortAirportLabel(destination.description)}`
        : '—'

  const originGeo = origin ? airportDtoToLatLon(origin) : null
  const destGeo = destination ? airportDtoToLatLon(destination) : null

  const mapOriginGeo = playback?.routeOrigin ?? originGeo
  const mapDestGeo = playback?.routeDestination ?? destGeo
  const mapOriginCode =
    playback?.originCode ?? (origin ? shortAirportLabel(origin.description) : '')
  const mapDestCode =
    playback?.destinationCode ??
    (destination ? shortAirportLabel(destination.description) : '')
  const canShowRouteMap = Boolean(
    mapOriginGeo && mapDestGeo && mapOriginCode && mapDestCode,
  )

  const playbackTrail = useMemo(
    () => (playback?.frames.length ? playbackFramesToTrail(playback.frames) : undefined),
    [playback],
  )

  const playbackClampIndex = useMemo(() => {
    if (!playback?.frames.length) return 0
    return Math.min(playbackIndex, playback.frames.length - 1)
  }, [playback, playbackIndex])

  const playbackCurrentFrame = playback?.frames[playbackClampIndex] ?? null

  const canPrev =
    flightsState.kind === 'ok' && flightsState.pagination.page > 1
  const canNext =
    flightsState.kind === 'ok' &&
    flightsState.pagination.page < flightsState.pagination.totalPages

  const airportsReady = airportsState.kind === 'ok' && airportsState.airports.length >= 2
  const startOptions =
    airportsState.kind === 'ok'
      ? airportsState.airports.filter((a) => a.id !== endId)
      : []
  const endOptions =
    airportsState.kind === 'ok'
      ? airportsState.airports.filter((a) => a.id !== startId)
      : []

  const airplanesReady =
    airplanesState.kind === 'ok' && airplanesState.airplanes.length > 0

  const canRunSim =
    airportsReady &&
    airplanesReady &&
    !!startId &&
    !!endId &&
    startId !== endId &&
    !!airplaneId

  const handleRunSimulation = useCallback(async () => {
    if (!canRunSim) return
    setSimBusy(true)
    setSimError(null)
    setTablePlaybackError(null)
    setPlayback(null)
    try {
      const created = await createFlight({
        originAirportId: startId,
        destinationAirportId: endId,
        airplaneId,
      })
      const frames = normalizeFlightLogsForPlayback(created.flightLogs)
      if (frames.length) {
        setPlayback({
          flightId: created.id,
          frames,
          originAirportName: origin?.description,
          destinationAirportName: destination?.description,
        })
      } else {
        setPlayback(null)
      }
      setFlightsPage(1)
      reload()
    } catch (e) {
      setSimError(e instanceof Error ? e.message : 'Simulation failed')
    } finally {
      setSimBusy(false)
    }
  }, [canRunSim, startId, endId, airplaneId, reload, origin, destination])

  const handleStopSimulation = useCallback(() => {
    setPlayback(null)
    setPlaybackIndex(0)
    setTablePlaybackError(null)
  }, [])

  const canStopSim = Boolean(playback?.frames.length)

  const handlePlayFlightHistory = useCallback(async (f: FlightDto) => {
    setTablePlaybackError(null)
    setHistoryPlaybackBusyId(f.id)
    setPlayback(null)
    setPlaybackIndex(0)
    try {
      const data = await fetchFlightHistory(f.id)
      const rows = extractFlightLogRows(data)
      const frames = normalizeFlightLogsForPlayback(rows)
      if (!frames.length) {
        setTablePlaybackError('No history points to play back')
        return
      }
      setPlayback({
        flightId: f.id,
        frames,
        routeOrigin: airportDtoToLatLon(f.originAirport),
        routeDestination: airportDtoToLatLon(f.destinationAirport),
        originCode: shortAirportLabel(f.originAirport.description),
        destinationCode: shortAirportLabel(f.destinationAirport.description),
        originAirportName: f.originAirport.description,
        destinationAirportName: f.destinationAirport.description,
      })
    } catch (e) {
      setTablePlaybackError(e instanceof Error ? e.message : 'Failed to load flight history')
    } finally {
      setHistoryPlaybackBusyId(null)
    }
  }, [])

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <h1 className="brand-title">Project simulator</h1>
            <p className="brand-sub">Route view · flights from API</p>
          </div>
        </div>
        <div className="route-controls">
          {airportsState.kind === 'error' ? (
            <div className="route-inline-error">
              <span>{airportsState.message}</span>
              <button type="button" className="ghost-btn" onClick={reloadAirports}>
                Retry
              </button>
            </div>
          ) : null}
          {airplanesState.kind === 'error' ? (
            <div className="route-inline-error">
              <span>{airplanesState.message}</span>
              <button type="button" className="ghost-btn" onClick={reloadAirplanes}>
                Retry
              </button>
            </div>
          ) : null}
          <div className="point-field">
            <label htmlFor="start-point">Start</label>
            <select
              id="start-point"
              className="point-select point-select--airport"
              value={airportsReady ? startId : ''}
              disabled={!airportsReady}
              onChange={(e) => handleStartChange(e.target.value)}
            >
              {airportsState.kind === 'loading' ? (
                <option value="">Loading airports…</option>
              ) : airportsState.kind === 'ok' && airportsState.airports.length < 2 ? (
                <option value="">Need at least 2 airports</option>
              ) : (
                startOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.description}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="point-field">
            <label htmlFor="end-point">End</label>
            <select
              id="end-point"
              className="point-select point-select--airport"
              value={airportsReady ? endId : ''}
              disabled={!airportsReady}
              onChange={(e) => handleEndChange(e.target.value)}
            >
              {airportsState.kind === 'loading' ? (
                <option value="">Loading airports…</option>
              ) : airportsState.kind === 'ok' && airportsState.airports.length < 2 ? (
                <option value="">Need at least 2 airports</option>
              ) : (
                endOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.description}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="point-field">
            <label htmlFor="airplane-point">Airplane</label>
            <select
              id="airplane-point"
              className="point-select point-select--airplane"
              value={airplanesReady ? airplaneId : ''}
              disabled={!airplanesReady}
              onChange={(e) => setAirplaneId(e.target.value)}
            >
              {airplanesState.kind === 'loading' ? (
                <option value="">Loading airplanes…</option>
              ) : airplanesState.kind === 'ok' && airplanesState.airplanes.length === 0 ? (
                <option value="">No airplanes</option>
              ) : airplanesState.kind === 'ok' ? (
                airplanesState.airplanes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {airplaneOptionLabel(p)}
                  </option>
                ))
              ) : (
                <option value="">—</option>
              )}
            </select>
          </div>
          <div className="sim-controls" role="group" aria-label="Simulation playback">
            <button
              type="button"
              className="sim-icon-btn sim-icon-btn--play"
              disabled={!canRunSim || simBusy}
              aria-label={simBusy ? 'Starting simulation' : 'Run simulation'}
              aria-busy={simBusy}
              onClick={() => void handleRunSimulation()}
            >
              <svg className="sim-icon" viewBox="0 0 24 24" aria-hidden width={20} height={20}>
                <path fill="currentColor" d="M8 5v14l11-7z" />
              </svg>
            </button>
            <button
              type="button"
              className="sim-icon-btn sim-icon-btn--stop"
              disabled={!canStopSim}
              aria-label="Stop simulation"
              onClick={handleStopSimulation}
            >
              <svg className="sim-icon" viewBox="0 0 24 24" aria-hidden width={20} height={20}>
                <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
              </svg>
            </button>
          </div>
          {simError ? (
            <p className="route-inline-error sim-error" role="alert">
              {simError}
            </p>
          ) : null}
        </div>
      </header>

      <main className="map-stage">
        <section className="map-region" aria-label="Route map">
          <div className="map-frame">
            {canShowRouteMap && mapOriginGeo && mapDestGeo ? (
              <WorldRouteMap
                origin={mapOriginGeo}
                destination={mapDestGeo}
                originCode={mapOriginCode}
                destinationCode={mapDestCode}
                trailFull={playbackTrail}
                trailProgressCount={
                  playback?.frames.length ? playbackClampIndex + 1 : undefined
                }
                aircraft={
                  playbackCurrentFrame
                    ? { lat: playbackCurrentFrame.lat, lon: playbackCurrentFrame.lon }
                    : undefined
                }
              />
            ) : null}
          </div>
          {canShowRouteMap ? (
            <SimulationTelemetry
              active={Boolean(playback?.frames.length)}
              frame={playbackCurrentFrame}
              index={playbackClampIndex}
              total={playback?.frames.length ?? 0}
              originAirportName={
                playback?.originAirportName ?? origin?.description ?? undefined
              }
              destinationAirportName={
                playback?.destinationAirportName ?? destination?.description ?? undefined
              }
            />
          ) : null}
          <div className="map-hud">
            <span className="hud-chip">{routeLabel}</span>
            <span className="hud-meta">Great circle · coordinates from API</span>
          </div>
        </section>

        <section className="flight-panel" aria-label="Flights">
          <div className="flight-panel-head">
            <h2 className="flight-panel-title">Flights</h2>
            {flightsState.kind === 'ok' ? (
              <p className="flight-panel-meta">
                Page {flightsState.pagination.page} of {flightsState.pagination.totalPages}{' '}
                · {flightsState.pagination.total} total
              </p>
            ) : null}
          </div>
          {tablePlaybackError ? (
            <p className="flight-panel-inline-error" role="alert">
              {tablePlaybackError}
            </p>
          ) : null}

          <div className="flight-table-scroll">
            {flightsState.kind === 'loading' ? (
              <p className="flight-panel-empty">Loading flights…</p>
            ) : flightsState.kind === 'error' ? (
              <div className="flight-panel-error">
                <p>{flightsState.message}</p>
                <button type="button" className="ghost-btn" onClick={reload}>
                  Retry
                </button>
              </div>
            ) : flightsState.flights.length === 0 ? (
              <p className="flight-panel-empty">No flights on this page.</p>
            ) : (
              <table className="flight-table">
                <thead>
                  <tr>
                    <th scope="col">Flight ID</th>
                    <th scope="col">Route</th>
                    <th scope="col">Status</th>
                    <th scope="col">Aircraft</th>
                    <th scope="col" className="flight-table-play-col">
                      <span className="sr-only">Play history</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {flightsState.flights.map((f) => (
                    <tr key={f.id}>
                      <td className="cell-mono">
                        <button
                          type="button"
                          className="flight-id-btn"
                          title="View data log"
                          aria-label={`View data log for flight ${f.id}`}
                          onClick={() => setDatalogFlightId(f.id)}
                        >
                          {f.id}
                        </button>
                      </td>
                      <td>
                        {shortAirportLabel(f.originAirport.description)} →{' '}
                        {shortAirportLabel(f.destinationAirport.description)}
                      </td>
                      <td>
                        <span className="status-pill">{f.flightStatus.description}</span>
                      </td>
                      <td>{f.airplane.planeModel.description}</td>
                      <td className="flight-table-play-cell">
                        <button
                          type="button"
                          className="flight-table-play-btn"
                          disabled={historyPlaybackBusyId !== null}
                          aria-label={`Play flight history for ${f.id}`}
                          title="Play flight history"
                          onClick={() => void handlePlayFlightHistory(f)}
                        >
                          {historyPlaybackBusyId === f.id ? (
                            <span className="flight-table-play-spinner" aria-hidden />
                          ) : (
                            <svg viewBox="0 0 24 24" aria-hidden width={18} height={18}>
                              <path fill="currentColor" d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {flightsState.kind === 'ok' && flightsState.pagination.totalPages > 1 ? (
            <div className="flight-panel-footer">
              <button
                type="button"
                className="ghost-btn"
                disabled={!canPrev}
                onClick={() => setFlightsPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={!canNext}
                onClick={() =>
                  setFlightsPage((p) =>
                    Math.min(flightsState.pagination.totalPages, p + 1),
                  )
                }
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      </main>

      <FlightDatalogModal
        flightId={datalogFlightId}
        onClose={() => setDatalogFlightId(null)}
      />
    </div>
  )
}

export default App
