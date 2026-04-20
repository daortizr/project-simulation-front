function unwrapFlightRoot(raw: unknown): Record<string, unknown> | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.flight && typeof o.flight === 'object' && !Array.isArray(o.flight)) {
    return o.flight as Record<string, unknown>
  }
  if (o.originAirport && typeof o.originAirport === 'object') return o
  return o
}

function pickString(obj: unknown, ...path: string[]): string | undefined {
  let cur: unknown = obj
  for (const p of path) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

function pickNumber(obj: unknown, ...path: string[]): number | undefined {
  let cur: unknown = obj
  for (const p of path) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'number' && !Number.isNaN(cur) ? cur : undefined
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function airportCodeFromDescription(description: string | undefined): string | undefined {
  if (!description) return undefined
  const i = description.indexOf(' - ')
  return i > 0 ? description.slice(0, i) : undefined
}

export type SummaryLine = { label: string; value: string }

/**
 * Human-readable flight fields only (no UUIDs, raw coordinates, or nested JSON).
 */
export function buildFlightDetailSummary(raw: unknown): SummaryLine[] {
  const flight = unwrapFlightRoot(raw)
  if (!flight) return []

  const lines: SummaryLine[] = []

  const originDesc = pickString(flight, 'originAirport', 'description')
  const destDesc = pickString(flight, 'destinationAirport', 'description')
  if (originDesc || destDesc) {
    const route = [originDesc, destDesc].filter(Boolean).join(' → ')
    lines.push({ label: 'Route', value: route })
  }

  const status = pickString(flight, 'flightStatus', 'description')
  if (status) lines.push({ label: 'Status', value: status })

  const model = pickString(flight, 'airplane', 'planeModel', 'description')
  if (model) lines.push({ label: 'Aircraft type', value: model })

  const hours = pickNumber(flight, 'airplane', 'hours')
  if (hours !== undefined) {
    lines.push({ label: 'Aircraft hours', value: hours.toLocaleString() })
  }

  const maintained = pickString(flight, 'airplane', 'lastMaintenance')
  if (maintained) {
    lines.push({ label: 'Last maintenance', value: formatDateTime(maintained) })
  }

  const fuel = pickNumber(flight, 'airplane', 'planeModel', 'fuelCapacityKg')
  if (fuel !== undefined) {
    lines.push({ label: 'Fuel capacity', value: `${fuel.toLocaleString()} kg` })
  }

  if ('departureDate' in flight) {
    const v = flight.departureDate
    const display =
      v === null || v === undefined || v === ''
        ? '—'
        : formatDateTime(typeof v === 'string' ? v : String(v))
    lines.push({ label: 'Departure', value: display })
  }

  if ('estimatedArrivalDate' in flight) {
    const v = flight.estimatedArrivalDate
    const display =
      v === null || v === undefined || v === ''
        ? '—'
        : formatDateTime(typeof v === 'string' ? v : String(v))
    lines.push({ label: 'Estimated arrival', value: display })
  }

  const originCode = airportCodeFromDescription(originDesc)
  const destCode = airportCodeFromDescription(destDesc)
  const oAlt = pickNumber(flight, 'originAirport', 'altitudeFt')
  const dAlt = pickNumber(flight, 'destinationAirport', 'altitudeFt')
  if (oAlt !== undefined && originCode) {
    lines.push({ label: `${originCode} field elevation`, value: `${oAlt.toLocaleString()} ft` })
  }
  if (dAlt !== undefined && destCode) {
    lines.push({ label: `${destCode} field elevation`, value: `${dAlt.toLocaleString()} ft` })
  }

  return lines
}

export function humanizeLogColumn(key: string): string {
  const withSpaces = key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
}
