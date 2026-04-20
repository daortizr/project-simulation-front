import { toRequestError } from './axiosError'
import { http } from './http'
import type { AirportDto } from './flights.types'

type AirportsEnvelope = {
  status: number
  data: unknown
}

function normalizeAirportsPayload(data: unknown): AirportDto[] {
  if (Array.isArray(data)) {
    return data as AirportDto[]
  }
  if (!data || typeof data !== 'object') {
    return []
  }
  const o = data as Record<string, unknown>
  if (Array.isArray(o.airports)) {
    return o.airports as AirportDto[]
  }
  if (Array.isArray(o.items)) {
    return o.items as AirportDto[]
  }
  return []
}

export async function fetchAirports(): Promise<AirportDto[]> {
  try {
    const { data } = await http.get<AirportsEnvelope>('/api/airports')
    if (data.status !== 200) {
      throw new Error(`Unexpected API status: ${data.status}`)
    }
    const list = normalizeAirportsPayload(data.data)
    return [...list].sort((a, b) => a.description.localeCompare(b.description))
  } catch (e) {
    throw toRequestError(e, 'Airports list')
  }
}
