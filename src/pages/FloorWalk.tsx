import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { makeChairSkus, type AnimalFilter, type ChairSku } from '@/lib/chairSandboxMock'
import { api } from '@/lib/api'
import { useVendorCatalog } from '@/hooks/use_vendor_catalog'
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

type CatalogTab = 'all' | 'treats' | 'frozen' | 'wellness' | string
type ScanMode = 'add' | 'remove'

interface OrderLine {
  skuId: string
  quantity: number
}

interface FloorWalkLinePayload {
  sku_id: string
  item_upc: string
  quantity: number
}

function formatOrderDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function FloorWalk() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, isLoading } = useOrder(id ?? '')
  const fallbackSkus = useMemo(() => makeChairSkus(5_000), [])
  const catalogQuery = useVendorCatalog(order?.vendor_adapter_id)
  const sourceSkus = catalogQuery.data && catalogQuery.data.length > 0 ? catalogQuery.data : fallbackSkus
  const catalogSource = catalogQuery.data && catalogQuery.data.length > 0 ? 'live' : 'mock'
  const [lineItems, setLineItems] = useState<OrderLine[]>([])
  const [activeTab, setActiveTab] = useState<CatalogTab>('all')
  const [animal, setAnimal] = useState<AnimalFilter>('all')
  const [hideZeroQty, setHideZeroQty] = useState(false)
  const [query, setQuery] = useState('')
  const [scanMode, setScanMode] = useState<ScanMode>('add')
  const [scanInput, setScanInput] = useState('')
  const [scanMessage, setScanMessage] = useState('')
  const [uiMode, setUiMode] = useState<UiMode>(() => readUiMode())

  const scanInputRef = useRef<HTMLInputElement | null>(null)
  const hydratedFromServerRef = useRef(false)

  useEffect(() => {
    scanInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('fd-ui-mode', uiMode)
    }
  }, [uiMode])

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

  useEffect(() => {
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

    const t = window.setTimeout(() => {
      saveFloorWalkLines.mutate(payload)
    }, 400)

    return () => window.clearTimeout(t)
  }, [lineItems, id, skuMap, saveFloorWalkLines])

  const tabOptions = useMemo(() => {
    const manufacturerTabs = Array.from(
      new Set(
        sourceSkus
          .filter((sku) => sku.tab !== 'frozen' && sku.tab !== 'wellness' && sku.tab !== 'treats')
          .map((sku) => sku.manufacturer || 'Unknown Manufacturer'),
      ),
    ).sort((a, b) => a.localeCompare(b))

    return ['all', ...manufacturerTabs, 'treats', 'frozen', 'wellness']
  }, [sourceSkus])

  const filteredSkus = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase()

    return sourceSkus.filter((sku) => {
      let tabMatch = false
      if (activeTab === 'all') {
        tabMatch = true
      } else if (activeTab === 'treats') {
        tabMatch = sku.tab === 'treats'
      } else if (activeTab === 'frozen' || activeTab === 'wellness') {
        tabMatch = sku.tab === activeTab
      } else {
        tabMatch = sku.tab !== 'frozen' && sku.tab !== 'wellness' && sku.tab !== 'treats' && sku.manufacturer === activeTab
      }

      const animalMatch = animal === 'all' || sku.animal === animal
      const queryMatch =
        !lowerQuery ||
        sku.id.toLowerCase().includes(lowerQuery) ||
        sku.upc.includes(lowerQuery) ||
        sku.name.toLowerCase().includes(lowerQuery)
      const qty = qtyBySku.get(sku.id) ?? 0
      const zeroMatch = hideZeroQty ? qty > 0 : true

      return tabMatch && animalMatch && queryMatch && zeroMatch
    }).slice().sort(compareSkuByNameAndSize)
  }, [sourceSkus, activeTab, animal, query, qtyBySku, hideZeroQty])

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
    () => new Set(lineItems.filter((line) => line.quantity > 0).map((line) => line.skuId)),
    [lineItems],
  )

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
    <div className={cn('min-h-screen p-6', getPageClass(uiMode))}>
      <div className="max-w-[1400px] mx-auto space-y-4">
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
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <section className={cn('rounded-lg border p-5', getSectionClass(uiMode))}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
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
              <label className={cn('ml-auto flex items-center gap-2 text-xs', getMutedTextClass(uiMode))}>
                <input
                  type="checkbox"
                  checked={hideZeroQty}
                  onChange={(event) => setHideZeroQty(event.target.checked)}
                />
                Hide zero qty
              </label>
            </div>

            <div className={cn('mb-3 flex flex-wrap gap-2 border-b pb-3', uiMode === 'dark' ? 'border-[#23314A]' : 'border-amber-200')}>
              {tabOptions.map((tab) => (
                <button
                  key={tab}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs uppercase tracking-wide',
                    activeTab === tab
                      ? (uiMode === 'dark' ? 'border-sky-500 bg-sky-500/20 text-sky-300' : 'border-teal-700 bg-teal-700 text-white')
                      : (uiMode === 'dark' ? 'border-[#25324A] bg-transparent text-slate-400' : 'border-amber-300 bg-amber-50 text-stone-700'),
                  )}
                  onClick={() => setActiveTab(tab)}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className={cn('mb-2 flex items-center gap-2 text-xs', getMutedTextClass(uiMode))}>
              <span>Showing {filteredSkus.length.toLocaleString()} of {sourceSkus.length.toLocaleString()} SKUs</span>
              {catalogQuery.isLoading ? (
                <span className="rounded bg-slate-500/20 px-1.5 py-0.5 text-[10px]">loading…</span>
              ) : catalogSource === 'live' ? (
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">● live</span>
              ) : (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">● mock data</span>
              )}
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className={cn('font-semibold', getMutedTextClass(uiMode))}>Legend:</span>
              <span className={cn('inline-flex rounded border px-2 py-1 font-semibold', getPriorityBadgeClass(uiMode))}>
                PRIORITY
              </span>
            </div>

            <div className={cn('max-h-[64vh] overflow-auto rounded border', uiMode === 'dark' ? 'border-[#25324A]' : 'border-amber-200')}>
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
                  {filteredSkus.map((sku) => {
                    const qty = qtyBySku.get(sku.id) ?? 0
                    const lineTotal = qty * sku.priceCents
                    const isPriority = prioritySkuIds.has(sku.id)
                    return (
                      <tr key={sku.id} className={cn(getTableRowBaseClass(uiMode), getTableAltRowClass(uiMode), isPriority && getPriorityRowClass(uiMode))}>
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
                </tbody>
              </table>
            </div>
          </section>

          <aside className={cn('rounded-lg border p-5', getSectionClass(uiMode))}>
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
                  ? 'Save failed. Changes will retry automatically.'
                  : 'Floor walk lines saved'}
            </p>

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
                className={cn(uiMode === 'dark' && 'border-slate-600 text-slate-200 hover:bg-slate-800')}
                onClick={() => navigate('/')}
              >
                Back to Orders
              </Button>
              <Button onClick={() => navigate(`/orders/${id}`)}>
                Continue to Worksheet
              </Button>
            </div>
          </aside>
        </div>

        <div className={cn('text-xs', getMutedTextClass(uiMode))}>
          Scanner behavior: Add increments qty by 1 each scan. Remove decrements qty by 1 and never goes below zero.
        </div>
      </div>
    </div>
  )
}
