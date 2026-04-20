import { toRequestError } from './axiosError'
import { http } from './http'
import type { AirplaneDto } from './flights.types'

type AirplanesEnvelope = {
  status: number
  data: unknown
}

function normalizeAirplanesPayload(data: unknown): AirplaneDto[] {
  if (Array.isArray(data)) {
    return data as AirplaneDto[]
  }
  if (!data || typeof data !== 'object') {
    return []
  }
  const o = data as Record<string, unknown>
  if (Array.isArray(o.airplanes)) {
    return o.airplanes as AirplaneDto[]
  }
  if (Array.isArray(o.items)) {
    return o.items as AirplaneDto[]
  }
  return []
}

export async function fetchAirplanes(): Promise<AirplaneDto[]> {
  try {
    const { data } = await http.get<AirplanesEnvelope>('/api/airplanes')
    if (data.status !== 200) {
      throw new Error(`Unexpected API status: ${data.status}`)
    }
    const list = normalizeAirplanesPayload(data.data)
    return [...list].sort((a, b) => {
      const da = a.planeModel?.description ?? ''
      const db = b.planeModel?.description ?? ''
      const c = da.localeCompare(db)
      return c !== 0 ? c : a.id.localeCompare(b.id)
    })
  } catch (e) {
    throw toRequestError(e, 'Airplanes list')
  }
}
