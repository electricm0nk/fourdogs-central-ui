import { useRef, useState } from 'react'
import { useOrderItems } from '@/hooks/use_order_items'
import { usePatchOrderItem } from '@/hooks/use_patch_order_item'
import { useLogLearning } from '@/hooks/use_log_learning'
import { resolveActionType } from '@/lib/resolve_action_type'
import { ConfidenceBadge } from './ConfidenceBadge'
import { Badge } from '@/components/ui/badge'

function ghostQtyCell(item: {
  ghost_qty: number | null
  confidence_tier: number | null
}) {
  if (item.ghost_qty === null) return '—'
  if (item.confidence_tier === 1) return '✓ Auto'
  return item.ghost_qty
}

function confidenceCell(item: {
  ghost_qty: number | null
  confidence_tier: number | null
}) {
  if (item.ghost_qty === null || item.confidence_tier === null) return <span>—</span>
  if (item.confidence_tier === 1) return null // silent for auto-applied
  return <ConfidenceBadge tier={item.confidence_tier as 1 | 2 | 3 | 4} />
}

function EditableQtyCell({
  value,
  itemId,
  orderId,
  onPatch,
  onLog,
}: {
  value: number
  itemId: string
  orderId: string
  onPatch: (args: { orderId: string; itemId: string; final_qty: number }) => void
  onLog?: (finalQty: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [localQty, setLocalQty] = useState(value)
  const committedRef = useRef(false)

  function commit(qty: number) {
    committedRef.current = true
    onPatch({ orderId, itemId, final_qty: qty })
    onLog?.(qty)
    setEditing(false)
  }

  function cancel() {
    committedRef.current = true
    setLocalQty(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="number"
        autoFocus
        min={0}
        value={localQty}
        className="w-16 text-right border rounded px-1 py-0.5 text-sm tabular-nums"
        onChange={(e) => setLocalQty(parseInt(e.target.value, 10) || 0)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            commit(localQty)
          } else if (e.key === 'Escape') {
            cancel()
          }
        }}
        onBlur={() => {
          if (!committedRef.current) {
            commit(localQty)
          }
          committedRef.current = false
        }}
      />
    )
  }

  return (
    <button
      aria-label="Edit quantity"
      className="w-full text-right tabular-nums hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
      onClick={() => {
        committedRef.current = false
        setLocalQty(value)
        setEditing(true)
      }}
    >
      {value}
    </button>
  )
}

export function OrderingGrid({
  orderId,
  isEditable = false,
}: {
  orderId: string
  isEditable?: boolean
}) {
  const { data: items, isLoading } = useOrderItems(orderId)
  const { mutate: patchItem } = usePatchOrderItem()
  const logLearning = useLogLearning()

  return (
    <div data-testid="ordering-grid" className="rounded-lg border bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
            <th className="text-left px-3 py-3 font-medium text-gray-600">SKU</th>
            <th className="text-right px-3 py-3 font-medium text-gray-600">Stock</th>
            <th className="text-right px-3 py-3 font-medium text-gray-600 w-20">Ghost Qty</th>
            <th className="text-center px-3 py-3 font-medium text-gray-600">Confidence</th>
            <th className="text-right px-3 py-3 font-medium text-gray-600 w-20">Final Qty</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                Loading items…
              </td>
            </tr>
          )}
          {!isLoading && (!items || items.length === 0) && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                Nothing to show here yet.
              </td>
            </tr>
          )}
          {!isLoading &&
            items?.map((item) => (
              <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-medium">{item.item_name}</span>
                  {item.is_special_order && (
                    <Badge className="ml-2 bg-purple-100 text-purple-800 text-xs">
                      Special Order
                    </Badge>
                  )}
                  {item.category && (
                    <span className="ml-2 text-xs text-gray-400">{item.category}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-gray-500">{item.item_id}</td>
                <td className="px-3 py-3 text-right tabular-nums">{item.current_stock_qty}</td>
                <td className="px-3 py-3 text-right tabular-nums font-medium">
                  {ghostQtyCell(item)}
                </td>
                <td className="px-3 py-3 text-center">{confidenceCell(item)}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {isEditable ? (
                    <EditableQtyCell
                      value={item.final_qty}
                      itemId={item.id}
                      orderId={orderId}
                      onPatch={patchItem}
                      onLog={(finalQty) =>
                        logLearning({
                          orderId,
                          itemSku: item.item_id,
                          actionType: resolveActionType(item, finalQty),
                          kayleeRecQty: item.ghost_qty ?? null,
                          finalQty,
                          confidenceTier: item.confidence_tier ?? null,
                        })
                      }
                    />
                  ) : (
                    item.final_qty
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
