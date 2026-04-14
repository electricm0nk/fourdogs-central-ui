import type { ChairSku } from '@/lib/chairSandboxMock'

export interface KayleeConnectionResult {
  healthSummary: string
  skus: ChairSku[]
}

export interface KayleeConnectOptions {
  sessionId?: string
}

type JsonLike = Record<string, unknown> | Array<unknown>

function normalizeBase(base: string): string {
  return base.trim().replace(/\/$/, '')
}

function withoutV1Suffix(base: string): string {
  return base.replace(/\/v1$/, '')
}

async function readJson(path: string, signal?: AbortSignal, sessionId?: string): Promise<JsonLike> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (sessionId) {
    headers['x-dev-session-id'] = sessionId
  }

  const res = await fetch(path, {
    credentials: 'include',
    headers,
    signal,
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} at ${path}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`HTTP ${res.status} non-JSON response (${contentType || 'unknown content-type'}) at ${path}`)
  }

  return res.json() as Promise<JsonLike>
}

function asSkuArray(payload: JsonLike): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
  }

  const possibleKeys = ['data', 'items', 'results', 'skus', 'products']
  for (const key of possibleKeys) {
    const value = payload[key]
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    }
    if (typeof value === 'object' && value !== null) {
      for (const nestedKey of possibleKeys) {
        const nested = (value as Record<string, unknown>)[nestedKey]
        if (Array.isArray(nested)) {
          return nested.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        }
      }
    }
  }

  return []
}

function hasCatalogEnvelope(payload: JsonLike): boolean {
  if (Array.isArray(payload)) return true
  const possibleKeys = ['data', 'items', 'results', 'skus', 'products']
  return possibleKeys.some((key) => key in payload)
}

function inferTab(raw: string): ChairSku['tab'] {
  const value = raw.toLowerCase()
  if (value.includes('frozen')) return 'frozen'
  if (value.includes('wellness')) return 'wellness'
  if (value.includes('supplement')) return 'supplements'
  if (value.includes('treat')) return 'treats'
  return 'core'
}

function inferAnimal(raw: string): ChairSku['animal'] {
  const value = raw.toLowerCase()
  if (value.includes('cat') || value.includes('feline')) return 'cat'
  return 'dog'
}

function normalizeSku(row: Record<string, unknown>, index: number): ChairSku {
  const idCandidate = row.id ?? row.sku_id ?? row.skuId ?? row.code ?? row.i
  const upcCandidate = row.upc ?? row.item_upc ?? row.itemUpc ?? row.barcode ?? row.gtin
  const nameCandidate = row.name ?? row.title ?? row.display_name ?? row.displayName ?? row.n
  const manufacturerCandidate = row.manufacturer ?? row.brand ?? row.brand_name ?? row.b
  const categoryCandidate = row.category ?? row.product_line ?? row.productLine ?? row.tab ?? ''
  const speciesCandidate = row.animal ?? row.species ?? row.pet_type ?? row.petType ?? row.sp ?? ''
  const typeCandidate = row.type ?? row.t ?? ''
  const priceCandidate = row.price_cents ?? row.priceCents ?? row.price ?? row.p ?? 0
  const packCandidate = row.pack ?? row.unit ?? row.size ?? '1 ct'

  const id = typeof idCandidate === 'string' && idCandidate.trim() ? idCandidate : `KAYLEE-${index + 1}`
  const normalizedUpcCandidate =
    typeof upcCandidate === 'string'
      ? upcCandidate.replace(/\D/g, '')
      : typeof upcCandidate === 'number'
        ? String(Math.trunc(upcCandidate)).replace(/\D/g, '')
        : ''
  const upc = normalizedUpcCandidate.length > 0 ? normalizedUpcCandidate.padStart(12, '0').slice(0, 12) : `88${String(index + 1).padStart(10, '0')}`
  const name = typeof nameCandidate === 'string' && nameCandidate.trim() ? nameCandidate : `Kaylee SKU ${index + 1}`
  const manufacturer =
    typeof manufacturerCandidate === 'string' && manufacturerCandidate.trim()
      ? manufacturerCandidate.trim()
      : 'Unknown Manufacturer'
  const category = String(categoryCandidate || typeCandidate || '').trim()

  let priceCents = 0
  if (typeof priceCandidate === 'number') {
    priceCents = priceCandidate > 100 ? Math.round(priceCandidate) : Math.round(priceCandidate * 100)
  }

  return {
    id,
    upc,
    name,
    tab: inferTab(`${String(categoryCandidate)} ${String(typeCandidate)}`),
    category,
    manufacturer,
    animal: inferAnimal(String(speciesCandidate)),
    pack: String(packCandidate),
    priceCents: Math.max(priceCents, 0),
    velocity: 'medium',
    qoh: 0,
  }
}

