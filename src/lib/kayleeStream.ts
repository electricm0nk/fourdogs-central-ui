export function getDevSessionId(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem('dev_session_id')?.trim() ?? ''
}

export function buildKayleeStreamUrl(root: string, orderId: string, streamToken: string): string {
  const params = new URLSearchParams({
    msg: streamToken,
  })

  const sessionId = getDevSessionId()
  if (sessionId) {
    params.set('sid', sessionId)
  }

  return `${root}/v1/orders/${orderId}/kaylee/stream?${params.toString()}`
}