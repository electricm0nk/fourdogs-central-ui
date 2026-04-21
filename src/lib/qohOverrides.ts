const STORAGE_PREFIX = 'fd-qoh-overrides:'

export type QohOverrideMap = Record<string, number>

export function loadQohOverrides(orderId: string | undefined): QohOverrideMap {
  if (!orderId || typeof window === 'undefined') return {}

  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${orderId}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([skuId, value]) => [skuId, Number(value)] as [string, number])
        .filter(([, value]) => Number.isFinite(value) && value >= 0),
    )
  } catch {
    return {}
  }
}

export function saveQohOverrides(orderId: string | undefined, overrides: QohOverrideMap): void {
  if (!orderId || typeof window === 'undefined') return

  if (Object.keys(overrides).length === 0) {
    window.sessionStorage.removeItem(`${STORAGE_PREFIX}${orderId}`)
    return
  }

  window.sessionStorage.setItem(`${STORAGE_PREFIX}${orderId}`, JSON.stringify(overrides))
}