async function fetchHealthSummary(base: string, signal?: AbortSignal, sessionId?: string): Promise<string> {
  const baseUrl = normalizeBase(base)
  const rootBase = withoutV1Suffix(baseUrl)
  const healthCandidates = [
    `${baseUrl}/health`,
    `${baseUrl}/v1/health`,
    `${baseUrl}/healthz`,
    `${rootBase}/health`,
    `${rootBase}/v1/health`,
    `${rootBase}/healthz`,
  ]

  for (const path of healthCandidates) {
    try {
      const payload = await readJson(path, signal, sessionId)
      if (Array.isArray(payload)) return `Connected via ${path}`
      const summary = payload.status ?? payload.message ?? payload.state
      return typeof summary === 'string' ? summary : `Connected via ${path}`
    } catch {
      continue
    }
  }

  return 'Connected (health endpoint not standardized)'
}

async function fetchCatalog(base: string, limit = 5_000, signal?: AbortSignal, sessionId?: string): Promise<ChairSku[]> {
  const baseUrl = normalizeBase(base)
  const rootBase = withoutV1Suffix(baseUrl)
  const usesV1Base = /\/v1$/.test(baseUrl)
  const catalogCandidates = usesV1Base
    ? [
        `${baseUrl}/catalog/skus?limit=${limit}`,
        `${baseUrl}/skus?limit=${limit}`,
        `${baseUrl}/items`,
      ]
    : [
        `${baseUrl}/v1/catalog/skus?limit=${limit}`,
        `${baseUrl}/v1/skus?limit=${limit}`,
        `${baseUrl}/catalog/skus?limit=${limit}`,
        `${baseUrl}/skus?limit=${limit}`,
        `${baseUrl}/v1/items`,
        `${baseUrl}/items`,
        `${rootBase}/v1/catalog/skus?limit=${limit}`,
        `${rootBase}/v1/skus?limit=${limit}`,
        `${rootBase}/catalog/skus?limit=${limit}`,
        `${rootBase}/skus?limit=${limit}`,
        `${rootBase}/v1/items`,
      ]

  let sawUnauthorized = false
  let lastError: string | null = null

  for (const path of catalogCandidates) {
    try {
      const payload = await readJson(path, signal, sessionId)
      const rows = asSkuArray(payload)
      if (rows.length > 0 || hasCatalogEnvelope(payload)) {
        return rows.map(normalizeSku)
      }
      lastError = `No rows in response at ${path}`
    } catch {
      try {
        // Re-read as text to preserve HTTP status details for operator debugging.
        const res = await fetch(path, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionId ? { 'x-dev-session-id': sessionId } : {}),
          },
          signal,
        })
        if (res.status === 401) {
          sawUnauthorized = true
          lastError = `HTTP 401 at ${path}`
        } else {
          lastError = `HTTP ${res.status} at ${path}`
        }
      } catch (nestedErr) {
        const nestedMessage = nestedErr instanceof Error ? nestedErr.message : 'unknown fetch error'
        lastError = `${path}: ${nestedMessage}`
      }
      continue
    }
  }

  if (sawUnauthorized) {
    throw new Error(`HTTP 401 Unauthorized while reading catalog endpoints (${lastError ?? 'unknown path'})`)
  }

  if (lastError?.includes('HTTP 200') || lastError?.includes('non-JSON response')) {
    throw new Error(
      `Catalog endpoint returned HTTP 200 but not usable JSON rows (${lastError}). This is usually an auth page. Use /dev-api/v1 and verify a valid session_id.`,
    )
  }

  throw new Error(`No supported endpoint found for configured catalog API (${lastError ?? 'no response details'})`)
}

export async function connectKaylee(
  base: string,
  signal?: AbortSignal,
  options?: KayleeConnectOptions,
): Promise<KayleeConnectionResult> {
  const [healthSummary, skus] = await Promise.all([
    fetchHealthSummary(base, signal, options?.sessionId),
    fetchCatalog(base, 5_000, signal, options?.sessionId),
  ])

  return { healthSummary, skus }
}
