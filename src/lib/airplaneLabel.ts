import type { AirplaneDto } from '../services/flights.types'

/** Label for selects (no ids): model description from API. */
export function airplaneOptionLabel(a: AirplaneDto): string {
  return a.planeModel?.description?.trim() || 'Airplane'
}
