import { KayleeStream } from './KayleeStream'

export function KayleePanel({ orderId }: { orderId: string }) {
  return (
    <aside
      data-testid="kaylee-panel"
      className="flex flex-col gap-3 rounded-lg border bg-white p-4 h-full"
    >
      <h2 className="text-sm font-semibold text-gray-700">Kaylee</h2>
      <KayleeStream orderId={orderId} />
    </aside>
  )
}
