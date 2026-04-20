/** Backend geo point: `x` = longitude (°), `y` = latitude (°). */
export type GeoPoint = { x: number; y: number }

export type AirportDto = {
  id: string
  description: string
  location: GeoPoint
  altitudeFt: number
}

export type FlightStatusDto = {
  id: string
  description: string
}

export type PlaneModelDto = {
  id: string
  description: string
  fuelCapacityKg: number
}

export type AirplaneDto = {
  id: string
  hours: number
  lastMaintenance: string
  planeModel: PlaneModelDto
}

export type FlightDto = {
  id: string
  departureDate: string | null
  estimatedArrivalDate: string | null
  originAirport: AirportDto
  destinationAirport: AirportDto
  flightStatus: FlightStatusDto
  airplane: AirplaneDto
}

export type FlightsPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type FlightsListEnvelope = {
  status: number
  data: {
    flights: FlightDto[]
    pagination: FlightsPagination
  }
}

export type CreateFlightRequest = {
  originAirportId: string
  destinationAirportId: string
  airplaneId: string
}

/** Payload returned when creating a flight (includes generated logs). */
export type CreateFlightResponseData = {
  id: string
  flightLogs?: unknown[]
}
