import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ChairSku } from '@/lib/chairSandboxMock'

// Backend items use single-letter field names (see internal/db/models.go Item struct).
// Fields used here: i=id, u=upc, n=name, b=brand/manufacturer, q=qoh,
// c=order multiples, k=vendor cost, sp=species, t=tab/type
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

  // Vendor cost: k field — treat as dollars if ≤ 100, as cents if > 100
  const rawPrice = typeof row.k === 'number' ? row.k : 0
  const priceCents = rawPrice > 100 ? Math.round(rawPrice) : Math.round(rawPrice * 100)

  const rawMultiples = typeof row.c === 'number' ? Math.max(1, Math.round(row.c)) : 1

  // QOH: q field
  const qoh = typeof row.q === 'number' ? Math.max(0, Math.round(row.q)) : 0

  // Species
  const sp = String(row.sp ?? '')
  const animal = inferAnimal(sp)

  // Category + tab from t field
  const category = typeof row.t === 'string' ? row.t.trim() : String(row.t ?? '')
  const tab = inferTab(category)

  const reorderStatus =
    typeof row.r === 'string' ? row.r.trim() :
    typeof row.reorder_status === 'string' ? row.reorder_status.trim() :
    ''

  const doNotReorder = /do\s*not\s*reorder|do_not_reorder/i.test(reorderStatus)

  const dosDays = typeof row.dos_days === 'number' ? row.dos_days : null
  const riskScore = typeof row.risk_score === 'number' ? row.risk_score : null

  return {
    id,
    upc,
    name,
    tab,
    category,
    manufacturer,
    animal,
    pack: String(rawMultiples),
    priceCents: Math.max(priceCents, 0),
    velocity: row.vc === 'fast' ? 'fast' : row.vc === 'medium' ? 'medium' : 'slow',
    qoh,
    suggestedQty: typeof row.o === 'number' && row.o > 0 ? row.o : undefined,
    reorderStatus,
    doNotReorder,
    dosDays,
    riskScore,
  }
}

/**
 * Fetches the vendor catalog from GET /v1/items.
 * Supports filtering by vendor_id or vendor_adapter_id query parameters.
 * When vendorId is present, it takes precedence over vendorAdapterId.
 */
export function useVendorCatalog(vendorId?: number | null, vendorAdapterId?: string) {
  return useQuery({
    queryKey: ['vendor-catalog', vendorId ?? vendorAdapterId ?? 'default'],
    queryFn: () => {
      const url =  vendorId
        ? `/v1/items?vendor_id=${encodeURIComponent(vendorId.toString())}`
        : vendorAdapterId
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
