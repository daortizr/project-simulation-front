import { useCallback, useEffect, useState } from 'react'
import { fetchFlightsPage } from '../services/flightsApi'
import type { FlightDto, FlightsPagination } from '../services/flights.types'

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; flights: FlightDto[]; pagination: FlightsPagination }

export function useFlightsPage(page: number, pageSize: number) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    fetchFlightsPage(page, pageSize)
      .then((payload) => {
        if (cancelled) return
        setState({
          kind: 'ok',
          flights: payload.flights,
          pagination: payload.pagination,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Failed to load flights'
        setState({ kind: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [page, pageSize, reloadToken])

  return { state, reload }
}
