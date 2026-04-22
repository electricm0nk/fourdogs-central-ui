import { describe, expect, it } from 'vitest'
import { buildVendorCatalogPath } from '@/hooks/use_vendor_catalog'

describe('buildVendorCatalogPath', () => {
  it('prefers vendor adapter scope when both vendor identifiers are present', () => {
    expect(buildVendorCatalogPath(42, 'sep-adapter')).toBe('/v1/items?vendor_adapter_id=sep-adapter')
  })

  it('falls back to vendor id when adapter id is absent', () => {
    expect(buildVendorCatalogPath(42, undefined)).toBe('/v1/items?vendor_id=42')
  })

  it('uses the unfiltered endpoint when neither identifier is present', () => {
    expect(buildVendorCatalogPath(undefined, undefined)).toBe('/v1/items')
  })
})