import { KayleeMessage } from './KayleeMessage'

export function KayleeStream({ orderId: _orderId }: { orderId: string }) {
  return (
    <div
      data-testid="kaylee-stream"
      className="flex-1 overflow-y-auto rounded border bg-gray-50 p-3 space-y-2 min-h-[200px] max-h-[480px]"
    >
      <KayleeMessage role="kaylee" text="Kaylee is ready." />
    </div>
  )
}
