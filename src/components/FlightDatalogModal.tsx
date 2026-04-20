import { useCallback, useEffect, useId, useState } from 'react'
import { extractFlightLogTable } from '../lib/datalogTable'
import { buildFlightDetailSummary, humanizeLogColumn, type SummaryLine } from '../lib/flightDetailView'
import { fetchFlightDetail } from '../services/flightsApi'

type Props = {
  flightId: string | null
  onClose: () => void
}

export function FlightDatalogModal({ flightId, onClose }: Props) {
  const titleId = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<SummaryLine[]>([])
  const [logColumns, setLogColumns] = useState<string[]>([])
  const [logRows, setLogRows] = useState<Record<string, string>[]>([])

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    setSummary([])
    setLogColumns([])
    setLogRows([])
    try {
      const payload = await fetchFlightDetail(id)
      setSummary(buildFlightDetailSummary(payload))
      const log = extractFlightLogTable(payload)
      setLogColumns(log.columns)
      setLogRows(log.rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load flight')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!flightId) return
    void load(flightId)
  }, [flightId, load])

  useEffect(() => {
    if (!flightId) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flightId, onClose])

  if (!flightId) return null

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal-dialog modal-dialog--flight"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-header">
          <h2 id={titleId} className="modal-title">
            Flight details
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal-body modal-body--flight">
          {loading ? (
            <p className="flight-panel-empty">Loading…</p>
          ) : error ? (
            <div className="flight-panel-error">
              <p>{error}</p>
              <button type="button" className="ghost-btn" onClick={() => void load(flightId)}>
                Retry
              </button>
            </div>
          ) : (
            <>
              <section className="modal-section" aria-labelledby="flight-overview-heading">
                <h3 id="flight-overview-heading" className="modal-section-title">
                  Overview
                </h3>
                {summary.length === 0 ? (
                  <p className="modal-section-empty">No flight information in this response.</p>
                ) : (
                  <dl className="flight-summary-grid">
                    {summary.map(({ label, value }, i) => (
                      <div key={`${label}-${i}`} className="flight-summary-row">
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>

              <section className="modal-section" aria-labelledby="flight-log-heading">
                <h3 id="flight-log-heading" className="modal-section-title">
                  Flight log
                </h3>
                {logRows.length === 0 ? (
                  <p className="modal-section-empty">No log entries for this flight.</p>
                ) : (
                  <div className="datalog-table-wrap">
                    <table className="datalog-table">
                      <thead>
                        <tr>
                          {logColumns.map((c) => (
                            <th key={c} scope="col">
                              {humanizeLogColumn(c)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {logRows.map((row, i) => (
                          <tr key={i}>
                            {logColumns.map((c) => (
                              <td key={c} className="datalog-cell">
                                {row[c] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
