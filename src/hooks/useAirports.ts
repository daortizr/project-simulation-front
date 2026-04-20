import { useCallback, useEffect, useState } from 'react'
import { fetchAirports } from '../services/airportsApi'
import type { AirportDto } from '../services/flights.types'

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; airports: AirportDto[] }

export function useAirports() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    fetchAirports()
      .then((airports) => {
        if (cancelled) return
        setState({ kind: 'ok', airports })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Failed to load airports'
        setState({ kind: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  return { state, reload }
}
