import { useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConnectivityBadge } from '@/components/ConnectivityBadge'
import { KayleePanel } from '@/components/KayleePanel'
import { OrderingGrid } from '@/components/OrderingGrid'
import { useOrder } from '@/hooks/use_order'
import { useOrderItems } from '@/hooks/use_order_items'
import { useSubmitOrder } from '@/hooks/use_order_mutations'
import { usePatchOrderItem } from '@/hooks/use_patch_order_item'
import { useIsWide } from '@/hooks/use_is_wide'
import { useVendorAdapters } from '@/hooks/use_vendor_adapters'
import type { OrderItem } from '@/types/order_item'

const DEBOUNCE_MS = 300

function formatOrderDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ItemSkeleton() {
  return (
    <div
      data-testid="item-skeleton"
      className="h-12 rounded-md bg-gray-200 animate-pulse"
    />
  )
}

function QtyControl({
  value,
  itemId,
  orderId,
  mustHave,
  onPatch,
}: {
  value: number
  itemId: string
  orderId: string
  mustHave?: boolean
  onPatch: (args: { orderId: string; itemId: string; final_qty: number }) => void
}) {
  const [localQty, setLocalQty] = useState(value)
  const [pendingZero, setPendingZero] = useState(false)
  const [prevQty, setPrevQty] = useState(value)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function fireDebounced(qty: number) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onPatch({ orderId, itemId, final_qty: qty })
    }, DEBOUNCE_MS)
  }

  function handleIncrement() {
    const next = localQty + 1
    setLocalQty(next)
    fireDebounced(next)
  }

  function handleDecrement() {
    if (localQty <= 0) return
    const next = localQty - 1
    if (next === 0 && mustHave) {
      setPrevQty(localQty)
      setLocalQty(0)
      setPendingZero(true)
      return
    }
    setLocalQty(next)
    fireDebounced(next)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10)
    if (isNaN(val) || val < 0) return
    if (val === 0 && mustHave && localQty > 0) {
      setPrevQty(localQty)
      setLocalQty(0)
      setPendingZero(true)
      return
    }
    setLocalQty(val)
    fireDebounced(val)
  }

  function confirmZero() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setPendingZero(false)
    onPatch({ orderId, itemId, final_qty: 0 })
  }

  function cancelZero() {
    setPendingZero(false)
    setLocalQty(prevQty)
  }

  return (
    <>
      {pendingZero && (
        <div
          role="dialog"
          aria-modal="true"
          className="absolute z-10 rounded-md border bg-white p-3 shadow-lg text-sm space-y-2 w-56"
        >
          <p className="font-medium">This is a must-have item. Set to 0?</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={confirmZero}>
              Yes, set to 0
            </Button>
            <Button size="sm" variant="outline" onClick={cancelZero}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-1">
        <button
          className="w-11 h-11 flex items-center justify-center rounded border text-lg font-medium hover:bg-gray-100 disabled:opacity-40"
          onClick={handleDecrement}
          disabled={localQty <= 0}
          aria-label="-"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={localQty}
          onChange={handleChange}
          className="w-14 text-center border rounded h-11 text-sm"
          min={0}
        />
        <button
          className="w-11 h-11 flex items-center justify-center rounded border text-lg font-medium hover:bg-gray-100"
          onClick={handleIncrement}
          aria-label="+"
        >
          +
        </button>
      </div>
    </>
  )
}

function OrderItemRow({
  item,
  orderId,
  onPatch,
}: {
  item: OrderItem
  orderId: string
  onPatch: (args: { orderId: string; itemId: string; final_qty: number }) => void
}) {
  return (
    <div
      className={`relative flex items-center justify-between min-h-[48px] p-3 rounded-md border ${
        item.must_have ? 'border-amber-400 bg-amber-50' : 'bg-white'
      }`}
    >
      <div className="flex-1">
        <p className="font-medium text-sm">{item.item_name}</p>
        <p className="text-xs text-gray-500">SKU: {item.item_id} · Stock: {item.current_stock_qty}</p>
      </div>
      <div className="flex items-center gap-2">
        {item.must_have && (
          <Badge className="bg-amber-100 text-amber-800 text-xs">Must-Have</Badge>
        )}
        <QtyControl
          value={item.final_qty}
          itemId={item.id}
          orderId={orderId}
          mustHave={item.must_have}
          onPatch={onPatch}
        />
      </div>
    </div>
  )
}

function FloorWalkTab({ orderId }: { orderId: string }) {
  const [search, setSearch] = useState('')
  const { data: items, isLoading } = useOrderItems(orderId)
  const { mutate: patchItem, isPending } = usePatchOrderItem()

  const filtered = items?.filter(
    (item) =>
      search === '' ||
      item.item_name.toLowerCase().includes(search.toLowerCase()) ||
      item.item_id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-3">
      <ConnectivityBadge isSyncing={isPending} />

      <div className="relative">
        <Input
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => setSearch('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <ItemSkeleton key={i} />)}
        </div>
      )}

      {!isLoading && (!filtered || filtered.length === 0) && (
        <div className="py-8 text-center text-gray-500">
          {search ? 'No items match your search.' : 'No items on this order yet. Items are imported when the order is created.'}
        </div>
      )}

      {!isLoading && filtered && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((item) => (
            <OrderItemRow
              key={item.id}
              item={item}
              orderId={orderId}
              onPatch={patchItem}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ChairTab({ orderId, isEditable }: { orderId: string; isEditable: boolean }) {
  const wide = useIsWide()
  return wide ? (
    <div className="grid grid-cols-[1fr_380px] gap-4 h-full">
      <OrderingGrid orderId={orderId} isEditable={isEditable} />
      <KayleePanel orderId={orderId} />
    </div>
  ) : (
    <div className="flex flex-col gap-4">
      <OrderingGrid orderId={orderId} isEditable={isEditable} />
    </div>
  )
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
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'floorwalk'
  const { data: order, isLoading } = useOrder(id ?? '')
  const { mutate: submitOrder, isPending } = useSubmitOrder()
  const { data: vendorAdapters } = useVendorAdapters()
  const adapterType = vendorAdapters?.find((a) => a.id === order?.vendor_adapter_id)?.adapter_type ?? ''

  if (isLoading || !order) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8 text-gray-500">Loading order…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/')}>
            ← Back
          </Button>
          <h1 className="text-2xl font-bold flex-1">{order.vendor_name}</h1>
          {order.submitted ? (
            <>
              <span className="text-sm text-gray-500 italic">Read-only</span>
              <Badge className="bg-green-100 text-green-800">Submitted</Badge>
              <ExportButton orderId={order.id} label="Export CSV" />
              {adapterType === 'etailpet' && (
                <ExportButton orderId={order.id} label="Export EtailPet" />
              )}
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => submitOrder({ id: order.id, submitted: false })}
              >
                Unsubmit
              </Button>
            </>
          ) : (
            <>
              <Badge className="bg-gray-100 text-gray-800">In Progress</Badge>
              <Button
                disabled={isPending}
                onClick={() => submitOrder({ id: order.id, submitted: true })}
              >
                Mark Submitted
              </Button>
            </>
          )}
        </div>

        <p className="text-sm text-gray-500">
          Order date: {formatOrderDate(order.order_date)}
        </p>

        {/* Tab bar */}
        <div className="flex border-b">
          <button
            role="tab"
            aria-selected={activeTab === 'floorwalk'}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'floorwalk'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setSearchParams({ tab: 'floorwalk' })}
          >
            Floor Walk
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'chair'}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'chair'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setSearchParams({ tab: 'chair' })}
          >
            Chair
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'floorwalk' && <FloorWalkTab orderId={order.id} />}
        {activeTab === 'chair' && <ChairTab orderId={order.id} isEditable={!order.submitted && !order.archived} />}
      </div>
    </div>
  )
}
