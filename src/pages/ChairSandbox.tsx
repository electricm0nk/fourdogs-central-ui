import { memo, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  makeChairSkus,
  makeSeededOrderLines,
  type AnimalFilter,
  type ChairSku,
} from '@/lib/chairSandboxMock'
import { buildKayleeStreamUrl, getDevSessionId } from '@/lib/kayleeStream'
import { connectKaylee } from '@/lib/chairSandboxApi'

type DataMode = 'mock' | 'kaylee'
type ChatMode = 'mock' | 'live'
type StreamStatus = 'idle' | 'streaming' | 'done' | 'error'
type CatalogTab = 'all' | 'frozen' | 'wellness' | string

interface ChatMessage {
  id: string
  role: 'operator' | 'kaylee'
  text: string
}

interface CatalogTableProps {
  filteredSkus: ChairSku[]
  qtyBySku: Map<string, number>
  onQtyChange: (skuId: string, qty: number) => void
}

const OrderGridTable = memo(function OrderGridTable({ filteredSkus, qtyBySku, onQtyChange }: CatalogTableProps) {
  return (
    <div className="max-h-[64vh] overflow-auto rounded border border-slate-200">
      <table className="w-full min-w-[980px] border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-slate-900 text-slate-100">
          <tr>
            <th className="px-2 py-2 text-left">Product</th>
            <th className="px-2 py-2 text-left">Pack</th>
            <th className="px-2 py-2 text-right">Price</th>
            <th className="px-2 py-2 text-right">Qty</th>
            <th className="px-2 py-2 text-right">Line Total</th>
          </tr>
        </thead>
        <tbody>
          {filteredSkus.map((sku) => {
            const qty = qtyBySku.get(sku.id) ?? 0
            const lineTotal = qty * sku.priceCents
            return (
              <tr key={sku.id} className="border-t border-slate-200 odd:bg-slate-50">
                <td className="px-2 py-1">{sku.name}</td>
                <td className="px-2 py-1">{sku.pack}</td>
                <td className="px-2 py-1 text-right">{formatMoney(sku.priceCents)}</td>
                <td className="px-2 py-1 text-right">
                  <input
                    type="number"
                    min={0}
                    value={qty}
                    className="w-16 rounded border border-slate-300 px-1 py-1 text-right"
                    onChange={(event) => onQtyChange(sku.id, Math.max(0, Number(event.target.value) || 0))}
                  />
                </td>
                <td className="px-2 py-1 text-right font-medium">{formatMoney(lineTotal)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function ChairSandbox() {
  const navigate = useNavigate()
  const mockSkus = useMemo(() => makeChairSkus(5_000), [])

  const [dataMode, setDataMode] = useState<DataMode>('mock')
  const [showCatalogExplorer, setShowCatalogExplorer] = useState(false)
  const [kayleeHealth, setKayleeHealth] = useState('Not connected')
  const [kayleeSkus, setKayleeSkus] = useState<ChairSku[]>([])
  const [kayleeError, setKayleeError] = useState('')
  const [loadingKaylee, setLoadingKaylee] = useState(false)
  const [kayleeLoaded, setKayleeLoaded] = useState(false)
  const [chatMode, setChatMode] = useState<ChatMode>('mock')
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle')
  const [orderId, setOrderId] = useState('00000000-0000-0000-0000-000000000001')
  const [kayleeMode, setKayleeMode] = useState<'chatty' | 'sleepy'>('chatty')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'intro',
      role: 'kaylee',
      text: "Hi, I'm Kaylee. Ask me about this order and I will stream my reasoning.",
    },
  ])

  const streamRef = useRef<EventSource | null>(null)
  const mockTimerRef = useRef<number | null>(null)
  const chatBottomRef = useRef<HTMLDivElement | null>(null)

  const [showKayleePanel, setShowKayleePanel] = useState(true)
  const [activeTab, setActiveTab] = useState<CatalogTab>('all')
  const [animal, setAnimal] = useState<AnimalFilter>('all')
  const [query, setQuery] = useState('')

  const [lineItems, setLineItems] = useState(() => makeSeededOrderLines(25, mockSkus))

  const sourceSkus = dataMode === 'kaylee' && kayleeLoaded ? kayleeSkus : mockSkus

  function cleanupStreams() {
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }
    if (mockTimerRef.current !== null) {
      window.clearInterval(mockTimerRef.current)
      mockTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => cleanupStreams()
  }, [])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const skuMap = useMemo(() => new Map(sourceSkus.map((sku) => [sku.id, sku])), [sourceSkus])
  const qtyBySku = useMemo(() => new Map(lineItems.map((line) => [line.skuId, line.quantity])), [lineItems])

  const tabOptions = useMemo(() => {
    const manufacturerTabs = Array.from(
      new Set(
        sourceSkus
          .filter((sku) => sku.tab !== 'frozen' && sku.tab !== 'wellness')
          .map((sku) => sku.manufacturer || 'Unknown Manufacturer'),
      ),
    ).sort((a, b) => a.localeCompare(b))

    return ['all', ...manufacturerTabs, 'frozen', 'wellness']
  }, [sourceSkus])

  const filteredSkus = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase()
    return sourceSkus.filter((sku) => {
      let tabMatch = false
      if (activeTab === 'all') {
        tabMatch = true
      } else if (activeTab === 'frozen' || activeTab === 'wellness') {
        tabMatch = sku.tab === activeTab
      } else {
        tabMatch = sku.tab !== 'frozen' && sku.tab !== 'wellness' && sku.manufacturer === activeTab
      }

      const animalMatch = animal === 'all' || sku.animal === animal
      const queryMatch =
        !lowerQuery ||
        sku.id.toLowerCase().includes(lowerQuery) ||
        sku.name.toLowerCase().includes(lowerQuery)

      return tabMatch && animalMatch && queryMatch
    })
  }, [sourceSkus, activeTab, animal, query])

  const runningTotalCents = useMemo(
    () =>
      lineItems.reduce((sum, item) => {
        const sku = skuMap.get(item.skuId)
        if (!sku) return sum
        return sum + sku.priceCents * item.quantity
      }, 0),
    [lineItems, skuMap],
  )

  async function refreshKaylee() {
    setLoadingKaylee(true)
    setKayleeError('')
    try {
      const result = await connectKaylee('/dev-api/v1')
      setKayleeHealth(`${result.healthSummary} (${result.skus.length} rows)`)
      setKayleeSkus(result.skus)
      setKayleeLoaded(true)
      setDataMode('kaylee')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Kaylee connection error'
      const isUnauthorized = message.includes('HTTP 401') || message.toLowerCase().includes('unauthorized')
      const isKayleeBadGateway = message.includes('HTTP 502') && message.includes('/kaylee')
      setKayleeError(
        isUnauthorized
          ? 'Unauthorized from dev API. Authenticate against the dev host, then refresh again.'
          : isKayleeBadGateway
            ? 'Kaylee proxy is unavailable at /kaylee. Use "Use Dev DB" (base /dev-api/v1) or set VITE_KAYLEE_PROXY_TARGET.'
            : message,
      )
      setKayleeHealth('Connection failed')
    } finally {
      setLoadingKaylee(false)
    }
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

  function upsertKayleeStreamingText(messageId: string, text: string) {
    setMessages((prev) =>
      prev.map((message) => (message.id === messageId ? { ...message, text } : message)),
    )
  }

  function sanitizeInput(text: string): string {
    return text.trim().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 500)
  }

  function startMockStream(operatorText: string) {
    cleanupStreams()
    setStreamStatus('streaming')

    const response = `I reviewed your request: "${operatorText}". For chair-phase confidence, focus on top movers, compare dog vs cat mix, and watch frozen plus wellness substitutions.`
    const tokens = response.split(' ')
    const replyId = `kaylee-${Date.now()}`
    let index = 0

    setMessages((prev) => [...prev, { id: replyId, role: 'kaylee', text: '' }])

    mockTimerRef.current = window.setInterval(() => {
      index += 1
      upsertKayleeStreamingText(replyId, `${tokens.slice(0, index).join(' ')}${index < tokens.length ? ' ' : ''}`)

      if (index >= tokens.length) {
        if (mockTimerRef.current !== null) {
          window.clearInterval(mockTimerRef.current)
          mockTimerRef.current = null
        }
        setStreamStatus('done')
      }
    }, 80)
  }

  async function startLiveStream(operatorText: string) {
    cleanupStreams()
    setStreamStatus('streaming')
    setKayleeError('')

    const candidateRoots = ['', '/dev-api']
    const safeOrderId = orderId.trim()
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
    }

    if (!messageResponse) {
      throw new Error(lastErrorMessage || `POST /kaylee/message failed (HTTP ${lastStatus || 502})`)
    }

    const messageBody = (await messageResponse.json()) as Record<string, unknown>
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
      if (chatMode === 'mock') {
        startMockStream(clean)
      } else {
        await startLiveStream(clean)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send Kaylee message'
      const shouldFallbackToMock = /HTTP 502|fetch failed|network/i.test(message)

      if (shouldFallbackToMock) {
        setKayleeError('Live Kaylee is unavailable right now. Using mock stream fallback for this message.')
        setChatMode('mock')
        startMockStream(clean)
        return
      }

      setStreamStatus('error')
      setKayleeError(message)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-300 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">Chair Phase Sandbox</h1>
          <span className="rounded bg-slate-200 px-2 py-1 text-xs">Desktop rapid prototype</span>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              Open Orders Screen
            </Button>
            <Button
              variant={showCatalogExplorer ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowCatalogExplorer((v) => !v)}
            >
              {showCatalogExplorer ? 'Hide Catalog Explorer' : 'Show Catalog Explorer'}
            </Button>
            <Button
              variant={dataMode === 'mock' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDataMode('mock')}
            >
              Mock Data
            </Button>
            <Button
              variant={dataMode === 'kaylee' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDataMode('kaylee')}
            >
              Live Catalog API
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowKayleePanel((v) => !v)}>
              {showKayleePanel ? 'Hide Kaylee Panel' : 'Show Kaylee Panel'}
            </Button>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
          {!showCatalogExplorer ? (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-800">Catalog Explorer is off for this session.</p>
              <p className="mt-1 text-xs text-slate-600">
                Kaylee chat can run independently. Enable Catalog Explorer only when you need browse/edit table workflows.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => setShowCatalogExplorer(true)}>Open Catalog Explorer</Button>
                <Button size="sm" variant="outline" onClick={() => setDataMode('kaylee')}>
                  Switch to Live Catalog Mode
                </Button>
              </div>
            </div>
          ) : (
            <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              className="min-w-[220px] flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Search SKU or name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <div className="inline-flex rounded border border-slate-300 bg-slate-50 p-1 text-xs">
              {(['all', 'dog', 'cat'] as AnimalFilter[]).map((option) => (
                <button
                  key={option}
                  className={cn(
                    'rounded px-2 py-1 capitalize',
                    animal === option ? 'bg-slate-800 text-white' : 'text-slate-700',
                  )}
                  onClick={() => setAnimal(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            {tabOptions.map((tab) => (
              <button
                key={tab}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs uppercase tracking-wide',
                  activeTab === tab
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700',
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mb-2 text-xs text-slate-500">
            Showing {filteredSkus.length.toLocaleString()} of {sourceSkus.length.toLocaleString()} SKUs
          </div>

          <OrderGridTable filteredSkus={filteredSkus} qtyBySku={qtyBySku} onQtyChange={upsertLineQuantity} />
            </>
          )}
        </section>

        <aside
          className={cn(
            'rounded-lg border border-slate-300 bg-white p-4 shadow-sm',
            !showKayleePanel && 'hidden xl:block xl:opacity-0 xl:pointer-events-none',
          )}
        >
          <h2 className="mb-3 text-base font-semibold">Data Source + Kaylee Controls</h2>

          <div className="mb-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDataMode('kaylee')
              }}
            >
              Use Dev DB
            </Button>
            <span className="text-xs text-slate-500">Preset uses fourdogs-central dev catalog endpoint</span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" onClick={refreshKaylee} disabled={loadingKaylee}>
              {loadingKaylee ? 'Connecting...' : 'Refresh Catalog'}
            </Button>
            <span className="text-xs text-slate-600">{kayleeHealth}</span>
          </div>

          {kayleeError && <p className="mt-2 rounded bg-rose-50 p-2 text-xs text-rose-700">{kayleeError}</p>}
          {dataMode === 'kaylee' && kayleeLoaded && kayleeSkus.length === 0 && !kayleeError && (
            <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">
              Live connection succeeded, but the dev catalog returned zero rows.
            </p>
          )}

          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-700">Kaylee Chat Window</p>
              <div className="ml-auto inline-flex rounded border border-slate-300 bg-slate-50 p-1 text-xs">
                {(['mock', 'live'] as ChatMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={cn(
                      'rounded px-2 py-1 uppercase',
                      chatMode === mode ? 'bg-slate-800 text-white' : 'text-slate-700',
                    )}
                    onClick={() => setChatMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <label className="mb-1 block text-xs font-medium text-slate-600">Order ID (for live mode)</label>
            <input
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-2 text-xs"
            />

            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-600">Kaylee mode:</span>
              <Button
                size="sm"
                variant={kayleeMode === 'chatty' ? 'default' : 'outline'}
                onClick={() => setKayleeMode('chatty')}
              >
                Chatty
              </Button>
              <Button
                size="sm"
                variant={kayleeMode === 'sleepy' ? 'default' : 'outline'}
                onClick={() => setKayleeMode('sleepy')}
              >
                Sleepy
              </Button>
              <span className="ml-auto text-xs text-slate-500">Status: {streamStatus}</span>
            </div>

            <div className="mt-2 h-[240px] min-h-[180px] max-h-[560px] resize-y overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'mb-2 max-w-[90%] rounded px-2 py-2 text-xs',
                    message.role === 'operator'
                      ? 'ml-auto bg-slate-900 text-white'
                      : 'mr-auto bg-white text-slate-800 border border-slate-200',
                  )}
                >
                  {message.text || (streamStatus === 'streaming' && message.role === 'kaylee' ? '...' : '')}
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {kayleeMode === 'sleepy' ? (
              <p className="mt-2 rounded bg-slate-100 p-2 text-xs text-slate-700">
                Kaylee is in Sleepy mode. Switch to Chatty to chat.
              </p>
            ) : (
              <form className="mt-2 flex gap-2" onSubmit={sendKayleeMessage}>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={500}
                  placeholder={chatMode === 'live' ? 'Ask Kaylee (live endpoint)' : 'Ask Kaylee (mock stream)'}
                  className="flex-1 rounded border border-slate-300 px-2 py-2 text-xs"
                  disabled={streamStatus === 'streaming'}
                />
                <Button type="submit" size="sm" disabled={!draft.trim() || streamStatus === 'streaming'}>
                  Send
                </Button>
              </form>
            )}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-3">
            <p className="text-xs font-medium text-slate-700">Current order lines: {lineItems.length}</p>
            <div className="mt-2 max-h-[40vh] overflow-auto rounded border border-slate-200">
              {lineItems.map((item) => {
                const sku = skuMap.get(item.skuId)
                if (!sku) return null
                return (
                  <div key={item.skuId} className="flex items-center gap-2 border-b border-slate-100 px-2 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{sku.name}</div>
                      <div className="font-mono text-slate-500">{sku.id}</div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={item.quantity}
                      className="w-16 rounded border border-slate-300 px-1 py-1 text-right"
                      onChange={(event) => {
                        const next = Math.max(0, Number(event.target.value) || 0)
                        upsertLineQuantity(item.skuId, next)
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </main>

      <footer className="sticky bottom-0 z-20 border-t border-slate-300 bg-slate-900 px-6 py-3 text-slate-100">
        <div className="flex items-center justify-between text-sm">
          <span>Running total (always visible)</span>
          <strong className="text-base">{formatMoney(runningTotalCents)}</strong>
        </div>
      </footer>
    </div>
  )
}
