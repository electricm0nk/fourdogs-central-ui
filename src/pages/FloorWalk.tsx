import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AnimalFilter, ChairSku } from '@/lib/chairSandboxMock'
import { api } from '@/lib/api'
import { useVendorCatalog } from '@/hooks/use_vendor_catalog'
import { buildCatalogTabs, getBrandOptionsForTab, matchesCatalogTab, type CatalogTabKey } from '@/lib/catalogTabs'
import {
  compareSkuByNameAndSize,
  getActiveToggleBtnClass,
  getCardClass,
  getInactiveToggleBtnClass,
  getInputClass,
  getMutedTextClass,
  getPageClass,
  getPriorityBadgeClass,
  getPriorityRowClass,
  getSectionClass,
  getTableAltRowClass,
  getTableHeaderClass,
  getTableRowBaseClass,
  getTogglePillClass,
  readUiMode,
  type UiMode,
} from '@/lib/orderGrid'
import { cn } from '@/lib/utils'
import { useOrder } from '@/hooks/use_order'

type CatalogTab = CatalogTabKey
type ScanMode = 'add' | 'remove'

const TABLE_ROW_HEIGHT_PX = 56
const TABLE_OVERSCAN_ROWS = 10

interface OrderLine {
  skuId: string
  quantity: number
}

interface FloorWalkLinePayload {
  sku_id: string
  item_upc: string
  quantity: number
}

interface SuggestionRecord {
  request_number: number
  username: string
  suggestion: string
  status: string
  submitted_at: string
}

function formatOrderDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function FloorWalk() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, isLoading } = useOrder(id ?? '')
  const catalogQuery = useVendorCatalog(order?.vendor_id, order?.vendor_adapter_id)
  const sourceSkus = catalogQuery.data ?? []
  const catalogSource = sourceSkus.length > 0 ? 'live' : 'none'
  const [lineItems, setLineItems] = useState<OrderLine[]>([])
  const [activeTab, setActiveTab] = useState<CatalogTab>('all')
  const [animal, setAnimal] = useState<AnimalFilter>('all')
  const [hideTabs, setHideTabs] = useState(false)
  const [hideZeroQty, setHideZeroQty] = useState(false)
  const [onlyZeroQoh, setOnlyZeroQoh] = useState(false)
  const [only111, setOnly111] = useState(false)
  const [hideDoNotReorder, setHideDoNotReorder] = useState(true)
  const [frozenBrand, setFrozenBrand] = useState('all')
  const [foodBrand, setFoodBrand] = useState('all')
  const [treatsBrand, setTreatsBrand] = useState('all')
  const [toysBrand, setToysBrand] = useState('all')
  const [everythingElseBrand, setEverythingElseBrand] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedSideBrand, setSelectedSideBrand] = useState<string | null>(null)
  const [scanMode, setScanMode] = useState<ScanMode>('add')
  const [scanInput, setScanInput] = useState('')
  const [scanMessage, setScanMessage] = useState('')
  const [leftWingOpen, setLeftWingOpen] = useState(false)
  const [rightWingOpen, setRightWingOpen] = useState(false)
  const [suggestionText, setSuggestionText] = useState('')
  const [uiMode, setUiMode] = useState<UiMode>(() => readUiMode())

  const scanInputRef = useRef<HTMLInputElement | null>(null)
  const tableViewportRef = useRef<HTMLDivElement | null>(null)
  const hydratedFromServerRef = useRef(false)
  const [tableScrollTop, setTableScrollTop] = useState(0)
  const [tableViewportHeight, setTableViewportHeight] = useState(600)

  useEffect(() => {
    scanInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('fd-ui-mode', uiMode)
    }
  }, [uiMode])

  useEffect(() => {
    function updateViewportHeight() {
      if (!tableViewportRef.current) return
      setTableViewportHeight(tableViewportRef.current.clientHeight)
    }

    updateViewportHeight()
    window.addEventListener('resize', updateViewportHeight)
    return () => window.removeEventListener('resize', updateViewportHeight)
  }, [])

  useEffect(() => {
    hydratedFromServerRef.current = false
  }, [id])

  const floorWalkLinesQuery = useQuery({
    queryKey: ['order-floor-walk-lines', id],
    queryFn: () => api.get<{ data: FloorWalkLinePayload[] }>(`/v1/orders/${id}/floor-walk-lines`),
    select: (res) => res.data,
    enabled: !!id,
  })

  const saveFloorWalkLines = useMutation({
    mutationFn: (lines: FloorWalkLinePayload[]) =>
      api.put<{ data: { saved: boolean } }>(`/v1/orders/${id}/floor-walk-lines`, { lines }),
  })

  const suggestionsQuery = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => api.get<{ data: SuggestionRecord[] }>('/v1/suggestions'),
    select: (res) => res.data,
  })

  const createSuggestion = useMutation({
    mutationFn: (payload: { suggestion: string }) =>
      api.post<{ data: SuggestionRecord }>('/v1/suggestions', payload),
    onSuccess: () => {
      setSuggestionText('')
      suggestionsQuery.refetch()
    },
  })

  const skuMap = useMemo(() => new Map(sourceSkus.map((sku) => [sku.id, sku])), [sourceSkus])
  const upcMap = useMemo(() => new Map(sourceSkus.map((sku) => [sku.upc, sku])), [sourceSkus])
  const qtyBySku = useMemo(() => new Map(lineItems.map((line) => [line.skuId, line.quantity])), [lineItems])

  useEffect(() => {
    if (!floorWalkLinesQuery.isSuccess || hydratedFromServerRef.current) return

    const loadedLines = floorWalkLinesQuery.data
      .filter((line) => line.quantity > 0)
      .map((line) => ({ skuId: line.sku_id, quantity: line.quantity }))

    setLineItems(loadedLines)
    hydratedFromServerRef.current = true
  }, [floorWalkLinesQuery.data, floorWalkLinesQuery.isSuccess])


  const tabOptions = useMemo(() => buildCatalogTabs(sourceSkus), [sourceSkus])
  const frozenBrandOptions = useMemo(() => getBrandOptionsForTab(sourceSkus, 'frozen'), [sourceSkus])
  const foodBrandOptions = useMemo(() => getBrandOptionsForTab(sourceSkus, 'food'), [sourceSkus])
  const treatsBrandOptions = useMemo(() => getBrandOptionsForTab(sourceSkus, 'treats'), [sourceSkus])
  const toysBrandOptions = useMemo(() => getBrandOptionsForTab(sourceSkus, 'toys'), [sourceSkus])
  const everythingElseBrandOptions = useMemo(() => getBrandOptionsForTab(sourceSkus, 'everything-else'), [sourceSkus])

  useEffect(() => {
    setFrozenBrand('all')
    setFoodBrand('all')
    setTreatsBrand('all')
    setToysBrand('all')
    setEverythingElseBrand('all')
  }, [activeTab])

  const filteredSkus = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase()

    return sourceSkus.filter((sku) => {
      const tabMatch = matchesCatalogTab(sku, activeTab)
      const brandMatch =
        activeTab === 'frozen' ? (frozenBrand === 'all' || sku.manufacturer === frozenBrand) :
        activeTab === 'food' ? (foodBrand === 'all' || sku.manufacturer === foodBrand) :
        activeTab === 'treats' ? (treatsBrand === 'all' || sku.manufacturer === treatsBrand) :
        activeTab === 'toys' ? (toysBrand === 'all' || sku.manufacturer === toysBrand) :
        activeTab === 'everything-else' ? (everythingElseBrand === 'all' || sku.manufacturer === everythingElseBrand) :
        true

      const animalMatch = animal === 'all' || sku.animal === animal
      const queryMatch =
        !lowerQuery ||
        sku.id.toLowerCase().includes(lowerQuery) ||
        sku.upc.includes(lowerQuery) ||
        sku.name.toLowerCase().includes(lowerQuery) ||
        sku.manufacturer.toLowerCase().includes(lowerQuery)
      const qty = qtyBySku.get(sku.id) ?? 0
      const zeroMatch = hideZeroQty ? qty > 0 : true
      const zeroQohMatch = onlyZeroQoh ? sku.qoh === 0 : true
      const only111Match = only111 ? Number.parseInt(sku.pack, 10) === 111 : true
      const doNotReorderMatch = hideDoNotReorder ? !sku.doNotReorder : true

      return tabMatch && brandMatch && animalMatch && queryMatch && zeroMatch && zeroQohMatch && only111Match && doNotReorderMatch
    }).slice().sort(compareSkuByNameAndSize)
  }, [sourceSkus, activeTab, animal, query, qtyBySku, hideZeroQty, onlyZeroQoh, only111, hideDoNotReorder, frozenBrand, foodBrand, treatsBrand, toysBrand, everythingElseBrand])

  const addedLines = useMemo(
    () =>
      lineItems
        .filter((line) => line.quantity > 0)
        .map((line) => ({ line, sku: skuMap.get(line.skuId) }))
        .filter((entry): entry is { line: OrderLine; sku: ChairSku } => Boolean(entry.sku))
        .sort((a, b) => compareSkuByNameAndSize(a.sku, b.sku)),
    [lineItems, skuMap],
  )

  const runningTotalCents = useMemo(
    () =>
      lineItems.reduce((sum, item) => {
        const sku = skuMap.get(item.skuId)
        if (!sku) return sum
        return sum + sku.priceCents * item.quantity
      }, 0),
    [lineItems, skuMap],
  )

  const prioritySkuIds = useMemo(
    () => new Set(
      floorWalkLinesQuery.data?.filter((l) => l.quantity > 0).map((l) => l.sku_id) ?? []
    ),
    [floorWalkLinesQuery.data],
  )

  const allBrands = useMemo(
    () => Array.from(new Set(sourceSkus.map((sku) => sku.manufacturer?.trim()).filter((brand): brand is string => Boolean(brand)))).sort((a, b) => a.localeCompare(b)),
    [sourceSkus],
  )

  const visibleRange = useMemo(() => {
    const total = filteredSkus.length
    const startIndex = Math.max(0, Math.floor(tableScrollTop / TABLE_ROW_HEIGHT_PX) - TABLE_OVERSCAN_ROWS)
    const endIndex = Math.min(
      total,
      Math.ceil((tableScrollTop + tableViewportHeight) / TABLE_ROW_HEIGHT_PX) + TABLE_OVERSCAN_ROWS,
    )

    return {
      startIndex,
      endIndex,
      topSpacerHeight: startIndex * TABLE_ROW_HEIGHT_PX,
      bottomSpacerHeight: Math.max(0, (total - endIndex) * TABLE_ROW_HEIGHT_PX),
      rows: filteredSkus.slice(startIndex, endIndex),
    }
  }, [filteredSkus, tableScrollTop, tableViewportHeight])

  useEffect(() => {
    setTableScrollTop(0)
    tableViewportRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [
    activeTab,
    animal,
    query,
    hideTabs,
    hideZeroQty,
    onlyZeroQoh,
    only111,
    hideDoNotReorder,
    frozenBrand,
    foodBrand,
    treatsBrand,
    toysBrand,
    everythingElseBrand,
  ])

  const budgetDisplay =
    typeof order?.budget_cents === 'number'
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(order.budget_cents / 100)
      : 'Not set'

  function formatMoney(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
  }

  function upsertLineQuantity(skuId: string, quantity: number) {
    setLineItems((prev) => {
      const nextQty = Math.max(0, quantity)
      const existingIndex = prev.findIndex((line) => line.skuId === skuId)

      if (existingIndex >= 0) {
        const copy = [...prev]
        if (nextQty === 0) {
          copy.splice(existingIndex, 1)
        } else {
          copy[existingIndex] = { ...copy[existingIndex], quantity: nextQty }
        }
        return copy
      }

      if (nextQty === 0) return prev
      return [...prev, { skuId, quantity: nextQty }]
    })
  }

  async function flushFloorWalkLines() {
    if (!id || !hydratedFromServerRef.current) return

    const payload: FloorWalkLinePayload[] = lineItems
      .filter((line) => line.quantity > 0)
      .map((line) => {
        const sku = skuMap.get(line.skuId)
        if (!sku) return null

        return {
          sku_id: line.skuId,
          item_upc: sku.upc,
          quantity: line.quantity,
        }
      })
      .filter((line): line is FloorWalkLinePayload => line !== null)

    await saveFloorWalkLines.mutateAsync(payload)
  }

  async function handleContinueToWorksheet() {
    try {
      await flushFloorWalkLines()
      navigate(`/orders/${id}`)
    } catch {
      setScanMessage('Could not save floor walk lines. Please wait for save confirmation and retry.')
    }
  }

  function findSkuFromScan(rawValue: string): ChairSku | undefined {
    const normalized = rawValue.replace(/\s+/g, '')
    if (!/^\d{12}$/.test(normalized)) return undefined
    return upcMap.get(normalized)
  }

  function processScan() {
    const sku = findSkuFromScan(scanInput)
    if (!sku) {
      setScanMessage('No UPC match for scanned code.')
      return
    }

    const currentQty = qtyBySku.get(sku.id) ?? 0
    const nextQty = scanMode === 'add' ? currentQty + 1 : Math.max(0, currentQty - 1)
    upsertLineQuantity(sku.id, nextQty)

    const actionText = scanMode === 'add' ? 'Added' : 'Removed'
    setScanMessage(`${actionText} 1 for UPC ${sku.upc} (${nextQty})`)
    setScanInput('')
    scanInputRef.current?.focus()
  }

  async function handleSuggestionSubmit() {
    const trimmed = suggestionText.trim()
    if (!trimmed || trimmed.length > 4096) return
    await createSuggestion.mutateAsync({ suggestion: trimmed })
  }

  if (!id) {
    return (
      <div className="min-h-screen bg-amber-50 p-6">
        <div className="max-w-4xl mx-auto rounded-lg border border-amber-200 bg-white p-6 text-center">
          <p className="text-sm text-red-600">Missing order ID.</p>
          <Button className="mt-3" variant="outline" onClick={() => navigate('/')}>
            Back to Orders
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading || !order) {
    return (
      <div className="min-h-screen bg-amber-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-8 text-stone-500">Loading floor walk…</div>
      </div>
    )
  }

  if (floorWalkLinesQuery.isLoading && !hydratedFromServerRef.current) {
    return (
      <div className="min-h-screen bg-amber-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-8 text-stone-500">Loading floor walk lines…</div>
      </div>
    )
  }

  return (
    <div className={cn('h-screen overflow-hidden p-6', getPageClass(uiMode))}>
      <div className="mx-auto flex h-full max-w-[1400px] flex-col gap-4">
        <div className={cn('rounded-lg border p-5', getCardClass(uiMode))}>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">Floor Walk</h1>
            <Badge className={uiMode === 'dark' ? 'bg-blue-900 text-blue-200' : 'bg-amber-100 text-amber-800'}>Step 1 of 2</Badge>
            <div className="flex gap-1">
              <button
                type="button"
                title="Light mode"
                className={cn('rounded-full w-9 h-9 flex items-center justify-center text-lg transition-colors', uiMode === 'light' ? 'bg-[#CE7019] text-white' : 'opacity-40 hover:opacity-80')}
                onClick={() => setUiMode('light')}
              >☀</button>
              <button
                type="button"
                title="Dark mode"
                className={cn('rounded-full w-9 h-9 flex items-center justify-center text-lg transition-colors', uiMode === 'dark' ? 'bg-blue-700 text-white' : 'opacity-40 hover:opacity-80')}
                onClick={() => setUiMode('dark')}
              >🌙</button>
            </div>
            <span className={cn('ml-auto text-sm', getMutedTextClass(uiMode))}>{order.vendor_name} • {formatOrderDate(order.order_date)}</span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-gradient-to-r from-[#762123] via-[#006A71] to-[#CE7019]" />
          <p className={cn('mt-2 text-sm', getMutedTextClass(uiMode))}>
            Walk the floor first, capture low-stock and stockout patterns, then continue to worksheet for ordering.
          </p>
            {catalogQuery.isError && (
              <p className="mt-2 text-sm text-red-600">
                Live catalog unavailable from central API. Fix auth/session and retry.
              </p>
            )}
            {!catalogQuery.isLoading && !catalogQuery.isError && sourceSkus.length === 0 && (
              <p className="mt-2 text-sm text-amber-600">
                Live catalog returned zero items.
              </p>
            )}
        </div>

        <div className="grid flex-1 min-h-0 gap-4 xl:grid-cols-[1fr_360px]">
          <section className={cn('flex min-h-0 flex-col rounded-lg border p-5', getSectionClass(uiMode))}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelectedSideBrand(null)
                }}
                placeholder="Search SKU, UPC, or name"
                className="max-w-xs"
              />
              <div className={getTogglePillClass(uiMode)}>
                {(['all', 'dog', 'cat'] as AnimalFilter[]).map((option) => (
                  <button
                    key={option}
                    className={cn(
                      'capitalize',
                      animal === option ? getActiveToggleBtnClass(uiMode) : getInactiveToggleBtnClass(uiMode),
                    )}
                    onClick={() => setAnimal(option)}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
              <label className={cn('flex items-center gap-2 text-xs', getMutedTextClass(uiMode))}>
                <input
                  type="checkbox"
                  checked={hideTabs}
                  onChange={(event) => setHideTabs(event.target.checked)}
                />
                Hide tabs
              </label>
              <label className={cn('ml-auto flex items-center gap-2 text-xs', getMutedTextClass(uiMode))}>
                <input
                  type="checkbox"
                  checked={hideZeroQty}
                  onChange={(event) => setHideZeroQty(event.target.checked)}
                />
                Hide zero qty
              </label>
              <label className={cn('flex items-center gap-2 text-xs', getMutedTextClass(uiMode))}>
                <input
                  type="checkbox"
                  checked={onlyZeroQoh}
                  onChange={(event) => setOnlyZeroQoh(event.target.checked)}
                />
                Zero QoH
              </label>
              <label className={cn('flex items-center gap-2 text-xs', getMutedTextClass(uiMode))}>
                <input
                  type="checkbox"
                  checked={only111}
                  onChange={(event) => setOnly111(event.target.checked)}
                />
                111
              </label>
              <label className={cn('flex items-center gap-2 text-xs', getMutedTextClass(uiMode))}>
                <input
                  type="checkbox"
                  checked={hideDoNotReorder}
                  onChange={(event) => setHideDoNotReorder(event.target.checked)}
                />
                Hide Do Not Reorder
              </label>
            </div>

            {!hideTabs && (
            <>
            <div className={cn('mb-3 flex flex-wrap gap-2 border-b pb-3', uiMode === 'dark' ? 'border-[#23314A]' : 'border-amber-200')}>
              {tabOptions.map((tab) => (
                <button
                  key={tab.key}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs uppercase tracking-wide',
                    activeTab === tab.key
                      ? (uiMode === 'dark' ? 'border-sky-500 bg-sky-500/20 text-sky-300' : 'border-teal-700 bg-teal-700 text-white')
                      : (uiMode === 'dark' ? 'border-[#25324A] bg-transparent text-slate-400' : 'border-amber-300 bg-amber-50 text-stone-700'),
                  )}
                  onClick={() => setActiveTab(tab.key)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'food' && (
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className={cn(getMutedTextClass(uiMode))}>Food brand</span>
                <select
                  className={cn('h-8 min-w-[220px] rounded border px-2', getInputClass(uiMode))}
                  value={foodBrand}
                  onChange={(event) => setFoodBrand(event.target.value)}
                >
                  <option value="all">All Brands</option>
                  {foodBrandOptions.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'frozen' && (
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className={cn(getMutedTextClass(uiMode))}>Frozen brand</span>
                <select
                  className={cn('h-8 min-w-[220px] rounded border px-2', getInputClass(uiMode))}
                  value={frozenBrand}
                  onChange={(event) => setFrozenBrand(event.target.value)}
                >
                  <option value="all">All Brands</option>
                  {frozenBrandOptions.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'treats' && (
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className={cn(getMutedTextClass(uiMode))}>Treat brand</span>
                <select
                  className={cn('h-8 min-w-[220px] rounded border px-2', getInputClass(uiMode))}
                  value={treatsBrand}
                  onChange={(event) => setTreatsBrand(event.target.value)}
                >
                  <option value="all">All Brands</option>
                  {treatsBrandOptions.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'toys' && (
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className={cn(getMutedTextClass(uiMode))}>Toy brand</span>
                <select
                  className={cn('h-8 min-w-[220px] rounded border px-2', getInputClass(uiMode))}
                  value={toysBrand}
                  onChange={(event) => setToysBrand(event.target.value)}
                >
                  <option value="all">All Brands</option>
                  {toysBrandOptions.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'everything-else' && (
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className={cn(getMutedTextClass(uiMode))}>Everything Else brand</span>
                <select
                  className={cn('h-8 min-w-[220px] rounded border px-2', getInputClass(uiMode))}
                  value={everythingElseBrand}
                  onChange={(event) => setEverythingElseBrand(event.target.value)}
                >
                  <option value="all">All Brands</option>
                  {everythingElseBrandOptions.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
            )}

            </>
            )}

            {!catalogQuery.isLoading && sourceSkus.length === 0 && (
              <div className={cn('mb-3 rounded border px-3 py-2 text-sm', uiMode === 'dark' ? 'border-red-800 bg-red-950/30 text-red-200' : 'border-red-200 bg-red-50 text-red-700')}>
                Floor Walk requires live catalog data from central. No mock fallback is used here.
              </div>
            )}

            <div className={cn('mb-2 flex items-center gap-2 text-xs', getMutedTextClass(uiMode))}>
              <span>Showing {filteredSkus.length.toLocaleString()} of {sourceSkus.length.toLocaleString()} SKUs</span>
              {catalogQuery.isLoading ? (
                <span className="rounded bg-slate-500/20 px-1.5 py-0.5 text-[10px]">loading…</span>
              ) : catalogSource === 'live' ? (
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">● live</span>
              ) : (
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400">● no live data</span>
              )}
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className={cn('font-semibold', getMutedTextClass(uiMode))}>Legend:</span>
              <span className={cn('inline-flex rounded border px-2 py-1 font-semibold', getPriorityBadgeClass(uiMode))}>
                PRIORITY
              </span>
            </div>

            <div
              ref={tableViewportRef}
              onScroll={(event) => {
                setTableScrollTop(event.currentTarget.scrollTop)
                setTableViewportHeight(event.currentTarget.clientHeight)
              }}
              className={cn('min-h-0 flex-1 overflow-auto rounded border', uiMode === 'dark' ? 'border-[#25324A]' : 'border-amber-200')}
            >
              <table className="w-full min-w-[980px] border-collapse text-xs">
                <thead className={cn('sticky top-0 z-10', getTableHeaderClass(uiMode))}>
                  <tr>
                    <th className="px-2 py-2 text-left">Product</th>
                    <th className="px-2 py-2 text-left">Pack</th>
                    <th className="px-2 py-2 text-right">QOH</th>
                    <th className="px-2 py-2 text-right">Price</th>
                    <th className="px-2 py-2 text-right">Qty</th>
                    <th className="px-2 py-2 text-right">Status</th>
                    <th className="px-2 py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRange.topSpacerHeight > 0 && (
                    <tr>
                      <td colSpan={7} style={{ height: visibleRange.topSpacerHeight }} />
                    </tr>
                  )}
                  {visibleRange.rows.map((sku) => {
                    const qty = qtyBySku.get(sku.id) ?? 0
                    const lineTotal = qty * sku.priceCents
                    const isPriority = prioritySkuIds.has(sku.id)
                    return (
                      <tr
                        key={sku.id}
                        style={{ height: TABLE_ROW_HEIGHT_PX }}
                        className={cn(getTableRowBaseClass(uiMode), getTableAltRowClass(uiMode), isPriority && getPriorityRowClass(uiMode))}
                      >
                        <td className="px-2 py-1">{sku.name}</td>
                        <td className="px-2 py-1">{sku.pack}</td>
                        <td className="px-2 py-1 text-right">{sku.qoh}</td>
                        <td className="px-2 py-1 text-right">{formatMoney(sku.priceCents)}</td>
                        <td className="px-2 py-1 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              className={cn('h-10 w-10 rounded border text-lg font-bold', uiMode === 'dark' ? 'border-[#334155] bg-[#1E293B] text-slate-200 active:bg-[#0B1424]' : 'border-amber-300 bg-amber-50 text-stone-700 active:bg-amber-100')}
                              onClick={() => upsertLineQuantity(sku.id, qty - 1)}
                              aria-label={`Decrease ${sku.id}`}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={qty}
                              className={cn('w-14 text-center text-sm', getInputClass(uiMode))}
                              onChange={(event) => upsertLineQuantity(sku.id, Math.max(0, Number(event.target.value) || 0))}
                            />
                            <button
                              type="button"
                              className={cn('h-10 w-10 rounded border text-lg font-bold', uiMode === 'dark' ? 'border-[#334155] bg-[#1E293B] text-slate-200 active:bg-[#0B1424]' : 'border-amber-300 bg-amber-50 text-stone-700 active:bg-amber-100')}
                              onClick={() => upsertLineQuantity(sku.id, qty + 1)}
                              aria-label={`Increase ${sku.id}`}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1 text-right">
                          {isPriority && (
                            <span className={cn('inline-flex rounded border px-2 py-1 text-[10px] font-semibold', getPriorityBadgeClass(uiMode))}>
                              PRIORITY
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-right font-medium">{formatMoney(lineTotal)}</td>
                      </tr>
                    )
                  })}
                  {visibleRange.bottomSpacerHeight > 0 && (
                    <tr>
                      <td colSpan={7} style={{ height: visibleRange.bottomSpacerHeight }} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className={cn('min-h-0 overflow-auto rounded-lg border p-5', getSectionClass(uiMode))}>
            <h2 className="text-base font-semibold">Scanner Entry</h2>
            <p className={cn('mt-1 text-xs', getMutedTextClass(uiMode))}>
              Keep cursor in the input box and scan 12-digit UPCs. Qty updates automatically.
            </p>

            <div className={cn('mt-3', getTogglePillClass(uiMode))}>
              {(['add', 'remove'] as ScanMode[]).map((mode) => (
                <button
                  key={mode}
                  className={cn(
                    'uppercase',
                    scanMode === mode ? getActiveToggleBtnClass(uiMode) : getInactiveToggleBtnClass(uiMode),
                  )}
                  onClick={() => setScanMode(mode)}
                  type="button"
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <Input
                ref={scanInputRef}
                value={scanInput}
                onChange={(event) => setScanInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    processScan()
                  }
                }}
                placeholder="Scan 12-digit UPC"
              />
              <Button type="button" onClick={processScan} disabled={!scanInput.trim()}>
                {scanMode === 'add' ? 'Add' : 'Remove'}
              </Button>
            </div>

            {scanMessage && (
              <p className={cn('mt-2 rounded p-2 text-xs', uiMode === 'dark' ? 'bg-[#13233C] text-slate-300' : 'bg-amber-100 text-stone-700')}>{scanMessage}</p>
            )}

            <p className={cn('mt-2 text-xs', getMutedTextClass(uiMode))}>
              {saveFloorWalkLines.isPending
                ? 'Saving floor walk lines…'
                : saveFloorWalkLines.isError
                  ? 'Save failed. Click Save Changes to retry.'
                  : 'Floor walk lines saved'}
            </p>

              <div className="mt-4 flex gap-2">
                <Button
                  className="flex-1"
                  onClick={flushFloorWalkLines}
                  disabled={saveFloorWalkLines.isPending}
                >
                  {saveFloorWalkLines.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            <div className={cn('mt-3 rounded-md p-3 text-sm', uiMode === 'dark' ? 'border border-[#23314A] bg-[#0F1F36]' : 'border border-amber-200 bg-amber-50')}>
              <p><span className={getMutedTextClass(uiMode)}>Order budget:</span> <span className="font-medium">{budgetDisplay}</span></p>
              <p className="mt-1"><span className={getMutedTextClass(uiMode)}>Running total:</span> <span className="font-medium">{formatMoney(runningTotalCents)}</span></p>
            </div>

            <div className="mt-4">
              <p className={cn('text-sm font-medium', uiMode === 'dark' ? 'text-slate-200' : 'text-stone-800')}>Items Added ({addedLines.length})</p>
              <div className={cn('mt-2 max-h-[38vh] overflow-auto rounded border', uiMode === 'dark' ? 'border-[#23314A] bg-[#0B1424]' : 'border-amber-200 bg-white')}>
                {addedLines.length === 0 ? (
                  <p className={cn('p-3 text-xs', getMutedTextClass(uiMode))}>No scanned items yet.</p>
                ) : (
                  addedLines.map(({ line, sku }) => (
                    <div key={line.skuId} className={cn('flex items-center gap-2 border-b px-2 py-2 text-xs', uiMode === 'dark' ? 'border-[#23314A]' : 'border-amber-100')}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{sku.name}</div>
                        <div className={cn('font-mono', getMutedTextClass(uiMode))}>{sku.id} • {sku.upc}</div>
                      </div>
                      <Badge className={uiMode === 'dark' ? 'bg-[#13233C] text-slate-200' : 'bg-amber-100 text-stone-800'}>Qty {line.quantity}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="outline"
                className={cn(uiMode === 'dark' && 'border-slate-600 bg-[#0B1424] text-slate-200 hover:bg-slate-800')}
                onClick={() => navigate('/')}
              >
                Back to Orders
              </Button>
              <Button onClick={handleContinueToWorksheet} disabled={saveFloorWalkLines.isPending}>
                Continue to Worksheet
              </Button>
            </div>
          </aside>
        </div>

        <div className={cn('text-xs', getMutedTextClass(uiMode))}>
          Scanner behavior: Add increments qty by 1 each scan. Remove decrements qty by 1 and never goes below zero.
        </div>
      </div>

      <button
        type="button"
        onClick={() => setLeftWingOpen((v) => !v)}
        className={cn(
          'fixed left-0 top-1/2 z-50 -translate-y-1/2 rounded-r-md border px-2 py-3 text-sm font-semibold shadow',
          uiMode === 'dark' ? 'border-[#25324A] bg-[#13233C] text-slate-200' : 'border-amber-300 bg-white text-stone-700',
        )}
        aria-label="Toggle brand wing"
      >
        {leftWingOpen ? '<' : '>'}
      </button>

      <button
        type="button"
        onClick={() => setRightWingOpen((v) => !v)}
        className={cn(
          'fixed right-0 top-1/2 z-50 -translate-y-1/2 rounded-l-md border px-2 py-3 text-sm font-semibold shadow',
          uiMode === 'dark' ? 'border-[#25324A] bg-[#13233C] text-slate-200' : 'border-amber-300 bg-white text-stone-700',
        )}
        aria-label="Toggle suggestion wing"
      >
        {rightWingOpen ? '>' : '<'}
      </button>

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-72 transform border-r p-4 transition-transform duration-300 ease-out',
          leftWingOpen ? 'translate-x-0' : '-translate-x-full',
          uiMode === 'dark' ? 'border-[#25324A] bg-[#0B1424]' : 'border-amber-200 bg-amber-50',
        )}
      >
        <h3 className="text-sm font-semibold">Brand Filters</h3>
        <p className={cn('mt-1 text-xs', getMutedTextClass(uiMode))}>All brands currently available for filtering.</p>
        <div className="mt-3 h-[calc(100vh-100px)] overflow-auto rounded border p-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('all')
              setQuery('')
              setSelectedSideBrand(null)
            }}
            aria-pressed={selectedSideBrand === null}
            className={cn(
              'mb-1 block w-full rounded px-2 py-1 text-left text-xs font-semibold',
              selectedSideBrand === null
                ? (uiMode === 'dark' ? 'bg-sky-700/40 text-sky-200' : 'bg-teal-700 text-white')
                : (uiMode === 'dark' ? 'hover:bg-[#13233C]' : 'hover:bg-amber-100'),
            )}
          >
            All
          </button>
          {allBrands.map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => {
                setActiveTab('all')
                if (selectedSideBrand === brand) {
                  setSelectedSideBrand(null)
                  setQuery('')
                  return
                }
                setSelectedSideBrand(brand)
                setQuery(brand)
              }}
              aria-pressed={selectedSideBrand === brand}
              className={cn(
                'mb-1 block w-full rounded px-2 py-1 text-left text-xs',
                selectedSideBrand === brand
                  ? (uiMode === 'dark' ? 'bg-sky-700/40 text-sky-200' : 'bg-teal-700 text-white')
                  : (uiMode === 'dark' ? 'hover:bg-[#13233C]' : 'hover:bg-amber-100'),
              )}
            >
              {brand}
            </button>
          ))}
        </div>
      </aside>

      <aside
        className={cn(
          'fixed right-0 top-0 z-40 h-screen w-96 transform border-l p-4 transition-transform duration-300 ease-out',
          rightWingOpen ? 'translate-x-0' : 'translate-x-full',
          uiMode === 'dark' ? 'border-[#25324A] bg-[#0B1424]' : 'border-amber-200 bg-amber-50',
        )}
      >
        <h3 className="text-sm font-semibold">Suggestion Box</h3>
        <p className={cn('mt-1 text-xs', getMutedTextClass(uiMode))}>Submit free-form suggestions (max 4096 chars).</p>
        <textarea
          value={suggestionText}
          onChange={(event) => setSuggestionText(event.target.value.slice(0, 4096))}
          maxLength={4096}
          className={cn('mt-3 h-28 w-full rounded border p-2 text-xs', getInputClass(uiMode))}
          placeholder="Type your suggestion here..."
        />
        <div className={cn('mt-1 text-right text-[11px]', getMutedTextClass(uiMode))}>{suggestionText.length}/4096</div>
        <Button
          type="button"
          className="mt-2 w-full"
          onClick={handleSuggestionSubmit}
          disabled={createSuggestion.isPending || suggestionText.trim().length === 0 || suggestionText.length > 4096}
        >
          {createSuggestion.isPending ? 'Submitting…' : 'Submit'}
        </Button>

        <div className="mt-4 h-[calc(100vh-280px)] overflow-auto rounded border p-2">
          {suggestionsQuery.isLoading ? (
            <p className={cn('text-xs', getMutedTextClass(uiMode))}>Loading suggestions...</p>
          ) : (
            (suggestionsQuery.data ?? []).map((row) => (
              <div key={row.request_number} className={cn('mb-2 rounded border p-2 text-xs', uiMode === 'dark' ? 'border-[#25324A]' : 'border-amber-200')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">#{row.request_number}</span>
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px]', uiMode === 'dark' ? 'bg-[#13233C]' : 'bg-amber-100')}>{row.status}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{row.suggestion}</p>
                <p className={cn('mt-1 text-[10px]', getMutedTextClass(uiMode))}>{row.username} • {new Date(row.submitted_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  )
}
