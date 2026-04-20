import { useCallback, useEffect, useState } from 'react'
import { fetchAirplanes } from '../services/airplanesApi'
import type { AirplaneDto } from '../services/flights.types'

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; airplanes: AirplaneDto[] }

export function useAirplanes() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    fetchAirplanes()
      .then((airplanes) => {
        if (cancelled) return
        setState({ kind: 'ok', airplanes })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Failed to load airplanes'
        setState({ kind: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  return { state, reload }
}
