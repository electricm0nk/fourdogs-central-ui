import type { ChairSku } from '@/lib/chairSandboxMock'

export type BaseCatalogTabKey =
  | 'all'
  | 'food'
  | 'frozen'
  | 'wellness'
  | 'treats'
  | 'leashes'
  | 'beds-apparel'
  | 'toys'
  | 'ruffwear'
  | 'tractor-supply'
  | 'reedy-fork'
  | 'everything-else'

export type FoodBrandTabKey = `food-brand:${string}`
export type CatalogTabKey = BaseCatalogTabKey | FoodBrandTabKey

export const STATIC_REST_TABS: Array<{ key: BaseCatalogTabKey; label: string }> = [
  { key: 'wellness', label: 'Wellness' },
  { key: 'leashes', label: 'Leashes' },
  { key: 'beds-apparel', label: 'Beds & Apparel' },
  { key: 'toys', label: 'Toys' },
  { key: 'ruffwear', label: 'Ruffwear' },
  { key: 'tractor-supply', label: 'Tractor Supply' },
  { key: 'reedy-fork', label: 'Reedy Fork' },
  { key: 'everything-else', label: 'Everything Else' },
]

function norm(value: string): string {
  return value.toLowerCase().trim()
}

function hasAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle))
}

export function classifyCatalogTab(sku: ChairSku): CatalogTabKey {
  const brand = norm(sku.manufacturer || '')
  const category = norm(sku.category || '')
  const tab = norm(sku.tab || '')
  const name = norm(sku.name || '')
  const combined = `${category} ${name}`

  if (brand.includes('ruffwear')) return 'ruffwear'
  if (brand.includes('tractor supply')) return 'tractor-supply'
  if (brand.includes('reedy fork')) return 'reedy-fork'

  if (hasAny(combined, ['frozen', 'raw frozen'])) return 'frozen'
  if (hasAny(combined, ['treat', 'chew'])) return 'treats'
  if (hasAny(combined, ['toy', 'plush', 'fetch', 'ball'])) return 'toys'

  if (hasAny(combined, ['leash', 'collar', 'harness', 'lead'])) return 'leashes'

  if (hasAny(combined, ['bed', 'apparel', 'crate', 'kennel', 'jacket', 'sweater', 'coat', 'shirt'])) {
    return 'beds-apparel'
  }

  if (
    hasAny(combined, [
      'groom',
      'healthcare',
      'health care',
      'dental',
      'clean',
      'flea',
      'bowl',
      'vitamin',
      'supplement',
      'wellness',
    ])
  ) {
    return 'wellness'
  }

  if (tab === 'frozen') return 'frozen'
  if (tab === 'treats') return 'treats'
  if (tab === 'wellness' || tab === 'supplements') return 'wellness'
  if (tab === 'core' || hasAny(combined, ['food', 'kibble', 'dry', 'wet', 'canned', 'diet', 'recipe'])) return 'food'

  return 'everything-else'
}

function normalizeBrandKey(value: string): string {
  return value.trim().toLowerCase()
}

function titleCaseWords(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ')
}

export function makeFoodBrandTabKey(brand: string): FoodBrandTabKey {
  return `food-brand:${normalizeBrandKey(brand)}`
}

export function isFoodBrandTabKey(tab: CatalogTabKey): tab is FoodBrandTabKey {
  return tab.startsWith('food-brand:')
}

export function buildCatalogTabs(skus: ChairSku[]): Array<{ key: CatalogTabKey; label: string }> {
  const foodBrandCounts = new Map<string, number>()

  for (const sku of skus) {
    if (classifyCatalogTab(sku) !== 'food') continue
    const key = normalizeBrandKey(sku.manufacturer || '')
    if (!key) continue
    foodBrandCounts.set(key, (foodBrandCounts.get(key) ?? 0) + 1)
  }

  const foodBrandTabs = Array.from(foodBrandCounts.entries())
    .filter(([, count]) => count >= 10)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([brandKey]) => ({
      key: `food-brand:${brandKey}` as FoodBrandTabKey,
      label: titleCaseWords(brandKey),
    }))

  return [
    { key: 'all', label: 'All' },
    { key: 'frozen', label: 'Frozen' },
    { key: 'food', label: 'Food' },
    ...foodBrandTabs,
    { key: 'treats', label: 'Treats' },
    ...STATIC_REST_TABS,
  ]
}

export function matchesCatalogTab(sku: ChairSku, tab: CatalogTabKey): boolean {
  if (tab === 'all') return true
  if (isFoodBrandTabKey(tab)) {
    return classifyCatalogTab(sku) === 'food' && normalizeBrandKey(sku.manufacturer || '') === tab.replace('food-brand:', '')
  }
  return classifyCatalogTab(sku) === tab
}

export function getBrandOptionsForTab(skus: ChairSku[], tab: CatalogTabKey): string[] {
  return Array.from(
    new Set(
      skus
        .filter((sku) => classifyCatalogTab(sku) === tab)
        .map((sku) => (sku.manufacturer || '').trim())
        .filter((name) => name.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b))
}
