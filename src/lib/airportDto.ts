import type { AirportDto } from '../services/flights.types'
import type { LatLon } from './geo'

export function airportDtoToLatLon(a: AirportDto): LatLon {
  return { lat: a.location.y, lon: a.location.x }
}

/** Short label for map chips (text before ` - ` in description, if present). */
export function shortAirportLabel(description: string): string {
  const i = description.indexOf(' - ')
  return i > 0 ? description.slice(0, i) : description
}
