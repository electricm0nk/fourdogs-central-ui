export function OrderingGrid({ orderId: _orderId }: { orderId: string }) {
  return (
    <div data-testid="ordering-grid" className="rounded-lg border bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Ghost Qty</th>
            <th className="text-center px-4 py-3 font-medium text-gray-600">Confidence</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Final Qty</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
              Items will appear here (Chair Phase)
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
