import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DataFreshnessPanel } from '@/components/DataFreshnessPanel'
import { useOrders } from '@/hooks/use_orders'
import { useVendorAdapters } from '@/hooks/use_vendor_adapters'
import { useArchiveOrder } from '@/hooks/use_order_mutations'
import { api } from '@/lib/api'
import type { Order } from '@/types/order'

function formatOrderDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function OrderCard({ order }: { order: Order }) {
  const navigate = useNavigate()
  const { mutate: archiveOrder, isPending } = useArchiveOrder()

  return (
    <article className="rounded-lg border bg-white p-4 hover:border-blue-400 transition-colors">
      <div className="flex items-center justify-between">
        <div
          className="flex-1 cursor-pointer"
          onClick={() => navigate(`/orders/${order.id}`)}
        >
          <p className="font-medium">{order.vendor_name}</p>
          <p className="text-sm text-gray-500">{formatOrderDate(order.order_date)}</p>
        </div>
        <div className="flex items-center gap-2">
          {order.submitted ? (
            <Badge className="bg-green-100 text-green-800">Submitted</Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-800">In Progress</Badge>
          )}
          {!order.archived && (
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation()
                archiveOrder({ id: order.id })
              }}
              aria-label="Archive order"
            >
              Archive
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

function CreateOrderModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: adapters = [] } = useVendorAdapters()
  const [vendorId, setVendorId] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await api.post<{ data: Order }>('/v1/orders', {
        vendor_adapter_id: vendorId,
        order_date: orderDate,
      })
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
      navigate(`/orders/${result.data.id}`)
    } catch {
      setError('Failed to create order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Start New Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="vendor">
              Vendor
            </label>
            <Select
              id="vendor"
              value={vendorId}
              onValueChange={setVendorId}
              required
            >
              <SelectItem value="">Select a vendor…</SelectItem>
              {adapters.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="order-date">
              Order Date
            </label>
            <Input
              id="order-date"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Order'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const { data: orders = [], isLoading } = useOrders(false)
  const { data: archivedOrders = [], isLoading: archivedLoading } = useOrders(true)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Orders</h1>
          <Button onClick={() => setModalOpen(true)}>Start New Order</Button>
        </div>

        <DataFreshnessPanel />

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading orders…</div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No active orders. Click "Start New Order" to begin.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}

        <div>
          <Button
            variant="outline"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </Button>

          {showArchived && (
            <div className="mt-4 space-y-3">
              <h2 className="text-lg font-semibold text-gray-600">Archived Orders</h2>
              {archivedLoading ? (
                <div className="text-center py-4 text-gray-500">Loading…</div>
              ) : archivedOrders.length === 0 ? (
                <p className="text-sm text-gray-500">No archived orders.</p>
              ) : (
                archivedOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <CreateOrderModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </Dialog>
    </div>
  )
}
