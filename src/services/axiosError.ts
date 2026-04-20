import axios from 'axios'

export function toRequestError(err: unknown, hint: string): Error {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err : new Error(hint)
  }
  if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
    return new Error(
      `${hint}: could not reach the API (network). In dev, use the Vite \`/api\` proxy or fix CORS.`,
    )
  }
  const status = err.response?.status
  const detail =
    typeof err.response?.data === 'string'
      ? err.response.data
      : err.response?.data && typeof err.response.data === 'object'
        ? JSON.stringify(err.response.data)
        : ''
  return new Error(
    status
      ? `${hint} (${status})${detail ? `: ${detail.slice(0, 240)}` : ''}`
      : `${hint}: ${err.message}`,
  )
}
