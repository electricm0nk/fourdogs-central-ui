export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const devSessionId = typeof window !== 'undefined' ? window.localStorage.getItem('dev_session_id')?.trim() : ''

  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(devSessionId ? { 'x-dev-session-id': devSessionId } : {}),
      ...init?.headers,
    },
    ...init,
  })

  if (res.status === 401) throw new ApiError(401, 'Unauthorized')
  if (!res.ok) {
    let body: unknown
    try { body = await res.json() } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, res.statusText, body)
  }

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  postForm: <T>(path: string, body: FormData) =>
    apiFetch<T>(path, {
      method: 'POST',
      body,
      headers: {},  // Let browser set Content-Type with boundary
    }),
}
