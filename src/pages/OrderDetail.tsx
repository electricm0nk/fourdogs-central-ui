import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { AnimalFilter } from '@/lib/chairSandboxMock'
import { useVendorCatalog } from '@/hooks/use_vendor_catalog'
import {
  compareSkuByNameAndSize,
  getActiveToggleBtnClass,
  getChatBgClass,
  getFooterClass,
  getHotBadgeClass,
  getInactiveToggleBtnClass,
  getInputClass,
  getKayleeBubbleClass,
  getMutedTextClass,
  getOperatorBubbleClass,
  getPageClass,
  getPrototypeSignalLabel,
  getPriorityBadgeClass,
  getPriorityRowClass,
  getQtyConfidenceTier,
  getSectionClass,
  getSignalBadgeClass,
  getTableAltRowClass,
  getTableHeaderClass,
  getTableRowBaseClass,
  getTogglePillClass,
  readUiMode,
  type UiMode,
} from '@/lib/orderGrid'
import { api } from '@/lib/api'
import { useOrder } from '@/hooks/use_order'
import { useSubmitOrder } from '@/hooks/use_order_mutations'
import { buildCatalogTabs, getBrandOptionsForTab, matchesCatalogTab, type CatalogTabKey } from '@/lib/catalogTabs'

type StreamStatus = 'idle' | 'streaming' | 'done' | 'error'

