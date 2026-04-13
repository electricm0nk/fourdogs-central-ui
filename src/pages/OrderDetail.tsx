import { useParams, useNavigate, useSearchParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useOrder } from '@/hooks/use_order'
import { useOrderItems } from '@/hooks/use_order_items'
import { useSubmitOrder } from '@/hooks/use_order_mutations'
import type { OrderItem } from '@/types/order_item'

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

function OrderItemRow({ item }: { item: OrderItem }) {
  return (
    <div
      className={`flex items-center justify-between min-h-[48px] p-3 rounded-md border ${
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
        <span className="text-sm font-medium w-8 text-right">{item.final_qty}</span>
      </div>
    </div>
  )
}

function FloorWalkTab({ orderId }: { orderId: string }) {
  const { data: items, isLoading } = useOrderItems(orderId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => <ItemSkeleton key={i} />)}
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        No items on this order yet. Items are imported when the order is created.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <OrderItemRow key={item.id} item={item} />
      ))}
    </div>
  )
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'floorwalk'
  const { data: order, isLoading } = useOrder(id ?? '')
  const { mutate: submitOrder, isPending } = useSubmitOrder()

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
        {activeTab === 'chair' && (
          <div className="py-8 text-center text-gray-400">
            Chair Phase (Epic 4)
          </div>
        )}
      </div>
    </div>
  )
}
