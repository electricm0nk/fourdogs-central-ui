import { useEffect } from 'react'
import { KayleeStream } from './KayleeStream'
import { KayleeMessage } from './KayleeMessage'
import { useOrderItems } from '@/hooks/use_order_items'
import { useKayleeAnalyze } from '@/hooks/use_kaylee_analyze'
import { useKayleeStream } from '@/hooks/use_kaylee_stream'

export function KayleePanel({ orderId }: { orderId: string }) {
  const { data: items } = useOrderItems(orderId)
  const { mutate: analyze, isPending, isError } = useKayleeAnalyze()
  const { tokens, status, start } = useKayleeStream(orderId)

  useEffect(() => {
    if (items && items.some((item) => item.ghost_qty === null)) {
      analyze(orderId, {
        onSuccess: () => start(),
      })
    }
  }, [items, orderId, analyze, start])

  const tier4Items = items?.filter((item) => item.confidence_tier === 4) ?? []

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
      {!isPending && !isError && (
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          {(status === 'timeout' || status === 'error') ? (
            <div className="flex flex-col gap-3">
              <KayleeMessage
                role="kaylee"
                text="Hmm, I'm taking longer than usual. The grid is all yours — I'll be here if you need me."
              />
              <button
                className="self-start text-sm text-blue-600 underline hover:text-blue-800"
                onClick={start}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <KayleeStream tokens={tokens} status={status} />
              {tier4Items.map((item) => (
                <KayleeMessage
                  key={item.id}
                  role="kaylee"
                  text={`I'm not very confident about ${item.item_name}. Want to talk through it?`}
                />
              ))}
            </>
          )}
        </div>
      )}
    </aside>
  )
}
