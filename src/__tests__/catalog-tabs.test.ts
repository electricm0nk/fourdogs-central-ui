import { describe, it, expect } from 'vitest'
import { buildCatalogTabs } from '@/lib/catalogTabs'
import type { ChairSku } from '@/lib/chairSandboxMock'

function makeSku(overrides: Partial<ChairSku>): ChairSku {
  return {
    id: 'SKU-TEST',
    upc: '000000000000',
    name: 'Test Item',
    tab: 'core',
    category: '',
    manufacturer: '',
    animal: 'dog',
    pack: '1',
    priceCents: 100,
    velocity: 'slow',
    qoh: 0,
    reorderStatus: '',
    doNotReorder: false,
    ...overrides,
  }
}

describe('buildCatalogTabs', () => {
  // uifix2-1-1: empty SKU list → no tabs (loading state)
  it('returns empty array when skus is empty', () => {
    expect(buildCatalogTabs([])).toEqual([])
  })

  // uifix2-1-1: vendor tabs only present when classified SKUs exist
  it('excludes ruffwear tab when no ruffwear SKUs present', () => {
    const skus = [
      makeSku({ id: 'SKU-1', name: 'Dog Food', category: 'food', manufacturer: 'Acana' }),
      makeSku({ id: 'SKU-2', name: 'Dog Treat', category: 'treats', manufacturer: 'Stella' }),
    ]
    const tabs = buildCatalogTabs(skus)
    expect(tabs.map((t) => t.key)).not.toContain('ruffwear')
  })

  it('excludes tractor-supply tab when no tractor supply SKUs present', () => {
    const skus = [makeSku({ id: 'SKU-1', name: 'Dog Food', category: 'food', manufacturer: 'Acana' })]
    const tabs = buildCatalogTabs(skus)
    expect(tabs.map((t) => t.key)).not.toContain('tractor-supply')
  })

  it('includes ruffwear tab when ruffwear SKUs are present', () => {
    const skus = [
      makeSku({ id: 'SKU-1', name: 'Ruffwear Harness', manufacturer: 'Ruffwear', category: 'leashes' }),
    ]
    const tabs = buildCatalogTabs(skus)
    expect(tabs.map((t) => t.key)).toContain('ruffwear')
  })

  it('includes tractor-supply tab when tractor supply SKUs are present', () => {
    const skus = [
      makeSku({ id: 'SKU-1', name: 'Tractor Supply Feed', manufacturer: 'Tractor Supply', category: 'core' }),
    ]
    const tabs = buildCatalogTabs(skus)
    expect(tabs.map((t) => t.key)).toContain('tractor-supply')
  })

  it('tab ordering preserves STATIC_REST_TABS order for present tabs', () => {
    const skus = [
      makeSku({ id: 'SKU-1', name: 'Ruffwear Harness', manufacturer: 'Ruffwear', category: 'leashes' }),
      makeSku({ id: 'SKU-2', name: 'Dog Toy', category: 'toy plush', manufacturer: '' }),
    ]
    const keys = buildCatalogTabs(skus).map((t) => t.key)
    const ruffIdx = keys.indexOf('ruffwear')
    const toysIdx = keys.indexOf('toys')
    // 'toys' comes before 'ruffwear' in STATIC_REST_TABS
    expect(toysIdx).toBeLessThan(ruffIdx)
  })

  it('always includes all, frozen, food, treats tabs for non-empty skus', () => {
    const skus = [makeSku({ id: 'SKU-1', name: 'Dog Food', category: 'food', manufacturer: 'Acana' })]
    const keys = buildCatalogTabs(skus).map((t) => t.key)
    expect(keys).toContain('all')
    expect(keys).toContain('frozen')
    expect(keys).toContain('food')
    expect(keys).toContain('treats')
  })
})
