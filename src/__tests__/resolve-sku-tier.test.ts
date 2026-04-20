import { describe, it, expect } from 'vitest'
import { resolveSkuTier } from '@/lib/orderGrid'

describe('resolveSkuTier', () => {
  // uifix2-1-3: when no Kaylee rec is loaded, always return 4
  it('returns tier 4 when kayleeQty is undefined, qty = 0', () => {
    expect(resolveSkuTier(0, undefined, false)).toBe(4)
  })

  it('returns tier 4 when kayleeQty is undefined, qty > 0', () => {
    expect(resolveSkuTier(4, undefined, false)).toBe(4)
  })

  it('returns tier 4 when kayleeQty is undefined, large qty', () => {
    expect(resolveSkuTier(100, undefined, false)).toBe(4)
  })

  it('returns tier 4 when kayleeQty is undefined regardless of isImported', () => {
    expect(resolveSkuTier(4, undefined, true)).toBe(4)
    expect(resolveSkuTier(0, undefined, true)).toBe(4)
  })

  // Comparison tiers when kayleeQty is defined
  it('returns INCREASED (1) when qty > kayleeQty', () => {
    expect(resolveSkuTier(5, 3, false)).toBe(1)
  })

  it('returns KAYLEE (2) when qty === kayleeQty', () => {
    expect(resolveSkuTier(3, 3, false)).toBe(2)
  })

  it('returns DECREASED (3) when qty < kayleeQty', () => {
    expect(resolveSkuTier(1, 4, false)).toBe(3)
  })

  it('returns DECREASED (3) when qty is 0 and kayleeQty > 0', () => {
    expect(resolveSkuTier(0, 2, false)).toBe(3)
  })
})
