import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useParams, useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
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
  isHotVelocity,
  getKayleeBubbleClass,
  getMutedTextClass,
  getOperatorBubbleClass,
  getPageClass,
  getPrototypeSignalLabel,
  getPriorityBadgeClass,
  getPriorityRowClass,
  getSectionClass,
  getSignalBadgeClass,
  getTableAltRowClass,
  getTableHeaderClass,
  getTableRowBaseClass,
  getTogglePillClass,
  getWorksheetSignals,
  readUiMode,
  type UiMode,
  type WorksheetSignal,
} from '@/lib/orderGrid'
import { api } from '@/lib/api'
import { buildKayleeStreamUrl, getDevSessionId } from '@/lib/kayleeStream'
import { useOrder } from '@/hooks/use_order'
import { useSubmitOrder } from '@/hooks/use_order_mutations'
import { buildCatalogTabs, getBrandOptionsForTab, matchesCatalogTab, type CatalogTabKey } from '@/lib/catalogTabs'
import { useVendorAdapters } from '@/hooks/use_vendor_adapters'
import { useVersions, formatWiringVersion } from '@/hooks/use_versions'
import { loadQohOverrides, saveQohOverrides } from '@/lib/qohOverrides'

type StreamStatus = 'idle' | 'streaming' | 'done' | 'error'

const TABLE_ROW_HEIGHT_PX = 56
const TABLE_OVERSCAN_ROWS = 10

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

interface SuggestionRecord {
  request_number: number
  username: string
  suggestion: string
  status: string
  submitted_at: string
}

type SignalFilterKey = 'hot' | WorksheetSignal | 'priority'

interface WorksheetLineItem {
  skuId: string
  quantity: number
  locked: boolean
  kayleeQty?: number
}

/**
 * Returns a Tailwind class string for the risk badge based on score.
 * 80-100: Red (CRITICAL), 60-79: Orange (HIGH), 40-59: Yellow (MEDIUM),
 * 20-39: Light green (LOW), 0-19: Green (SAFE)
 */
function getRiskBadgeClass(score: number, uiMode: UiMode): string {
  if (score >= 80) {
    return uiMode === 'dark'
      ? 'border border-red-700 bg-red-900/40 text-red-300'
      : 'border border-red-300 bg-red-100 text-red-800'
  }
  if (score >= 60) {
    return uiMode === 'dark'
      ? 'border border-orange-700 bg-orange-900/40 text-orange-300'
      : 'border border-orange-300 bg-orange-100 text-orange-800'
  }
  if (score >= 40) {
    return uiMode === 'dark'
      ? 'border border-yellow-700 bg-yellow-900/30 text-yellow-300'
      : 'border border-yellow-300 bg-yellow-100 text-yellow-800'
  }
  if (score >= 20) {
    return uiMode === 'dark'
      ? 'border border-green-800 bg-green-900/30 text-green-400'
      : 'border border-green-300 bg-green-100 text-green-700'
  }
  return uiMode === 'dark'
    ? 'border border-emerald-800 bg-emerald-900/30 text-emerald-400'
    : 'border border-emerald-300 bg-emerald-100 text-emerald-700'
}

function formatOrderDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}


const SUCCESS_DURATION_MS = 3000

