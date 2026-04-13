import { useParams, useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useOrder } from '@/hooks/use_order'
import { useSubmitOrder } from '@/hooks/use_order_mutations'

function formatOrderDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
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

        <div className="rounded-lg border bg-white p-6 text-center text-gray-400">
          Floor Walk items will appear here (Epic 3)
        </div>
      </div>
    </div>
  )
}