interface ChatMessage {
  id: string
  role: 'operator' | 'kaylee'
  text: string
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

export function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, isLoading } = useOrder(id ?? '')
  const { mutate: submitOrder, isPending } = useSubmitOrder()

  const catalogQuery = useVendorCatalog(order?.vendor_adapter_id)
  const sourceSkus = catalogQuery.data ?? []
  const catalogSource = sourceSkus.length > 0 ? 'live' : 'none'
  const [lineItems, setLineItems] = useState<Array<{ skuId: string; quantity: number }>>([])
  const worksheetEditedRef = useRef(false)
  const [uiMode, setUiMode] = useState<UiMode>(() => readUiMode())

  // Worksheet filter state
  const [activeTab, setActiveTab] = useState<CatalogTabKey>('all')
  const [animal, setAnimal] = useState<AnimalFilter>('all')
  const [hideZeroQty, setHideZeroQty] = useState(false)
  const [onlyZeroQoh, setOnlyZeroQoh] = useState(false)
  const [only111, setOnly111] = useState(false)
  const [hideDoNotReorder, setHideDoNotReorder] = useState(true)
  const [frozenBrand, setFrozenBrand] = useState('all')
  const [foodBrand, setFoodBrand] = useState('all')
  const [treatsBrand, setTreatsBrand] = useState('all')
  const [toysBrand, setToysBrand] = useState('all')
  const [everythingElseBrand, setEverythingElseBrand] = useState('all')
  const [wsQuery, setWsQuery] = useState('')

  // Kaylee recommends panel state
  const [recBudgetPct, setRecBudgetPct] = useState(50)
  const [recTreatsPct, setRecTreatsPct] = useState(25)
  const [recLoading, setRecLoading] = useState(false)

  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle')
  const [kayleeError, setKayleeError] = useState('')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'intro',
      role: 'kaylee',
      text: "Hi, I'm Kaylee. Ask me for guidance on this order and I will stream my response.",
    },
  ])

  const streamRef = useRef<EventSource | null>(null)
  const chatBottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (chatBottomRef.current && typeof chatBottomRef.current.scrollIntoView === 'function') {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('fd-ui-mode', uiMode)
    }
  }, [uiMode])

  const skuMap = useMemo(() => new Map(sourceSkus.map((sku) => [sku.id, sku])), [sourceSkus])

  const floorWalkLinesQuery = useQuery({
    queryKey: ['order-floor-walk-lines', id],
    queryFn: () => api.get<{ data: FloorWalkLinePayload[] }>(`/v1/orders/${id}/floor-walk-lines`),
    select: (res) => res.data,
    enabled: !!id,
  })

  useEffect(() => {
    worksheetEditedRef.current = false
    setLineItems([])
  }, [id])

  // Keep worksheet seeded from floor-walk lines until the user edits locally.
  useEffect(() => {
    if (!floorWalkLinesQuery.isSuccess) return

    if (worksheetEditedRef.current) return

    const floorWalkItems = (floorWalkLinesQuery.data ?? [])
      .filter((line) => line.quantity > 0)
      .map((line) => ({ skuId: line.sku_id, quantity: line.quantity }))

    setLineItems(floorWalkItems)
  }, [floorWalkLinesQuery.isSuccess, floorWalkLinesQuery.data])

  const importedSkuIds = useMemo(
    () => new Set((floorWalkLinesQuery.data ?? []).filter((line) => line.quantity > 0).map((line) => line.sku_id)),
    [floorWalkLinesQuery.data],
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

  const qtyBySku = useMemo(
    () => new Map(lineItems.map((l) => [l.skuId, l.quantity])),
    [lineItems],
  )

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

  const filteredCatalog = useMemo(() => {
    const lq = wsQuery.trim().toLowerCase()
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
      const queryMatch = !lq || sku.id.toLowerCase().includes(lq) || sku.name.toLowerCase().includes(lq)
      const qty = qtyBySku.get(sku.id) ?? 0
      const zeroMatch = hideZeroQty ? qty > 0 : true
      const zeroQohMatch = onlyZeroQoh ? sku.qoh === 0 : true
      const only111Match = only111 ? Number.parseInt(sku.pack, 10) === 111 : true
      const doNotReorderMatch = hideDoNotReorder ? !sku.doNotReorder : true
      return tabMatch && brandMatch && animalMatch && queryMatch && zeroMatch && zeroQohMatch && only111Match && doNotReorderMatch
    }).sort(compareSkuByNameAndSize)
  }, [sourceSkus, activeTab, animal, wsQuery, hideZeroQty, qtyBySku, onlyZeroQoh, only111, hideDoNotReorder, frozenBrand, foodBrand, treatsBrand, toysBrand, everythingElseBrand])

  function tierLabel(tier: 1 | 2 | 3 | 4): string {
    return getPrototypeSignalLabel(tier)
  }

  function applyKayleeRecommendations() {
    if (!order) return
    worksheetEditedRef.current = true
    setRecLoading(true)
    const budget = typeof order.budget_cents === 'number' && order.budget_cents > 0
      ? order.budget_cents
      : 500_000
    const targetCents = Math.floor(budget * (recBudgetPct / 100))
    const treatShare = recTreatsPct / 100
    const velocityRank: Record<string, number> = { fast: 0, medium: 1, slow: 2 }
    const suggestedQty = (v: string) => (v === 'fast' ? 4 : v === 'medium' ? 2 : 1)
    const sorted = [...sourceSkus].sort((a, b) => {
      const vd = (velocityRank[a.velocity] ?? 2) - (velocityRank[b.velocity] ?? 2)
      return vd !== 0 ? vd : a.name.localeCompare(b.name)
    })
    const treatBudget = Math.floor(targetCents * treatShare)
    const mainBudget = targetCents - treatBudget
    const picks: Array<{ skuId: string; quantity: number }> = []
    let spentMain = 0
    let spentTreats = 0
    for (const sku of sorted) {
      const qty = suggestedQty(sku.velocity)
      const cost = sku.priceCents * qty
      if (sku.tab === 'treats') {
        if (spentTreats + cost <= treatBudget) { picks.push({ skuId: sku.id, quantity: qty }); spentTreats += cost }
      } else {
        if (spentMain + cost <= mainBudget) { picks.push({ skuId: sku.id, quantity: qty }); spentMain += cost }
      }
      if (spentMain >= mainBudget && spentTreats >= treatBudget) break
    }
    // Merge: floor walk items keep their qty; recommendations fill the rest
    const existing = new Map(lineItems.map((l) => [l.skuId, l.quantity]))
    for (const pick of picks) {
      if (!existing.has(pick.skuId)) existing.set(pick.skuId, pick.quantity)
    }
    setLineItems(Array.from(existing.entries()).map(([skuId, quantity]) => ({ skuId, quantity })))
    setTimeout(() => setRecLoading(false), 300)
  }

  function cleanupStreams() {
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }
  }

  function formatMoney(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
  }

  function upsertLineQuantity(skuId: string, quantity: number) {
    worksheetEditedRef.current = true
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

  function sanitizeInput(text: string): string {
    return text.trim().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 500)
  }

  async function startLiveStream(operatorText: string) {
    cleanupStreams()
    setStreamStatus('streaming')
    setKayleeError('')

    const candidateRoots = ['', '/dev-api']
    const safeOrderId = order?.id ?? id ?? ''
    if (!safeOrderId) {
      setStreamStatus('error')
      setKayleeError('Order ID is required for live Kaylee chat.')
      return
    }

    let messageResponse: Response | null = null
    let resolvedRoot = ''
    let lastStatus = 0
    let lastErrorMessage = ''

    for (let i = 0; i < candidateRoots.length; i += 1) {
      const root = candidateRoots[i]
      const isLastRoot = i === candidateRoots.length - 1
      const res = await fetch(`${root}/v1/orders/${safeOrderId}/kaylee/message`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: operatorText }),
      })

    try {
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        lastErrorMessage = 'Kaylee returned an unexpected response (not JSON — session may have expired or endpoint is unavailable)'
        if (isLastRoot) {
          throw new Error(lastErrorMessage)
        }
        continue
      }
      if (res.ok) {
        messageResponse = res
        resolvedRoot = root
        break
      }

      lastStatus = res.status
      lastErrorMessage = `POST /kaylee/message failed (HTTP ${res.status}) at ${root || '/'} `
      if (isLastRoot) {
        throw new Error(lastErrorMessage.trim())
      }
    } catch (fetchErr) {
      if (fetchErr instanceof Error) {
        lastErrorMessage = fetchErr.message
      }
      lastStatus = 0
      if (isLastRoot) throw fetchErr
    }
    }

    if (!messageResponse) {
      throw new Error(lastErrorMessage || `POST /kaylee/message failed (HTTP ${lastStatus || 502})`)
    }

    const messageBody = (await messageResponse.json().catch(() => {
      throw new Error('Kaylee returned an unexpected response (not JSON — session may have expired)')
    })) as Record<string, unknown>
    const streamToken =
      (messageBody.stream_token as string | undefined) ||
      ((messageBody.data as Record<string, unknown> | undefined)?.stream_token as string | undefined)

    if (!streamToken) {
      throw new Error('No stream_token returned from Kaylee message endpoint')
    }

    const replyId = `kaylee-${Date.now()}`
    setMessages((prev) => [...prev, { id: replyId, role: 'kaylee', text: '' }])

    const streamUrl = `${resolvedRoot}/v1/orders/${safeOrderId}/kaylee/stream?msg=${encodeURIComponent(streamToken)}`
    const es = new EventSource(streamUrl, { withCredentials: true })
    streamRef.current = es

    es.onmessage = (event) => {
      if (event.data === '[DONE]') {
        setStreamStatus('done')
        es.close()
        streamRef.current = null
        return
      }

      let token = event.data
      try {
        const parsed = JSON.parse(event.data) as Record<string, unknown>
        token = String(parsed.token ?? parsed.delta ?? parsed.content ?? event.data)
      } catch {
        // Keep raw token when backend sends plain text chunks.
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === replyId ? { ...message, text: `${message.text}${token}` } : message,
        ),
      )
    }

    es.onerror = () => {
      setStreamStatus('error')
      setKayleeError('Live Kaylee stream failed. Check session/auth and order ID, then retry.')
      es.close()
      streamRef.current = null
    }
  }

  async function sendKayleeMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (streamStatus === 'streaming') return

    const clean = sanitizeInput(draft)
    if (!clean) return

    setDraft('')
    setMessages((prev) => [...prev, { id: `operator-${Date.now()}`, role: 'operator', text: clean }])

    try {
      await startLiveStream(clean)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send Kaylee message'
      setStreamStatus('error')
      setKayleeError(message)
    }
  }

  if (isLoading || !order) {
    return (
      <div className="min-h-screen bg-amber-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8 text-stone-500">Loading order…</div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen', getPageClass(uiMode))}>
      <header className={cn('sticky top-0 z-20 border-b px-6 py-3 backdrop-blur', uiMode === 'dark' ? 'border-[#23314A] bg-[#101B31]/95' : 'border-amber-200 bg-amber-50/95')}>
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3">
        <Button
            className={uiMode === 'dark' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-[#CE7019] hover:bg-amber-600 text-white'}
            onClick={() => navigate(`/orders/${order.id}/floor-walk`)}>
            ← Return to Floor Walk
          </Button>
          <h1 className="text-lg font-semibold flex-1">{order.vendor_name}</h1>
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
          <span className={cn('text-xs', getMutedTextClass(uiMode))}>Order date: {formatOrderDate(order.order_date)}</span>
          {order.submitted ? (
            <>
              <span className={cn('text-sm italic', getMutedTextClass(uiMode))}>Read-only</span>
              <Badge className={uiMode === 'dark' ? 'bg-emerald-900 text-emerald-200' : 'bg-green-100 text-green-800'}>Submitted</Badge>
              <Button
                disabled={isPending}
                className={uiMode === 'dark' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-[#CE7019] hover:bg-amber-600 text-white'}
                onClick={() => submitOrder({ id: order.id, submitted: false })}
              >
                Unsubmit
              </Button>
            </>
          ) : (
            <>
              <Badge className={uiMode === 'dark' ? 'bg-[#153B2A] text-[#86EFAC]' : 'bg-amber-100 text-amber-800'}>In Progress</Badge>
              <span className={cn('text-xs', getMutedTextClass(uiMode))}>✓ auto-saving</span>
              <Button
                disabled={isPending}
                className={uiMode === 'dark' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-[#CE7019] hover:bg-amber-600 text-white'}
                onClick={() => submitOrder({ id: order.id, submitted: true }, { onSuccess: () => navigate('/') })}
              >
                Return to Orders
              </Button>
            </>
          )}
        </div>
        <div className="mx-auto mt-2 max-w-[1400px] h-1.5 rounded-full bg-gradient-to-r from-[#762123] via-[#006A71] to-[#CE7019]" />
      </header>

      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 p-4 xl:grid-cols-[1fr_360px]">
        <section className={cn('rounded-lg border p-4 shadow-sm', getSectionClass(uiMode))}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">Order Worksheet</h2>
            <span className={cn('text-xs', getMutedTextClass(uiMode))}>Floor walk layout applied</span>
          </div>

          {/* Filter bar */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Input
              value={wsQuery}
              onChange={(e) => setWsQuery(e.target.value)}
              placeholder="Search name or SKU"
              className="max-w-[200px] h-8 text-xs"
            />
            <div className={getTogglePillClass(uiMode)}>
              {(['all', 'dog', 'cat'] as AnimalFilter[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={cn('capitalize', animal === opt ? getActiveToggleBtnClass(uiMode) : getInactiveToggleBtnClass(uiMode))}
                  onClick={() => setAnimal(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
            <label className={cn('ml-auto flex items-center gap-1.5 text-xs', getMutedTextClass(uiMode))}>
              <input type="checkbox" checked={hideZeroQty} onChange={(e) => setHideZeroQty(e.target.checked)} />
              Hide zero qty
            </label>
            <label className={cn('flex items-center gap-1.5 text-xs', getMutedTextClass(uiMode))}>
              <input type="checkbox" checked={onlyZeroQoh} onChange={(e) => setOnlyZeroQoh(e.target.checked)} />
              Zero QoH
            </label>
            <label className={cn('flex items-center gap-1.5 text-xs', getMutedTextClass(uiMode))}>
              <input type="checkbox" checked={only111} onChange={(e) => setOnly111(e.target.checked)} />
              111
            </label>
            <label className={cn('flex items-center gap-1.5 text-xs', getMutedTextClass(uiMode))}>
              <input type="checkbox" checked={hideDoNotReorder} onChange={(e) => setHideDoNotReorder(e.target.checked)} />
              Hide Do Not Reorder
            </label>
          </div>

          {/* Tab pills */}
          <div className={cn('mb-2 flex flex-wrap gap-1.5 border-b pb-2', uiMode === 'dark' ? 'border-[#23314A]' : 'border-amber-200')}>
            {tabOptions.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={cn(
                  'rounded-full border px-3 py-0.5 text-xs uppercase tracking-wide',
                  activeTab === tab.key
                    ? (uiMode === 'dark' ? 'border-sky-500 bg-sky-500/20 text-sky-300' : 'border-teal-700 bg-teal-700 text-white')
                    : (uiMode === 'dark' ? 'border-[#25324A] bg-transparent text-slate-400' : 'border-amber-300 bg-amber-50 text-stone-700'),
                )}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'food' && (
            <div className="mb-2 flex items-center gap-2 text-xs">
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
            <div className="mb-2 flex items-center gap-2 text-xs">
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
            <div className="mb-2 flex items-center gap-2 text-xs">
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
            <div className="mb-2 flex items-center gap-2 text-xs">
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
            <div className="mb-2 flex items-center gap-2 text-xs">
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

          <div className={cn('mb-1 flex items-center gap-2 text-xs', getMutedTextClass(uiMode))}>
            <span>Showing {filteredCatalog.length.toLocaleString()} of {sourceSkus.length.toLocaleString()} SKUs</span>
            {catalogQuery.isLoading ? (
              <span className="rounded bg-slate-500/20 px-1.5 py-0.5 text-[10px]">loading…</span>
            ) : catalogSource === 'live' ? (
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">● live</span>
            ) : (
              <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400">● no live data</span>
            )}
          </div>

          {!catalogQuery.isLoading && sourceSkus.length === 0 && (
            <div className={cn('mb-2 rounded border px-3 py-2 text-xs', uiMode === 'dark' ? 'border-red-800 bg-red-950/30 text-red-200' : 'border-red-200 bg-red-50 text-red-700')}>
              Worksheet requires live catalog data from central. No mock fallback is used here.
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className={cn('font-semibold', getMutedTextClass(uiMode))}>Legend:</span>
            <span className={cn('inline-flex rounded border px-2 py-1 font-semibold', getHotBadgeClass(uiMode))}>
              HOT
            </span>
            {[1, 2, 3, 4].map((tier) => (
              <span
                key={tier}
                className={cn('inline-flex rounded border px-2 py-1 font-semibold', getSignalBadgeClass(tier as 1 | 2 | 3 | 4, uiMode))}
              >
                {tierLabel(tier as 1 | 2 | 3 | 4)}
              </span>
            ))}
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
                    <th className="px-2 py-2 text-right">Signal</th>
                  <th className="px-2 py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredCatalog.map((sku) => {
                  const qty = qtyBySku.get(sku.id) ?? 0
                  const lineTotal = sku.priceCents * qty
                  const tier = getQtyConfidenceTier(qty)
                  const isPriority = importedSkuIds.has(sku.id)

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
                            disabled={order.submitted}
                            aria-label={`Decrease ${sku.id}`}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={qty}
                            className={cn('w-16 text-center text-sm', getInputClass(uiMode))}
                            onChange={(event) => upsertLineQuantity(sku.id, Math.max(0, Number(event.target.value) || 0))}
                            disabled={order.submitted}
                          />
                          <button
                            type="button"
                            className={cn('h-10 w-10 rounded border text-lg font-bold', uiMode === 'dark' ? 'border-[#334155] bg-[#1E293B] text-slate-200 active:bg-[#0B1424]' : 'border-amber-300 bg-amber-50 text-stone-700 active:bg-amber-100')}
                            onClick={() => upsertLineQuantity(sku.id, qty + 1)}
                            disabled={order.submitted}
                            aria-label={`Increase ${sku.id}`}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-1 text-right">
                        {sku.velocity === 'fast' && (
                          <span className={cn('inline-flex rounded border px-2 py-1 text-[10px] font-semibold', getHotBadgeClass(uiMode))}>
                            HOT
                          </span>
                        )}
                        <span className={cn('ml-1 inline-flex rounded border px-2 py-1 text-[10px] font-semibold', getSignalBadgeClass(tier, uiMode))}>
                          {tierLabel(tier)}
                        </span>
                        {isPriority && (
                          <span className={cn('ml-1 inline-flex rounded border px-2 py-1 text-[10px] font-semibold', getPriorityBadgeClass(uiMode))}>
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

          <p className={cn('mt-2 text-xs', getMutedTextClass(uiMode))}>
            Floor walk quantities are pre-filled. Adjust or add any SKUs on this worksheet.
          </p>
        </section>

        <aside className={cn('rounded-lg border p-4 shadow-sm', getSectionClass(uiMode))}>
          {/* ── Kaylee Recommends ── */}
          <div className={cn('mb-4 rounded-lg border p-3', uiMode === 'dark' ? 'border-[#23314A] bg-[#0A182A]' : 'border-amber-200 bg-amber-50')}>
            <h3 className="mb-2 text-sm font-semibold">Kaylee Recommends</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
              <label className={cn('shrink-0', getMutedTextClass(uiMode))}>% Budget</label>
              <input
                type="number"
                min={1}
                max={100}
                value={recBudgetPct}
                onChange={(e) => setRecBudgetPct(Math.min(100, Math.max(1, Number(e.target.value) || 50)))}
                className={cn('w-16 text-center', getInputClass(uiMode))}
              />
              <label className={cn('shrink-0', getMutedTextClass(uiMode))}>% Treats</label>
              <input
                type="number"
                min={0}
                max={100}
                value={recTreatsPct}
                onChange={(e) => setRecTreatsPct(Math.min(100, Math.max(0, Number(e.target.value) || 25)))}
                className={cn('w-16 text-center', getInputClass(uiMode))}
              />
            </div>
            <button
              type="button"
              disabled={recLoading}
              onClick={applyKayleeRecommendations}
              className={cn(
                'mt-2 w-full rounded border px-3 py-1.5 text-xs font-semibold transition-colors',
                recLoading ? 'opacity-50 cursor-wait' : '',
                uiMode === 'dark'
                  ? 'border-sky-600 bg-sky-700/30 text-sky-300 hover:bg-sky-700/50'
                  : 'border-teal-600 bg-teal-600 text-white hover:bg-teal-700',
              )}
            >
              {recLoading ? 'Loading…' : 'Load Recommendations'}
            </button>
            <p className={cn('mt-1 text-[10px]', getMutedTextClass(uiMode))}>
              Adds fast-mover recommendations to floor walk items without overwriting existing quantities.
            </p>
          </div>

          <h2 className="mb-3 text-base font-semibold">Kaylee Assistant</h2>

          <div className="mb-2 flex items-center gap-2">
            <span className={cn('text-xs', getMutedTextClass(uiMode))}>Chat mode: live</span>
            <span className={cn('ml-auto text-xs', getMutedTextClass(uiMode))}>Status: {streamStatus}</span>
          </div>

          {kayleeError && <p className="mt-2 rounded bg-rose-50 p-2 text-xs text-rose-700">{kayleeError}</p>}

          <div className={cn('mt-3 h-[240px] min-h-[180px] max-h-[560px] resize-y overflow-y-auto rounded border p-2', getChatBgClass(uiMode))}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'mb-2 max-w-[90%] rounded px-2 py-2 text-xs',
                  message.role === 'operator'
                    ? getOperatorBubbleClass(uiMode)
                    : getKayleeBubbleClass(uiMode),
                )}
              >
                {message.text || (streamStatus === 'streaming' && message.role === 'kaylee' ? '...' : '')}
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          <form className="mt-2 flex gap-2" onSubmit={sendKayleeMessage}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={500}
              placeholder="Ask Kaylee (live endpoint)"
              className={cn('flex-1 text-xs', getInputClass(uiMode))}
              disabled={streamStatus === 'streaming'}
            />
            <Button type="submit" size="sm" disabled={!draft.trim() || streamStatus === 'streaming'}>
              Send
            </Button>
          </form>
        </aside>
      </main>

      <footer className={cn('sticky bottom-0 z-20 px-6 py-3', getFooterClass(uiMode))}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between text-sm">
          <span>Running total (always visible)</span>
          <strong className="text-base">{formatMoney(runningTotalCents)}</strong>
        </div>
      </footer>
    </div>
  )
}
