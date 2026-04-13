import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ChairSku } from '@/lib/chairSandboxMock'

// Backend items use single-letter field names (see internal/db/models.go Item struct).
// Fields: i=id, u=upc, n=name, b=brand/manufacturer, q=qoh, p=price, sp=species, t=tab/type
type RawItem = Record<string, unknown>

function inferTab(raw: string): ChairSku['tab'] {
  const v = raw.toLowerCase()
  if (v.includes('frozen')) return 'frozen'
  if (v.includes('wellness')) return 'wellness'
  if (v.includes('supplement')) return 'supplements'
  if (v.includes('treat')) return 'treats'
  return 'core'
}

function inferAnimal(raw: string): 'dog' | 'cat' {
  const v = raw.toLowerCase()
  return v.includes('cat') || v.includes('feline') ? 'cat' : 'dog'
}

function normalizeItem(row: RawItem, idx: number): ChairSku {
  const id = typeof row.i === 'string' && row.i ? row.i : `ITEM-${idx + 1}`

  const rawUpc = row.u ?? ''
  const upcDigits =
    typeof rawUpc === 'string'
      ? rawUpc.replace(/\D/g, '')
      : typeof rawUpc === 'number'
        ? String(Math.trunc(rawUpc as number))
        : ''
  const upc = upcDigits.length >= 12
    ? upcDigits.slice(0, 12)
    : upcDigits.length > 0
      ? upcDigits.padStart(12, '0')
      : `88${String(idx + 1).padStart(10, '0')}`

  const name = typeof row.n === 'string' && row.n.trim() ? row.n.trim() : `Item ${idx + 1}`
  const manufacturer = typeof row.b === 'string' && row.b.trim() ? row.b.trim() : 'Unknown'

  // Price: p field — treat as dollars if ≤ 100, as cents if > 100
  const rawPrice = typeof row.p === 'number' ? row.p : 0
  const priceCents = rawPrice > 100 ? Math.round(rawPrice) : Math.round(rawPrice * 100)

  // QOH: q field
  const qoh = typeof row.q === 'number' ? Math.max(0, Math.round(row.q)) : 0

  // Species
  const sp = String(row.sp ?? '')
  const animal = inferAnimal(sp)

  // Tab from t field
  const tab = inferTab(String(row.t ?? ''))

  return {
    id,
    upc,
    name,
    tab,
    manufacturer,
    animal,
    pack: '1 ct', // not stored in items table; vendor_product_mapping has order_in_multiples
    priceCents: Math.max(priceCents, 0),
    velocity: 'medium', // TODO: derive from sales velocity data once available
    qoh,
  }
}

/**
 * Fetches the vendor catalog from GET /v1/items.
 * The backend returns items scoped to active brands (currently SE Pet).
 * Pass vendorAdapterId so the query is cache-keyed per vendor; backend will
 * support ?vendor_adapter_id= filtering once multiple distributors are imported.
 */
export function useVendorCatalog(vendorAdapterId?: string) {
  return useQuery({
    queryKey: ['vendor-catalog', vendorAdapterId ?? 'default'],
    queryFn: () => {
      const url = vendorAdapterId
        ? `/v1/items?vendor_adapter_id=${encodeURIComponent(vendorAdapterId)}`
        : '/v1/items'
      return api.get<unknown>(url)
    },
    select: (data) => {
      const rows: RawItem[] = Array.isArray(data)
        ? (data as RawItem[])
        : Array.isArray((data as Record<string, unknown>)?.data)
          ? ((data as Record<string, unknown>).data as RawItem[])
          : []
      return rows.map(normalizeItem)
    },
    staleTime: 5 * 60 * 1000, // cache catalog for 5 minutes
  })
}
