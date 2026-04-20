import axios from 'axios'

/**
 * - If `VITE_API_BASE_URL` is set: axios calls that origin (needs CORS if it differs from the site).
 * - If unset: same-origin `/api/...` — use Vite `server.proxy` / `preview.proxy` in dev, or your host’s reverse proxy in prod.
 */
const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
const baseURL = fromEnv ? fromEnv.replace(/\/$/, '') : ''

export const http = axios.create({
  baseURL,
  headers: { Accept: 'application/json' },
})