function ExportButton({ orderId, label }: { orderId: string; label: string }) {
  const [exportSuccess, setExportSuccess] = useState(false)

  const handleExport = useCallback(async () => {
    const resp = await fetch(`/v1/orders/${orderId}/export/csv`, { credentials: 'include' })
    if (!resp.ok) return
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = resp.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'order-export.csv'
    a.click()
    URL.revokeObjectURL(url)
    setExportSuccess(true)
    setTimeout(() => setExportSuccess(false), SUCCESS_DURATION_MS)
  }, [orderId])

  return (
    <Button variant="outline" onClick={handleExport}>
      {exportSuccess ? '✓ Downloaded' : label}
    </Button>
  )
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, isLoading, isError, error } = useOrder(id ?? '')
  const { mutate: submitOrder, isPending } = useSubmitOrder()
  const { data: vendorAdapters } = useVendorAdapters()
  const adapterType = vendorAdapters?.find((a) => a.id === order?.vendor_adapter_id)?.adapter_type ?? ''
  const { data: versionsData } = useVersions()
  const wiringVersion = formatWiringVersion(versionsData)

  const catalogQuery = useVendorCatalog(order?.vendor_id, order?.vendor_adapter_id)
  const sourceSkus = catalogQuery.data ?? []
  const catalogSource = sourceSkus.length > 0 ? 'live' : 'none'
  const [lineItems, setLineItems] = useState<WorksheetLineItem[]>([])
  const [qohOverrides, setQohOverrides] = useState<Record<string, number>>(() => loadQohOverrides(id))
  const worksheetEditedRef = useRef(false)
  const [uiMode, setUiMode] = useState<UiMode>(() => readUiMode())

  // Worksheet filter state
  const [activeTab, setActiveTab] = useState<CatalogTabKey>('all')
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
  const [wsQuery, setWsQuery] = useState('')
  const [selectedSignalFilters, setSelectedSignalFilters] = useState<SignalFilterKey[]>([])
  const [selectedSideBrand, setSelectedSideBrand] = useState<string | null>(null)
  const [leftWingOpen, setLeftWingOpen] = useState(false)
  const [rightWingOpen, setRightWingOpen] = useState(false)
  const [suggestionText, setSuggestionText] = useState('')

  // Kaylee recommends panel state
  const [recBudgetPct, setRecBudgetPct] = useState(50)
  const [recTreatsPct, setRecTreatsPct] = useState(25)
  const [recLoading, setRecLoading] = useState(false)

  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle')
  const [kayleeError, setKayleeError] = useState('')
  const [draft, setDraft] = useState('')
  const worksheetViewportRef = useRef<HTMLDivElement | null>(null)
  const [worksheetScrollTop, setWorksheetScrollTop] = useState(0)
  const [worksheetViewportHeight, setWorksheetViewportHeight] = useState(600)
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

  useEffect(() => {
    setQohOverrides(loadQohOverrides(id))
  }, [id])

  useEffect(() => {
    saveQohOverrides(id, qohOverrides)
  }, [id, qohOverrides])

  useEffect(() => {
    function updateViewportHeight() {
      if (!worksheetViewportRef.current) return
      setWorksheetViewportHeight(worksheetViewportRef.current.clientHeight)
    }

    updateViewportHeight()
    window.addEventListener('resize', updateViewportHeight)
    return () => window.removeEventListener('resize', updateViewportHeight)
  }, [])

  const skuMap = useMemo(() => new Map(sourceSkus.map((sku) => [sku.id, sku])), [sourceSkus])

  const floorWalkLinesQuery = useQuery({
    queryKey: ['order-floor-walk-lines', id],
    queryFn: () => api.get<{ data: FloorWalkLinePayload[] }>(`/v1/orders/${id}/floor-walk-lines`),
    select: (res) => res.data,
    enabled: !!id,
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

  const saveFloorWalkLines = useMutation({
    mutationFn: (lines: FloorWalkLinePayload[]) =>
      api.put<{ data: { saved: boolean } }>(`/v1/orders/${id}/floor-walk-lines`, { lines }),
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
      .map((line) => ({ skuId: line.sku_id, quantity: line.quantity, locked: false }))

    setLineItems(floorWalkItems)
  }, [floorWalkLinesQuery.isSuccess, floorWalkLinesQuery.data])

  // Debounced autosave — fires 600ms after the last line-item change.
  useEffect(() => {
    if (!worksheetEditedRef.current) return
    if (!id) return

    const timer = setTimeout(() => {
      const lines: FloorWalkLinePayload[] = lineItems.map((item) => ({
        sku_id: item.skuId,
        item_upc: skuMap.get(item.skuId)?.upc ?? '',
        quantity: item.quantity,
      }))
      saveFloorWalkLines.mutate(lines)
    }, 600)

    return () => clearTimeout(timer)
  }, [lineItems, id])  // eslint-disable-line react-hooks/exhaustive-deps

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

  const lockedTotalCents = useMemo(
    () =>
      lineItems.reduce((sum, item) => {
        if (!item.locked) return sum
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
  const effectiveQohBySku = useMemo(
    () => new Map(sourceSkus.map((sku) => [sku.id, qohOverrides[sku.id] ?? sku.qoh])),
    [sourceSkus, qohOverrides],
  )

  const lockedBySku = useMemo(
    () => new Map(lineItems.map((l) => [l.skuId, l.locked])),
    [lineItems],
  )

  const kayleeQtyBySku = useMemo(
    () => new Map(lineItems.filter((l) => l.kayleeQty !== undefined).map((l) => [l.skuId, l.kayleeQty as number])),
    [lineItems],
  )
  const editedQohLines = useMemo(
    () => sourceSkus
      .filter((sku) => qohOverrides[sku.id] !== undefined)
      .map((sku) => ({
        systemId: sku.id,
        upc: sku.upc,
        name: sku.name,
        qoh: qohOverrides[sku.id] as number,
      })),
    [sourceSkus, qohOverrides],
  )
  const hasKayleeRecommendations = useMemo(
    () => lineItems.some((line) => line.kayleeQty !== undefined),
    [lineItems],
  )

  const tabOptions = useMemo(() => buildCatalogTabs(sourceSkus), [sourceSkus])
  const frozenBrandOptions = useMemo(() => getBrandOptionsForTab(sourceSkus, 'frozen'), [sourceSkus])
  const foodBrandOptions = useMemo(() => getBrandOptionsForTab(sourceSkus, 'food'), [sourceSkus])
  const treatsBrandOptions = useMemo(() => getBrandOptionsForTab(sourceSkus, 'treats'), [sourceSkus])
  const toysBrandOptions = useMemo(() => getBrandOptionsForTab(sourceSkus, 'toys'), [sourceSkus])
  const everythingElseBrandOptions = useMemo(() => getBrandOptionsForTab(sourceSkus, 'everything-else'), [sourceSkus])
  const allBrands = useMemo(
    () => Array.from(new Set(sourceSkus.map((sku) => sku.manufacturer?.trim()).filter((brand): brand is string => Boolean(brand)))).sort((a, b) => a.localeCompare(b)),
    [sourceSkus],
  )

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
      const queryMatch = !lq || sku.id.toLowerCase().includes(lq) || sku.name.toLowerCase().includes(lq) || sku.manufacturer.toLowerCase().includes(lq)
      const qty = qtyBySku.get(sku.id) ?? 0
      const zeroMatch = hideZeroQty ? qty > 0 : true
      const effectiveQoh = effectiveQohBySku.get(sku.id) ?? sku.qoh
      const zeroQohMatch = onlyZeroQoh ? effectiveQoh === 0 : true
      const only111Match = only111 ? Number.parseInt(sku.pack, 10) === 111 : true
      const doNotReorderMatch = hideDoNotReorder ? !sku.doNotReorder : true
      const isPriority = importedSkuIds.has(sku.id)
      const signals = getWorksheetSignals(qty, kayleeQtyBySku.get(sku.id))
      const signalMatch = selectedSignalFilters.every((filter) => {
        if (filter === 'hot') return isHotVelocity(sku.velocity)
        if (filter === 'priority') return isPriority
        return signals.includes(filter)
      })

      return tabMatch && brandMatch && animalMatch && queryMatch && zeroMatch && zeroQohMatch && only111Match && doNotReorderMatch && signalMatch
    }).sort(compareSkuByNameAndSize)
  }, [sourceSkus, activeTab, animal, wsQuery, hideZeroQty, qtyBySku, kayleeQtyBySku, effectiveQohBySku, onlyZeroQoh, only111, hideDoNotReorder, frozenBrand, foodBrand, treatsBrand, toysBrand, everythingElseBrand, importedSkuIds, selectedSignalFilters])

  const visibleWorksheetRange = useMemo(() => {
    const total = filteredCatalog.length
    const startIndex = Math.max(0, Math.floor(worksheetScrollTop / TABLE_ROW_HEIGHT_PX) - TABLE_OVERSCAN_ROWS)
    const endIndex = Math.min(
      total,
      Math.ceil((worksheetScrollTop + worksheetViewportHeight) / TABLE_ROW_HEIGHT_PX) + TABLE_OVERSCAN_ROWS,
    )

    return {
      startIndex,
      endIndex,
      topSpacerHeight: startIndex * TABLE_ROW_HEIGHT_PX,
      bottomSpacerHeight: Math.max(0, (total - endIndex) * TABLE_ROW_HEIGHT_PX),
      rows: filteredCatalog.slice(startIndex, endIndex),
    }
  }, [filteredCatalog, worksheetScrollTop, worksheetViewportHeight])

  useEffect(() => {
    setWorksheetScrollTop(0)
    worksheetViewportRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [
    activeTab,
    animal,
    wsQuery,
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
    selectedSignalFilters,
  ])

  function toggleSignalFilter(filter: SignalFilterKey) {
    setSelectedSignalFilters((prev) => (prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]))
  }

  function signalLabel(signal: WorksheetSignal): string {
    return getPrototypeSignalLabel(signal)
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
    const sorted = [...sourceSkus]
      .filter((sku) =>
        (sku.suggestedQty !== undefined && sku.suggestedQty > 0) ||
        (sku.riskScore != null && sku.riskScore > 0)
      )
      .sort((a, b) => {
        const vd = (velocityRank[a.velocity] ?? 2) - (velocityRank[b.velocity] ?? 2)
        return vd !== 0 ? vd : a.name.localeCompare(b.name)
      })
    const treatBudget = Math.floor(targetCents * treatShare)
    const mainBudget = targetCents - treatBudget
    const picks: Array<{ skuId: string; quantity: number }> = []
    let spentMain = 0
    let spentTreats = 0
    for (const sku of sorted) {
      const qty = (sku.suggestedQty !== undefined && sku.suggestedQty > 0)
        ? sku.suggestedQty
        : (parseInt(sku.pack, 10) || 1)
      const cost = sku.priceCents * qty
      if (sku.tab === 'treats') {
        if (spentTreats + cost <= treatBudget) { picks.push({ skuId: sku.id, quantity: qty }); spentTreats += cost }
      } else {
        if (spentMain + cost <= mainBudget) { picks.push({ skuId: sku.id, quantity: qty }); spentMain += cost }
      }
      if (spentMain >= mainBudget && spentTreats >= treatBudget) break
    }
    // Merge: floor walk items keep their qty; recommendations fill the rest
    setLineItems((prev) => {
      const existing = new Map(prev.map((l) => [l.skuId, l]))
      for (const pick of picks) {
        const current = existing.get(pick.skuId)
        if (!current) {
          existing.set(pick.skuId, { skuId: pick.skuId, quantity: pick.quantity, locked: false, kayleeQty: pick.quantity })
          continue
        }

        if (current.locked) {
          continue
        }

        if (current.quantity <= 0) {
          existing.set(pick.skuId, {
            ...current,
            quantity: pick.quantity,
            kayleeQty: pick.quantity,
          })
        }
      }
      return Array.from(existing.values())
    })
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
        if (prev[existingIndex].locked) return prev
        const copy = [...prev]
        if (nextQty === 0) {
          copy.splice(existingIndex, 1)
        } else {
          copy[existingIndex] = { ...copy[existingIndex], quantity: nextQty }
        }
        return copy
      }

      if (nextQty === 0) return prev
      return [...prev, { skuId, quantity: nextQty, locked: false }]
    })
  }

  function toggleLineLocked(skuId: string, locked: boolean) {
    worksheetEditedRef.current = true
    setLineItems((prev) => {
      const existingIndex = prev.findIndex((line) => line.skuId === skuId)
      if (existingIndex >= 0) {
        const copy = [...prev]
        copy[existingIndex] = { ...copy[existingIndex], locked }
        return copy
      }
      if (!locked) return prev
      return [...prev, { skuId, quantity: 0, locked: true }]
    })
  }

  function sanitizeInput(text: string): string {
    return text.trim().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 500)
  }

  function upsertQoh(skuId: string, nextQoh: number, baseQoh: number) {
    const safeQoh = Math.max(0, nextQoh)
    setQohOverrides((prev) => {
      if (safeQoh === baseQoh) {
        const { [skuId]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [skuId]: safeQoh }
    })
  }

  async function handleExportQoh() {
    if (!order || editedQohLines.length === 0) return
    const orderTitle = `${order.vendor_name ?? 'Order'} - ${formatOrderDate(order.order_date)}`
    const { exportQohXlsx } = await import('@/lib/exportXlsx')
    await exportQohXlsx(editedQohLines, orderTitle)
  }

  function removeKayleeRecommendations() {
    const persistedQtyBySku = new Map(
      (floorWalkLinesQuery.data ?? []).map((line) => [line.sku_id, line.quantity]),
    )

    worksheetEditedRef.current = true
    setLineItems((prev) => prev.flatMap((line) => {
      if (line.kayleeQty === undefined) return [line]

      const persistedQty = persistedQtyBySku.get(line.skuId) ?? 0
      if (persistedQty > 0) {
        return [{
          ...line,
          quantity: persistedQty,
          kayleeQty: undefined,
        }]
      }

      return [{
        ...line,
        quantity: 0,
        kayleeQty: undefined,
      }]
    }))
  }

  async function handleSuggestionSubmit() {
    const trimmed = suggestionText.trim()
    if (!trimmed || trimmed.length > 4096) return
    await createSuggestion.mutateAsync({ suggestion: trimmed })
  }

  async function startLiveStream(operatorText: string) {
    cleanupStreams()
    setStreamStatus('streaming')
    setKayleeError('')

    const candidateRoots = ['', '/dev-api']
    const safeOrderId = order?.id ?? id ?? ''
    const devSessionId = getDevSessionId()
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
          ...(devSessionId ? { 'x-dev-session-id': devSessionId } : {}),
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

    const streamUrl = buildKayleeStreamUrl(resolvedRoot, safeOrderId, streamToken)
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-amber-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8 text-stone-500">Loading order…</div>
        </div>
      </div>
    )
  }

  if (isError || !order) {
    const message = error instanceof Error ? error.message : 'The order could not be loaded.'

    return (
      <div className="min-h-screen bg-amber-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-10 space-y-3">
          <div className="text-stone-700 font-semibold">Unable to load this order.</div>
          <div className="text-sm text-stone-500">{message}</div>
          <Button
            className="bg-[#CE7019] hover:bg-amber-600 text-white"
            onClick={() => navigate('/')}
          >
            Return to Orders
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex h-screen flex-col overflow-hidden', getPageClass(uiMode))}>
      <header className={cn('sticky top-0 z-20 border-b px-6 py-3 backdrop-blur', uiMode === 'dark' ? 'border-[#23314A] bg-[#101B31]/95' : 'border-amber-200 bg-amber-50/95')}>
        <div className="flex flex-wrap items-center gap-3">
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
            <button
              type="button"
              title="Toggle brand wing"
              className={cn('rounded-md border px-2 py-1 text-xs font-semibold', uiMode === 'dark' ? 'border-[#334155] bg-[#13233C] text-slate-200' : 'border-amber-300 bg-white text-stone-700')}
              onClick={() => setLeftWingOpen((v) => !v)}
              aria-label="Toggle brand wing"
            >
              Brands {leftWingOpen ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              title="Toggle suggestion wing"
              className={cn('rounded-md border px-2 py-1 text-xs font-semibold', uiMode === 'dark' ? 'border-[#334155] bg-[#13233C] text-slate-200' : 'border-amber-300 bg-white text-stone-700')}
              onClick={() => setRightWingOpen((v) => !v)}
              aria-label="Toggle suggestion wing"
            >
              Suggestions {rightWingOpen ? 'On' : 'Off'}
            </button>
          </div>
          <span className={cn('text-xs', getMutedTextClass(uiMode))}>Order date: {formatOrderDate(order.order_date)}</span>
          {wiringVersion && (
            <span
              title="Velocity wiring version in use for this session"
              className={cn('text-xs font-mono opacity-60', getMutedTextClass(uiMode))}
            >
              v{wiringVersion}
            </span>
          )}
          {order.submitted ? (
            <>
              <span className={cn('text-sm italic', getMutedTextClass(uiMode))}>Read-only</span>
              <Badge className={uiMode === 'dark' ? 'bg-emerald-900 text-emerald-200' : 'bg-green-100 text-green-800'}>Submitted</Badge>
              <ExportButton orderId={order.id} label="Export CSV" />
              {adapterType === 'etailpet' && (
                <ExportButton orderId={order.id} label="Export EtailPet" />
              )}
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
                onClick={() => navigate('/')}
              >
                Return to Orders
              </Button>
            </>
          )}
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-gradient-to-r from-[#762123] via-[#006A71] to-[#CE7019]" />
      </header>

      <main
        className={cn(
          'grid h-full min-h-0 flex-1 grid-cols-1 gap-4 p-4 overflow-hidden',
          leftWingOpen && rightWingOpen
            ? 'xl:grid-cols-[18rem_minmax(0,1fr)_minmax(300px,24vw)_24rem]'
            : leftWingOpen
              ? 'xl:grid-cols-[18rem_minmax(0,1fr)_minmax(300px,24vw)]'
              : rightWingOpen
                ? 'xl:grid-cols-[minmax(0,1fr)_minmax(300px,24vw)_24rem]'
                : 'xl:grid-cols-[minmax(0,1fr)_minmax(300px,24vw)]',
        )}
      >
        {leftWingOpen && (
          <aside className={cn('min-h-0 overflow-auto rounded-lg border p-4', getSectionClass(uiMode))}>
            <h3 className="text-sm font-semibold">Brand Filters</h3>
            <p className={cn('mt-1 text-xs', getMutedTextClass(uiMode))}>All brands currently available for filtering.</p>
            <div className="mt-3 overflow-auto rounded border p-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('all')
                  setWsQuery('')
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
                      setWsQuery('')
                      return
                    }
                    setSelectedSideBrand(brand)
                    setWsQuery(brand)
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
        )}

        <section className={cn('flex min-h-0 flex-col rounded-lg border p-4 shadow-sm', getSectionClass(uiMode))}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">Order Worksheet</h2>
            <span className={cn('text-xs', getMutedTextClass(uiMode))}>Floor walk layout applied</span>
          </div>

          {/* Filter bar */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Input
              value={wsQuery}
              onChange={(e) => {
                setWsQuery(e.target.value)
                setSelectedSideBrand(null)
              }}
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
            <label className={cn('flex items-center gap-1.5 text-xs', getMutedTextClass(uiMode))}>
              <input type="checkbox" checked={hideTabs} onChange={(e) => setHideTabs(e.target.checked)} />
              Hide tabs
            </label>
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

          {!hideTabs && (
            <>
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
            </>
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
            <button
              type="button"
              onClick={() => toggleSignalFilter('hot')}
              aria-pressed={selectedSignalFilters.includes('hot')}
              className={cn(
                'inline-flex rounded border px-2 py-1 font-semibold',
                selectedSignalFilters.includes('hot') ? getHotBadgeClass(uiMode) : (uiMode === 'dark' ? 'border-[#334155] text-slate-300' : 'border-amber-300 text-stone-600'),
              )}
            >
              HOT
            </button>
            {(['increased', 'kaylee', 'decreased'] as WorksheetSignal[]).map((signal) => (
              <button
                key={signal}
                type="button"
                onClick={() => toggleSignalFilter(signal)}
                aria-pressed={selectedSignalFilters.includes(signal)}
                className={cn(
                  'inline-flex rounded border px-2 py-1 font-semibold',
                  selectedSignalFilters.includes(signal)
                    ? getSignalBadgeClass(signal, uiMode)
                    : (uiMode === 'dark' ? 'border-[#334155] text-slate-300' : 'border-amber-300 text-stone-600'),
                )}
              >
                {signalLabel(signal)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => toggleSignalFilter('priority')}
              aria-pressed={selectedSignalFilters.includes('priority')}
              className={cn(
                'inline-flex rounded border px-2 py-1 font-semibold',
                selectedSignalFilters.includes('priority')
                  ? getPriorityBadgeClass(uiMode)
                  : (uiMode === 'dark' ? 'border-[#334155] text-slate-300' : 'border-amber-300 text-stone-600'),
              )}
            >
              PRIORITY
            </button>
          </div>

          <div
            ref={worksheetViewportRef}
            onScroll={(event) => {
              setWorksheetScrollTop(event.currentTarget.scrollTop)
              setWorksheetViewportHeight(event.currentTarget.clientHeight)
            }}
            className={cn('min-h-0 flex-1 overflow-auto rounded border', uiMode === 'dark' ? 'border-[#25324A]' : 'border-amber-200')}
          >
            <table className="w-full min-w-[1120px] border-collapse text-xs">
              <thead className={cn('sticky top-0 z-10', getTableHeaderClass(uiMode))}>
                <tr>
                  <th className="px-2 py-2 text-left">Lock</th>
                  <th className="px-2 py-2 text-left">Product</th>
                  <th className="px-2 py-2 text-left">Pack</th>
                  <th className="px-2 py-2 text-right">
                    <div className="flex flex-col items-end gap-1">
                      {editedQohLines.length > 0 && (
                        <button
                          type="button"
                          onClick={handleExportQoh}
                          className={cn(
                            'rounded border px-2 py-1 text-[10px] font-semibold transition-colors',
                            uiMode === 'dark'
                              ? 'border-sky-600 bg-sky-700/30 text-sky-300 hover:bg-sky-700/50'
                              : 'border-teal-600 bg-teal-600 text-white hover:bg-teal-700',
                          )}
                        >
                          Export QoH XLSX
                        </button>
                      )}
                      <span>QOH</span>
                    </div>
                  </th>
                  <th className="px-2 py-2 text-right" title="Days of supply: estimated days until stockout at current sales velocity">DOS (days)</th>
                  <th className="px-2 py-2 text-right" title="Composite inventory risk score (0–100): combines velocity, days of supply, and customer replenishment urgency">Risk %</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Signal</th>
                  <th className="px-2 py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {visibleWorksheetRange.topSpacerHeight > 0 && (
                  <tr>
                    <td colSpan={10} style={{ height: visibleWorksheetRange.topSpacerHeight }} />
                  </tr>
                )}
                {visibleWorksheetRange.rows.map((sku) => {
                  const qty = qtyBySku.get(sku.id) ?? 0
                  const isLocked = lockedBySku.get(sku.id) ?? false
                  const lineTotal = sku.priceCents * qty
                  const isPriority = importedSkuIds.has(sku.id)
                  const signals = getWorksheetSignals(qty, kayleeQtyBySku.get(sku.id))

                  return (
                    <tr
                      key={sku.id}
                      style={{ height: TABLE_ROW_HEIGHT_PX }}
                      className={cn(getTableRowBaseClass(uiMode), getTableAltRowClass(uiMode), isPriority && getPriorityRowClass(uiMode))}
                    >
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={isLocked}
                          onChange={(event) => toggleLineLocked(sku.id, event.target.checked)}
                          aria-label={`Lock ${sku.id}`}
                        />
                      </td>
                      <td className="px-2 py-1">{sku.name}</td>
                      <td className="px-2 py-1">{sku.pack}</td>
                      <td className="px-2 py-1 text-right">
                        <input
                          type="number"
                          min={0}
                          value={effectiveQohBySku.get(sku.id) ?? sku.qoh}
                          className={cn('w-16 text-center text-sm', getInputClass(uiMode))}
                          onChange={(event) => upsertQoh(sku.id, Number(event.target.value) || 0, sku.qoh)}
                          disabled={order.submitted}
                          aria-label={`QOH ${sku.id}`}
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        {sku.dosDays != null ? sku.dosDays : <span className={cn('opacity-40', getMutedTextClass(uiMode))}>—</span>}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {sku.riskScore != null ? (
                          <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold', getRiskBadgeClass(sku.riskScore, uiMode))}>
                            {sku.riskScore}%
                          </span>
                        ) : (
                          <span className={cn('opacity-40', getMutedTextClass(uiMode))}>—</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">{formatMoney(sku.priceCents)}</td>
                      <td className="px-2 py-1 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className={cn('h-10 w-10 rounded border text-lg font-bold', uiMode === 'dark' ? 'border-[#334155] bg-[#1E293B] text-slate-200 active:bg-[#0B1424]' : 'border-amber-300 bg-amber-50 text-stone-700 active:bg-amber-100')}
                            onClick={() => upsertLineQuantity(sku.id, qty - 1)}
                            disabled={order.submitted || isLocked}
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
                            disabled={order.submitted || isLocked}
                          />
                          <button
                            type="button"
                            className={cn('h-10 w-10 rounded border text-lg font-bold', uiMode === 'dark' ? 'border-[#334155] bg-[#1E293B] text-slate-200 active:bg-[#0B1424]' : 'border-amber-300 bg-amber-50 text-stone-700 active:bg-amber-100')}
                            onClick={() => upsertLineQuantity(sku.id, qty + 1)}
                            disabled={order.submitted || isLocked}
                            aria-label={`Increase ${sku.id}`}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-1 text-right">
                        {isHotVelocity(sku.velocity) && (
                          <span className={cn('inline-flex rounded border px-2 py-1 text-[10px] font-semibold', getHotBadgeClass(uiMode))}>
                            HOT
                          </span>
                        )}
                        {signals.map((signal) => (
                          <span key={signal} className={cn('ml-1 inline-flex rounded border px-2 py-1 text-[10px] font-semibold', getSignalBadgeClass(signal, uiMode))}>
                            {signalLabel(signal)}
                          </span>
                        ))}
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
                {visibleWorksheetRange.bottomSpacerHeight > 0 && (
                  <tr>
                    <td colSpan={10} style={{ height: visibleWorksheetRange.bottomSpacerHeight }} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className={cn('mt-2 text-xs', getMutedTextClass(uiMode))}>
            Floor walk quantities are pre-filled. Adjust or add any SKUs on this worksheet.
          </p>
        </section>

        <aside className={cn('flex h-full min-h-0 flex-col rounded-lg border p-4 shadow-sm', getSectionClass(uiMode))}>
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
            <button
              type="button"
              disabled={!hasKayleeRecommendations}
              onClick={removeKayleeRecommendations}
              className={cn(
                'mt-2 w-full rounded border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                uiMode === 'dark'
                  ? 'border-amber-700 bg-amber-900/30 text-amber-200 hover:bg-amber-900/50'
                  : 'border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200',
              )}
            >
              Remove Kaylee Recommendations
            </button>
          </div>

          <h2 className="mb-3 text-base font-semibold">Kaylee Assistant</h2>

          <div className="mb-2 flex items-center gap-2">
            <span className={cn('text-xs', getMutedTextClass(uiMode))}>Chat mode: live</span>
            <span className={cn('ml-auto text-xs', getMutedTextClass(uiMode))}>Status: {streamStatus}</span>
          </div>

          {kayleeError && <p className="mt-2 rounded bg-rose-50 p-2 text-xs text-rose-700">{kayleeError}</p>}

          <div className={cn('mt-3 min-h-0 flex-1 overflow-y-auto rounded border p-2', getChatBgClass(uiMode))}>
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
                {message.role === 'kaylee' ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <table className="my-1 w-full border-collapse text-xs">{children}</table>
                      ),
                      th: ({ children }) => (
                        <th className="border border-amber-300 bg-amber-100 px-2 py-1 text-left font-semibold">{children}</th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-amber-200 px-2 py-1">{children}</td>
                      ),
                      p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                    }}
                  >
                    {message.text || (streamStatus === 'streaming' ? '...' : '')}
                  </ReactMarkdown>
                ) : (
                  message.text
                )}
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

        {rightWingOpen && (
          <aside className={cn('min-h-0 overflow-auto rounded-lg border p-4', getSectionClass(uiMode))}>
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

            <div className="mt-4 overflow-auto rounded border p-2">
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
        )}
      </main>

      <footer className={cn('sticky bottom-0 z-20 px-6 py-3', getFooterClass(uiMode))}>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span>Locked Total:</span>
            <strong>{formatMoney(lockedTotalCents)}</strong>
          </div>
          <div className="flex items-center gap-2">
            <span>Running total:</span>
            <strong className="text-base">{formatMoney(runningTotalCents)}</strong>
          </div>
        </div>
      </footer>
    </div>
  )
}
