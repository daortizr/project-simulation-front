/** WGS84 degrees → radians */
const toRad = (deg: number) => (deg * Math.PI) / 180

/** Radians → degrees */
const toDeg = (rad: number) => (rad * 180) / Math.PI

export type LatLon = { lat: number; lon: number }

/**
 * Sampled points along the great circle between two coordinates (degrees).
 */
export function greatCirclePoints(
  a: LatLon,
  b: LatLon,
  segments = 64,
): LatLon[] {
  const φ1 = toRad(a.lat)
  const λ1 = toRad(a.lon)
  const φ2 = toRad(b.lat)
  const λ2 = toRad(b.lon)

  const cosD =
    Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)
  const d = Math.acos(Math.min(1, Math.max(-1, cosD)))

  if (d < 1e-6) return [a]

  const out: LatLon[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const A = Math.sin((1 - t) * d) / Math.sin(d)
    const B = Math.sin(t * d) / Math.sin(d)
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2)
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2)
    const z = A * Math.sin(φ1) + B * Math.sin(φ2)
    const φ = Math.atan2(z, Math.hypot(x, y))
    const λ = Math.atan2(y, x)
    out.push({ lat: toDeg(φ), lon: toDeg(λ) })
  }
  return out
}

/** Equirectangular projection to SVG pixel space */
export function projectEquirectangular(
  { lat, lon }: LatLon,
  width: number,
  height: number,
): { x: number; y: number } {
  const x = ((lon + 180) / 360) * width
  const y = ((90 - lat) / 180) * height
  return { x, y }
}

/** Geographic window used to linearly map lon/lat into the SVG viewport. */
export type LonLatBounds = {
  lonMin: number
  lonMax: number
  latMin: number
  latMax: number
}

/**
 * Builds bounds that contain both endpoints with padding and the same aspect ratio
 * as the viewport (so both points stay in frame).
 */
export function fitRouteToViewport(
  a: LatLon,
  b: LatLon,
  viewWidth: number,
  viewHeight: number,
  marginRatio = 0.11,
): LonLatBounds {
  let lat0 = Math.min(a.lat, b.lat)
  let lat1 = Math.max(a.lat, b.lat)
  let lon0 = Math.min(a.lon, b.lon)
  let lon1 = Math.max(a.lon, b.lon)

  const minSpan = 0.35
  const dLat0 = Math.max(lat1 - lat0, minSpan)
  const dLon0 = Math.max(lon1 - lon0, minSpan)

  lat0 -= dLat0 * marginRatio
  lat1 += dLat0 * marginRatio
  lon0 -= dLon0 * marginRatio
  lon1 += dLon0 * marginRatio

  lat0 = Math.max(lat0, -85)
  lat1 = Math.min(lat1, 85)

  let latSpan = Math.max(lat1 - lat0, minSpan)
  let lonSpan = Math.max(lon1 - lon0, minSpan)
  const ar = viewWidth / viewHeight
  const geoAr = lonSpan / latSpan
  const midLat = (lat0 + lat1) / 2
  const midLon = (lon0 + lon1) / 2

  if (geoAr < ar) {
    lonSpan = latSpan * ar
    lon0 = midLon - lonSpan / 2
    lon1 = midLon + lonSpan / 2
  } else {
    latSpan = lonSpan / ar
    lat0 = midLat - latSpan / 2
    lat1 = midLat + latSpan / 2
    lat0 = Math.max(lat0, -85)
    lat1 = Math.min(lat1, 85)
  }

  return { lonMin: lon0, lonMax: lon1, latMin: lat0, latMax: lat1 }
}

/** Maps a coordinate into [0, viewWidth] × [0, viewHeight] using `bounds`. */
export function projectToBounds(
  { lat, lon }: LatLon,
  bounds: LonLatBounds,
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number } {
  const lonSpan = Math.max(bounds.lonMax - bounds.lonMin, 1e-9)
  const latSpan = Math.max(bounds.latMax - bounds.latMin, 1e-9)
  const x = ((lon - bounds.lonMin) / lonSpan) * viewWidth
  const y = ((bounds.latMax - lat) / latSpan) * viewHeight
  return { x, y }
}
