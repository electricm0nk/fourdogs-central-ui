import { useEffect } from 'react'
import { KayleeStream } from './KayleeStream'
import { useOrderItems } from '@/hooks/use_order_items'
import { useKayleeAnalyze } from '@/hooks/use_kaylee_analyze'

export function KayleePanel({ orderId }: { orderId: string }) {
  const { data: items } = useOrderItems(orderId)
  const { mutate: analyze, isPending, isError } = useKayleeAnalyze()

  useEffect(() => {
    if (items && items.some((item) => item.ghost_qty === null)) {
      analyze(orderId)
    }
  }, [items, orderId, analyze])

  return (
    <aside
      data-testid="kaylee-panel"
      className="flex flex-col gap-3 rounded-lg border bg-white p-4 h-full"
    >
      <h2 className="text-sm font-semibold text-gray-700">Kaylee</h2>
      {isPending && (
        <p className="text-sm text-gray-500 italic">Kaylee is thinking…</p>
      )}
      {isError && (
        <p className="text-sm text-amber-700">Kaylee is unavailable right now.</p>
      )}
      {!isPending && !isError && <KayleeStream orderId={orderId} />}
    </aside>
  )
}
