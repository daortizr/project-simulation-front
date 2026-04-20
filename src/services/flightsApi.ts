import type {
  CreateFlightRequest,
  CreateFlightResponseData,
  FlightsListEnvelope,
} from './flights.types'
import { toRequestError } from './axiosError'
import { http } from './http'

export type ApiEnvelope<T> = {
  status: number
  data: T
}

export async function fetchFlightsPage(page: number, pageSize: number) {
  try {
    const { data } = await http.get<FlightsListEnvelope>('/api/flights', {
      params: { page, pageSize },
    })
    if (data.status !== 200) {
      throw new Error(`Unexpected API status: ${data.status}`)
    }
    return data.data
  } catch (e) {
    throw toRequestError(e, 'Flights list')
  }
}

/** Full flight payload (shape depends on backend); datalog arrays are normalized in the UI. */
export async function createFlight(
  body: CreateFlightRequest,
): Promise<CreateFlightResponseData> {
  try {
    const { data } = await http.post<ApiEnvelope<CreateFlightResponseData>>(
      '/api/flights',
      body,
      { headers: { 'Content-Type': 'application/json' } },
    )
    if (data.status !== 201 && data.status !== 200) {
      throw new Error(`Unexpected API status: ${data.status}`)
    }
    return data.data
  } catch (e) {
    throw toRequestError(e, 'Create flight')
  }
}

export async function fetchFlightHistory(flightId: string): Promise<unknown> {
  try {
    const { data } = await http.get<ApiEnvelope<unknown>>(
      `/api/flights/${encodeURIComponent(flightId)}/history`,
    )
    if (data.status !== 200 && data.status !== 201) {
      throw new Error(`Unexpected API status: ${data.status}`)
    }
    return data.data
  } catch (e) {
    throw toRequestError(e, 'Flight history')
  }
}

export async function fetchFlightDetail(flightId: string): Promise<unknown> {
  try {
    const { data } = await http.get<ApiEnvelope<unknown>>(
      `/api/flights/${encodeURIComponent(flightId)}`,
    )
    if (data.status !== 200) {
      throw new Error(`Unexpected API status: ${data.status}`)
    }
    return data.data
  } catch (e) {
    throw toRequestError(e, 'Flight detail')
  }
}
