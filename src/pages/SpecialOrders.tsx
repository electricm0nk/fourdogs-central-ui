import { useRef, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  useImportSpecialOrders,
  useSpecialOrdersStaging,
  useConfirmSpecialOrder,
  useDiscardSpecialOrder,
} from '@/hooks/use_special_orders'
import type { SpecialOrdersStaging } from '@/types/special_order'

function StatusBadge({ status }: { status: SpecialOrdersStaging['status'] }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    discarded: 'bg-gray-100 text-gray-500 line-through',
  }
  return <Badge className={styles[status]}>{status}</Badge>
}

function StagingTable({ rows }: { rows: SpecialOrdersStaging[] }) {
  const { mutate: confirm, isPending: confirming } = useConfirmSpecialOrder()
  const { mutate: discard, isPending: discarding } = useDiscardSpecialOrder()

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Item ID</th>
            <th className="px-4 py-3 font-medium">Item Name</th>
            <th className="px-4 py-3 font-medium">Qty</th>
            <th className="px-4 py-3 font-medium">Vendor Notes</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="bg-white">
              <td className="px-4 py-3 font-mono text-xs">{row.item_id}</td>
              <td className="px-4 py-3">{row.item_name}</td>
              <td className="px-4 py-3 text-right">{row.requested_qty}</td>
              <td className="px-4 py-3 text-gray-500">{row.vendor_notes ?? '—'}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={row.status !== 'pending' || confirming}
                    onClick={() => confirm(row.id)}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={row.status !== 'pending' || discarding}
                    onClick={() => discard(row.id)}
                  >
                    Discard
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SpecialOrders() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { upload, state } = useImportSpecialOrders()
  const { data: stagingRows = [] } = useSpecialOrdersStaging()

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      // Client-side type check
      e.target.value = ''
      return
    }
    upload(file)
    // Reset input so same file can be re-uploaded after fixing errors
    e.target.value = ''
  }

  const isUploading = state.status === 'uploading'

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Special Orders</h1>
          <Link to="/" className="text-sm text-blue-600 hover:underline">
            ← Back to Orders
          </Link>
        </div>

        {/* Upload area */}
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">Import CSV</h2>
          <p className="text-sm text-gray-500">
            Upload a CSV with columns: <code>item_id, item_name, requested_qty, vendor_notes</code>
            . Max 500 rows per import.
          </p>

          <div>
            <label
              htmlFor="csv-upload"
              className="inline-flex items-center gap-2 cursor-pointer"
            >
              <Button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? 'Uploading…' : 'Choose CSV File'}
              </Button>
            </label>
            <input
              id="csv-upload"
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleFileChange}
              aria-label="Upload CSV file"
            />
          </div>

          {/* Client-side non-CSV error */}
          {state.status === 'error' && state.rowErrors.length === 0 && !state.message?.includes('row') && (
            <p className="text-sm text-red-600" role="alert">
              {state.message ?? 'Upload failed. Please try again.'}
            </p>
          )}

          {/* Row-level validation errors */}
          {state.status === 'error' && (state.rowErrors.length > 0 || state.message) && (
            <div className="rounded border border-red-200 bg-red-50 p-4 space-y-1" role="alert">
              {state.message && (
                <p className="text-sm font-medium text-red-700">{state.message}</p>
              )}
              {state.rowErrors.map((e) => (
                <p key={`${e.row}-${e.message}`} className="text-sm text-red-600">
                  Row {e.row}: {e.message}
                </p>
              ))}
            </div>
          )}

          {state.status === 'success' && (
            <p className="text-sm text-green-700">
              ✓ Imported {state.result.imported} row{state.result.imported !== 1 ? 's' : ''}{' '}
              successfully.
            </p>
          )}
        </div>

        {/* Staging table */}
        {stagingRows.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Staged Items</h2>
            <StagingTable rows={stagingRows} />
          </div>
        )}

        {stagingRows.length === 0 && state.status !== 'success' && (
          <p className="text-sm text-gray-400 text-center py-4">
            No staged items. Upload a CSV to begin.
          </p>
        )}
      </div>
    </div>
  )
}
