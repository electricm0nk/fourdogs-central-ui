export type AnimalFilter = 'all' | 'dog' | 'cat'

export type ProductTab =
  | 'all'
  | 'core'
  | 'treats'
  | 'supplements'
  | 'frozen'
  | 'wellness'

export interface ChairSku {
  id: string
  upc: string
  name: string
  tab: Exclude<ProductTab, 'all'>
  category: string
  manufacturer: string
  animal: 'dog' | 'cat'
  pack: string
  priceCents: number
  velocity: 'fast' | 'medium' | 'slow'
  qoh: number
  suggestedQty?: number
  reorderStatus?: string
  doNotReorder?: boolean
  dosDays?: number | null
  riskScore?: number | null
}

export interface SeededOrderLine {
  skuId: string
  quantity: number
}

const tabs: Array<Exclude<ProductTab, 'all'>> = [
  'core',
  'treats',
  'supplements',
  'frozen',
  'wellness',
]

const manufacturers = [
  'Acana',
  'Orijen',
  'Fromm',
  'Stella & Chewy',
  'Vital Essentials',
  'Weruva',
  'Farmina',
  'Primal',
  'Nulo',
  'Open Farm',
]

const packs = ['1 ct', '4 ct', '12 ct', '24 ct', '2 lb', '5 lb']

function hash(index: number): number {
  // Simple deterministic integer hash for repeatable mock data.
  let value = index * 2654435761
  value ^= value >>> 16
  value *= 2246822519
  value ^= value >>> 13
  value *= 3266489917
  value ^= value >>> 16
  return Math.abs(value)
}

export function makeChairSkus(total = 5_000): ChairSku[] {
  return Array.from({ length: total }, (_, idx) => {
    const index = idx + 1
    const h = hash(index)
    const tab = tabs[h % tabs.length]
    const manufacturer = manufacturers[(h >>> 3) % manufacturers.length]
    const animal = h % 7 === 0 ? 'cat' : h % 5 === 0 ? 'cat' : 'dog'
    const priceCents = 599 + (h % 4200)
    const velocity = h % 3 === 0 ? 'fast' : h % 3 === 1 ? 'medium' : 'slow'
    const pack = packs[h % packs.length]

    return {
      id: `SKU-${String(index).padStart(5, '0')}`,
      upc: `00${String(index).padStart(10, '0')}`,
      name: `${manufacturer} ${tab.toUpperCase()} ${animal.toUpperCase()} Formula ${String(index).padStart(4, '0')}`,
      tab,
      category: tab,
      manufacturer,
      animal,
      pack,
      priceCents,
      velocity,
      qoh: (h >>> 5) % 25,
      reorderStatus: 'SMART_ORDER',
      doNotReorder: false,
    }
  })
}

export function makeSeededOrderLines(total: number, skus: ChairSku[]): SeededOrderLine[] {
  const safeCount = Math.min(Math.max(total, 0), skus.length)
  return Array.from({ length: safeCount }, (_, idx) => {
    const sku = skus[idx]
    return {
      skuId: sku.id,
      quantity: (idx % 4) + 1,
    }
  })
}

/**
 * Build initial recommendations targeting 50% of the given budget.
 * Sort order: fast (HOT) first, then medium, then slow. Within each tier: alpha by name.
 * Suggested qty per velocity: fast=4, medium=2, slow=1.
 * Fills greedily — skips items that don't fit remaining budget and continues.
 */
export function makeRecommendedOrderLines(budgetCents: number, skus: ChairSku[]): SeededOrderLine[] {
  const targetCents = Math.floor(budgetCents * 0.5)
  if (targetCents <= 0) return []

  const velocityRank: Record<ChairSku['velocity'], number> = { fast: 0, medium: 1, slow: 2 }
  const suggestedQty = (v: ChairSku['velocity']): number => (v === 'fast' ? 4 : v === 'medium' ? 2 : 1)

  const sorted = [...skus].sort((a, b) => {
    const vd = velocityRank[a.velocity] - velocityRank[b.velocity]
    return vd !== 0 ? vd : a.name.localeCompare(b.name)
  })

  const lines: SeededOrderLine[] = []
  let spent = 0

  for (const sku of sorted) {
    if (spent >= targetCents) break
    const qty = suggestedQty(sku.velocity)
    const cost = sku.priceCents * qty
    if (spent + cost <= targetCents) {
      lines.push({ skuId: sku.id, quantity: qty })
      spent += cost
    }
    // Items that don't fit at their suggested qty are skipped — keeps suggestions clean
  }

  return lines
}
