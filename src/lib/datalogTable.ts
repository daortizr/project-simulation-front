function cellString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Known API keys for flight log / telemetry arrays (camelCase + snake_case). */
export const FLIGHT_LOG_ARRAY_KEYS = [
  'flightLogs',
  'flightLog',
  'flight_logs',
  'flight_log',
  'dataLog',
  'dataLogs',
  'data_logs',
  'datalog',
  'flightDataLog',
  'flight_data_log',
  'logs',
  'logEntries',
  'log_entries',
  'telemetry',
  'readings',
] as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Rows suitable for a log table (skips nulls / non-objects at the start of the array). */
function asLogRows(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const rows = value.filter(isPlainObject)
  return rows.length > 0 ? rows : null
}

function skipIdFieldKey(key: string): boolean {
  const kl = key.toLowerCase()
  if (kl === 'id') return true
  if (kl.endsWith('_id')) return true
  if (key.endsWith('Id') && key !== 'Id') return true
  return false
}

/** `{ x, y }` from the API: **x = longitude**, **y = latitude** (same as `GeoPoint` / airports). */
function isGeoPoint(value: unknown): value is { x: number; y: number } {
  if (!isPlainObject(value)) return false
  const x = value.x
  const y = value.y
  return typeof x === 'number' && typeof y === 'number' && !Number.isNaN(x) && !Number.isNaN(y)
}

/**
 * Flatten log rows for display: no raw id columns, `{ description }` → text,
 * and `location` → `longitude` (= x) and `latitude` (= y).
 */
function expandLogRowForDisplay(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(row)) {
    if (skipIdFieldKey(key)) continue

    const kl = key.toLowerCase()
    if ((kl === 'location' || kl === 'position') && isGeoPoint(value)) {
      out.longitude = value.x
      out.latitude = value.y
      continue
    }

    if (isPlainObject(value)) {
      if (typeof value.description === 'string') {
        out[key] = value.description
        continue
      }
      const keys = Object.keys(value)
      if (keys.length === 1 && keys[0] === 'id') continue
    }

    out[key] = value
  }

  return out
}

function orderLogColumns(cols: string[]): string[] {
  const byLower = new Map(cols.map((c) => [c.toLowerCase(), c]))
  const ordered: string[] = []
  const take = (name: string) => {
    const c = byLower.get(name)
    if (c && !ordered.includes(c)) ordered.push(c)
  }

  take('latitude')
  take('lat')
  take('longitude')
  take('lon')
  take('lng')

  for (const alt of ['altitudeft', 'altitude_ft', 'altitude', 'alt_ft', 'altitudefeet']) {
    const c = byLower.get(alt)
    if (c && !ordered.includes(c)) {
      ordered.push(c)
      break
    }
  }

  const rest = cols.filter((c) => !ordered.includes(c)).sort((a, b) => a.localeCompare(b))
  return [...ordered, ...rest]
}

function tabulate(rows: Record<string, unknown>[]) {
  const expanded = rows.map(expandLogRowForDisplay)
  const colSet = new Set<string>()
  for (const row of expanded) {
    for (const k of Object.keys(row)) colSet.add(k)
  }
  const columns = orderLogColumns([...colSet])
  const normalized = expanded.map((row) =>
    Object.fromEntries(columns.map((c) => [c, cellString(row[c])])),
  ) as Record<string, string>[]
  return { columns, rows: normalized }
}

function scoreLogKey(key: string): number {
  const k = key.toLowerCase()
  if (k.includes('flight') && k.includes('log')) return 100
  if (k.includes('datalog') || k === 'datalog') return 95
  if (k.includes('log')) return 80
  if (k.includes('telemetry')) return 75
  if (k.includes('reading')) return 70
  if (k.includes('entry') || k.includes('history')) return 65
  return 5
}

/**
 * Walk nested objects (depth-limited) and pick the best array of plain objects for a log table.
 * Skips obvious flight-entity blobs so we do not treat `airplane` / airports as log sources.
 */
function deepFindLogRows(root: Record<string, unknown>): Record<string, unknown>[] | null {
  const skipSubtrees = new Set([
    'originAirport',
    'destinationAirport',
    'airplane',
    'flightStatus',
    'planeModel',
  ])

  type Cand = { score: number; len: number; rows: Record<string, unknown>[]; key: string }
  const found: Cand[] = []
  const seen = new WeakSet<object>()

  const visit = (obj: Record<string, unknown>, depth: number) => {
    if (depth > 10 || seen.has(obj)) return
    seen.add(obj)

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        const rows = asLogRows(value)
        if (rows) {
          found.push({
            score: scoreLogKey(key),
            len: rows.length,
            rows,
            key,
          })
        }
        continue
      }
      if (!isPlainObject(value)) continue
      if (skipSubtrees.has(key)) continue
      visit(value, depth + 1)
    }
  }

  visit(root, 0)
  if (found.length === 0) return null
  found.sort((a, b) => b.score - a.score || b.len - a.len)
  return found[0].rows
}

function tryKnownKeys(obj: Record<string, unknown>): Record<string, unknown>[] | null {
  for (const key of FLIGHT_LOG_ARRAY_KEYS) {
    const rows = asLogRows(obj[key])
    if (rows) return rows
  }
  return null
}

/**
 * Raw log row objects (same discovery rules as the datalog table).
 * Accepts an envelope `data` object or a bare array of log rows.
 */
export function extractFlightLogRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    const rows = asLogRows(raw)
    return rows ?? []
  }
  if (raw === null || typeof raw !== 'object') {
    return []
  }

  const obj = raw as Record<string, unknown>

  let rows = tryKnownKeys(obj)
  if (!rows) {
    const nested = obj.flight
    if (isPlainObject(nested)) {
      rows = tryKnownKeys(nested)
    }
  }
  if (!rows) {
    rows = deepFindLogRows(obj)
  }

  return rows ?? []
}

/** Log rows only (no field dump). Used when flight summary is shown separately. */
export function extractFlightLogTable(
  raw: unknown,
): { columns: string[]; rows: Record<string, string>[] } {
  const rows = extractFlightLogRows(raw)
  if (rows.length === 0) {
    return { columns: [], rows: [] }
  }
  return tabulate(rows)
}
