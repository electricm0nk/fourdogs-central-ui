import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
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
import { useVendors } from '@/hooks/use_vendors'
import { useArchiveOrder, useSubmitOrder } from '@/hooks/use_order_mutations'
import { useVendorCatalog } from '@/hooks/use_vendor_catalog'
import { api } from '@/lib/api'
import {
  getPageClass,
  getSectionClass,
  getMutedTextClass,
  getTableHeaderClass,
  getTableRowBaseClass,
  readUiMode,
  type UiMode,
} from '@/lib/orderGrid'
import type { ExportLine } from '@/lib/exportXlsx'
import { cn } from '@/lib/utils'
import type { Order } from '@/types/order'

function formatOrderDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Floor walk lines fetched on demand for export ─────────────────────────
interface FloorWalkLine { sku_id: string; item_upc: string; quantity: number }

async function fetchFloorWalkLines(orderId: string): Promise<FloorWalkLine[]> {
  try {
    const res = await api.get<{ data: FloorWalkLine[] }>(`/v1/orders/${orderId}/floor-walk-lines`)
    return res.data ?? []
  } catch {
    return []
  }
}

// ── Export action buttons (expandable) ────────────────────────────────────
function OrderActions({
  order,
  uiMode,
  catalog,
}: {
  order: Order
  uiMode: UiMode
  catalog: ReturnType<typeof useVendorCatalog>['data']
}) {
  const [exporting, setExporting] = useState<string | null>(null)

  const exportBtn = cn(
    'rounded border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
    uiMode === 'dark'
      ? 'border-sky-600 bg-sky-700/30 text-sky-300 hover:bg-sky-700/50'
      : 'border-teal-600 bg-teal-600 text-white hover:bg-teal-700',
  )
  const stubBtn = cn(
    'rounded border px-3 py-1.5 text-xs font-semibold cursor-not-allowed opacity-60',
    uiMode === 'dark'
      ? 'border-slate-600 bg-[#0B1424] text-slate-400'
      : 'border-amber-300 bg-amber-50 text-stone-500',
  )

  const orderTitle = `${order.vendor_name ?? 'Order'} - ${formatOrderDate(order.order_date)}`

  async function handleExportEtp() {
    setExporting('etp')
    try {
      const lines = await fetchFloorWalkLines(order.id)
      const skuMap = new Map((catalog ?? []).map((s) => [s.id, s]))
      const exportLines: ExportLine[] = lines
        .filter((l) => l.quantity > 0)
        .map((l) => ({
          systemId: l.sku_id,
          upc: l.item_upc ?? '',
          name: skuMap.get(l.sku_id)?.name ?? l.sku_id,
          qty: l.quantity,
        }))
      const { exportEtpXlsx } = await import('@/lib/exportXlsx')
      await exportEtpXlsx(exportLines, orderTitle)
    } finally {
      setExporting(null)
    }
  }

  async function handleExportFull() {
    setExporting('full')
    try {
      const lines = await fetchFloorWalkLines(order.id)
      const skuMap = new Map((catalog ?? []).map((s) => [s.id, s]))
      const exportLines: ExportLine[] = lines
        .filter((l) => l.quantity > 0)
        .map((l) => {
          const sku = skuMap.get(l.sku_id)
          return {
            systemId: l.sku_id,
            upc: l.item_upc ?? sku?.upc ?? '',
            name: sku?.name ?? l.sku_id,
            qty: l.quantity,
          }
        })
      const { exportFullXlsx } = await import('@/lib/exportXlsx')
      await exportFullXlsx(exportLines, orderTitle)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div
      className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-dashed"
      style={{ borderColor: uiMode === 'dark' ? '#23314A' : '#fcd34d' }}
    >
      <button type="button" className={stubBtn} disabled>Send to ETP</button>
      <button
        type="button"
        className={exportBtn}
        disabled={exporting === 'etp'}
        onClick={handleExportEtp}
      >
        {exporting === 'etp' ? 'Exporting…' : 'Export ETP XLSX'}
      </button>
      <button type="button" className={stubBtn} disabled>Transmit to Vendor</button>
      <button
        type="button"
        className={exportBtn}
        disabled={exporting === 'full'}
        onClick={handleExportFull}
      >
        {exporting === 'full' ? 'Exporting…' : 'Export Full'}
      </button>
    </div>
  )
}

// ── Single order row ───────────────────────────────────────────────────────
function OrderRow({
  order,
  uiMode,
  catalog,
  idx,
}: {
  order: Order
  uiMode: UiMode
  catalog: ReturnType<typeof useVendorCatalog>['data']
  idx: number
}) {
  const navigate = useNavigate()
  const { mutate: archiveOrder, isPending: archiving } = useArchiveOrder()
  const { mutate: submitOrder, isPending: marking } = useSubmitOrder()
  const [expanded, setExpanded] = useState(false)

  const isOrdered = order.submitted
  const isArchived = order.archived

  const rowClass = cn(
    getTableRowBaseClass(uiMode),
    idx % 2 === 1 ? (uiMode === 'dark' ? 'bg-[#0D1A2E]' : 'bg-amber-50/40') : '',
  )
  const primaryBtn = cn(
    'rounded border px-3 py-1.5 text-xs font-semibold transition-colors',
    uiMode === 'dark'
      ? 'border-blue-600 bg-blue-700 text-white hover:bg-blue-600'
      : 'border-[#CE7019] bg-[#CE7019] text-white hover:bg-amber-600',
  )
  const outlineBtn = cn(
    'rounded border px-3 py-1.5 text-xs font-semibold transition-colors',
    uiMode === 'dark'
      ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
      : 'border-amber-300 text-stone-700 hover:bg-amber-100',
  )
  const dangerBtn = cn(
    'rounded border px-3 py-1.5 text-xs font-semibold transition-colors',
    uiMode === 'dark'
      ? 'border-red-800 text-red-400 hover:bg-red-900/30'
      : 'border-red-200 text-red-600 hover:bg-red-50',
  )
  const successBtn = cn(
    'rounded border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
    uiMode === 'dark'
      ? 'border-emerald-600 bg-emerald-800/40 text-emerald-300 hover:bg-emerald-700/50'
      : 'border-green-600 bg-green-600 text-white hover:bg-green-700',
  )

  return (
    <>
      <tr className={rowClass}>
        <td className="px-3 py-2">
          <button
            type="button"
            className={cn(
              'text-left font-medium hover:underline',
              uiMode === 'dark' ? 'text-slate-100' : 'text-stone-900',
            )}
            onClick={() => navigate(`/orders/${order.id}`)}
          >
            {order.vendor_name ?? '—'}
          </button>
        </td>
        <td className={cn('px-3 py-2 text-sm', getMutedTextClass(uiMode))}>
          {formatOrderDate(order.order_date)}
        </td>
        <td className="px-3 py-2">
          {isOrdered ? (
            <Badge className={uiMode === 'dark' ? 'bg-emerald-900 text-emerald-200' : 'bg-green-100 text-green-800'}>Ordered</Badge>
          ) : isArchived ? (
            <Badge className={uiMode === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-stone-100 text-stone-500'}>Archived</Badge>
          ) : (
            <Badge className={uiMode === 'dark' ? 'bg-[#153B2A] text-[#86EFAC]' : 'bg-amber-100 text-amber-800'}>In Progress</Badge>
          )}
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {isOrdered ? (
              // Placed order: Return to Active + Archive only
              <>
                <button
                  type="button"
                  className={outlineBtn}
                  disabled={marking}
                  onClick={() => submitOrder({ id: order.id, submitted: false })}
                >
                  Return to Active
                </button>
                <button
                  type="button"
                  className={dangerBtn}
                  disabled={archiving}
                  onClick={() => archiveOrder({ id: order.id })}
                >
                  Archive
                </button>
              </>
            ) : isArchived ? (
              // Archived order: view only
              <button
                type="button"
                className={outlineBtn}
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                View Order
              </button>
            ) : (
              // Active order: Floor Walk + Worksheet + Mark Ordered + Export (no Archive)
              <>
                <button
                  type="button"
                  className={primaryBtn}
                  onClick={() => navigate(`/orders/${order.id}/floor-walk`)}
                >
                  Floor Walk
                </button>
                <button
                  type="button"
                  className={primaryBtn}
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  Worksheet
                </button>
                <button
                  type="button"
                  className={successBtn}
                  disabled={marking}
                  onClick={() => submitOrder({ id: order.id, submitted: true })}
                >
                  Mark Ordered
                </button>
                <button
                  type="button"
                  className={outlineBtn}
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? 'Hide ▲' : 'Export ▼'}
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {expanded && !isArchived && (
        <tr className={uiMode === 'dark' ? 'bg-[#0A182A]' : 'bg-amber-50/60'}>
          <td colSpan={4} className="px-4 pb-3">
            <OrderActions order={order} uiMode={uiMode} catalog={catalog} />
          </td>
        </tr>
      )}
    </>
  )
}

// ── Create order modal ─────────────────────────────────────────────────────
function CreateOrderModal({ open, onClose, uiMode }: { open: boolean; onClose: () => void; uiMode: UiMode }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: vendors = [] } = useVendors()
  const [vendorId, setVendorId] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [budgetDollars, setBudgetDollars] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const normalizedBudget = budgetDollars.trim()
      let budgetCents: number | undefined
      if (normalizedBudget) {
        const parsed = Number(normalizedBudget)
        if (Number.isNaN(parsed) || parsed < 0) {
          setError('Budget must be a non-negative number.')
          setSubmitting(false)
          return
        }
        budgetCents = Math.round(parsed * 100)
      }
      const result = await api.post<{ data: Order }>('/v1/orders', {
        vendor_id: parseInt(vendorId, 10),
        order_date: orderDate,
        ...(budgetCents !== undefined ? { budget_cents: budgetCents } : {}),
      })
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
      navigate(`/orders/${result.data.id}/floor-walk`)
    } catch {
      setError('Failed to create order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent
      className={cn(
        uiMode === 'dark'
          ? 'bg-[#152640] border border-[#2B4360] text-slate-100'
          : 'bg-white',
      )}
      overlayClassName={uiMode === 'dark' ? 'bg-[#020617]/70' : undefined}
    >
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Start New Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 my-4">
          <div>
            <label className={cn('block text-sm font-medium mb-1', uiMode === 'dark' ? 'text-slate-200' : '')} htmlFor="vendor">Vendor</label>
            <Select
              id="vendor"
              value={vendorId}
              onValueChange={setVendorId}
              required
              className={uiMode === 'dark' ? 'border-[#3C5678] bg-[#0F1E33] text-slate-100 focus:ring-sky-500' : ''}
            >
              <SelectItem value="">Select a vendor…</SelectItem>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>{v.name} ({v.sku_count} SKUs)</SelectItem>
              ))}
            </Select>
          </div>
          <div>
            <label className={cn('block text-sm font-medium mb-1', uiMode === 'dark' ? 'text-slate-200' : '')} htmlFor="order-date">Order Date</label>
            <Input
              id="order-date"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className={uiMode === 'dark' ? 'border-[#3C5678] bg-[#0F1E33] text-slate-100 focus:ring-sky-500' : ''}
              required
            />
          </div>
          <div>
            <label className={cn('block text-sm font-medium mb-1', uiMode === 'dark' ? 'text-slate-200' : '')} htmlFor="budget">Budget (USD)</label>
            <Input
              id="budget"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={budgetDollars}
              onChange={(e) => setBudgetDollars(e.target.value)}
              className={uiMode === 'dark' ? 'border-[#3C5678] bg-[#0F1E33] text-slate-100 focus:ring-sky-500' : ''}
              placeholder="e.g. 1200.00"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className={uiMode === 'dark' ? 'border-slate-500 bg-[#0F1E33] text-slate-100 hover:bg-slate-700' : ''} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create Order'}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

// ── Reusable order table ───────────────────────────────────────────────────
function OrderTable({
  orders,
  uiMode,
  catalog,
}: {
  orders: Order[]
  uiMode: UiMode
  catalog: ReturnType<typeof useVendorCatalog>['data']
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className={cn('sticky top-0 z-10', getTableHeaderClass(uiMode))}>
          <tr>
            <th className="px-3 py-2 text-left">Vendor</th>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, idx) => (
            <OrderRow
              key={order.id}
              order={order}
              uiMode={uiMode}
              catalog={catalog}
              idx={idx}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [uiMode, setUiMode] = useState<UiMode>(() => readUiMode())
  const { data: allOrders = [], isLoading } = useOrders(false)
  const { data: archivedOrders = [], isLoading: archivedLoading } = useOrders(true)

  // Split non-archived orders into active (in-progress) and placed (submitted)
  const activeOrders = allOrders.filter((o) => !o.submitted)
  const placedOrders = allOrders.filter((o) => o.submitted)

  const catalogQuery = useVendorCatalog(allOrders[0]?.vendor_id, allOrders[0]?.vendor_adapter_id)

  function saveUiMode(mode: UiMode) {
    setUiMode(mode)
    if (typeof window !== 'undefined') window.localStorage.setItem('fd-ui-mode', mode)
  }

  const sectionHeader = cn(
    'px-4 py-3 border-b font-semibold',
    uiMode === 'dark' ? 'border-[#23314A]' : 'border-[#006A71]/30',
  )
  const toggleBtn = cn(
    'rounded border px-4 py-1.5 text-sm font-semibold transition-colors',
    uiMode === 'dark'
      ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
      : 'border-amber-300 text-stone-700 hover:bg-amber-100',
  )

  return (
    <div className={cn('min-h-screen', getPageClass(uiMode))}>
      {/* Header */}
      <header
        className={cn(
          'sticky top-0 z-20 border-b px-6 py-3 backdrop-blur',
          uiMode === 'dark' ? 'border-[#23314A] bg-[#101B31]/95' : 'border-[#006A71]/40 bg-[#006A71]/90',
        )}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <h1
            className={cn(
              'flex-1 text-xl font-bold',
              uiMode === 'dark' ? '' : 'text-white',
            )}
          >
            Orders
          </h1>
          <div className="flex gap-1">
            {/* Sun — bigger + yellow when active in dark mode */}
            <button
              type="button"
              title="Light mode"
              className={cn(
                'flex items-center justify-center rounded-full transition-colors',
                uiMode === 'light'
                  ? 'h-10 w-10 bg-[#CE7019] text-white text-xl'
                  : 'h-9 w-9 text-yellow-300 text-xl opacity-50 hover:opacity-90',
              )}
              onClick={() => saveUiMode('light')}
            >☀</button>
            {/* Moon — silver tint in light mode */}
            <button
              type="button"
              title="Dark mode"
              className={cn(
                'flex items-center justify-center rounded-full transition-colors',
                uiMode === 'dark'
                  ? 'h-10 w-10 bg-blue-700 text-white text-xl'
                  : 'h-9 w-9 text-slate-400 text-lg opacity-60 hover:opacity-90',
              )}
              onClick={() => saveUiMode('dark')}
            >🌙</button>
          </div>
          <button
            type="button"
            className={cn(
              'rounded border px-4 py-1.5 text-sm font-semibold transition-colors',
              uiMode === 'dark'
                ? 'border-blue-600 bg-blue-700 text-white hover:bg-blue-600'
                : 'border-white/60 bg-white/20 text-white hover:bg-white/30',
            )}
            onClick={() => setModalOpen(true)}
          >
            + New Order
          </button>
        </div>
        <div className="mx-auto mt-2 max-w-5xl h-1.5 rounded-full bg-gradient-to-r from-[#762123] via-[#006A71] to-[#CE7019]" />
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <DataFreshnessPanel uiMode={uiMode} />

        {/* Active orders */}
        <section className={cn('rounded-lg border shadow-sm', getSectionClass(uiMode))}>
          <div className={sectionHeader}>Active Orders</div>
          {isLoading ? (
            <p className={cn('p-6 text-center text-sm', getMutedTextClass(uiMode))}>Loading orders…</p>
          ) : activeOrders.length === 0 ? (
            <p className={cn('p-6 text-center text-sm', getMutedTextClass(uiMode))}>
              No active orders. Click "+ New Order" to begin.
            </p>
          ) : (
            <OrderTable orders={activeOrders} uiMode={uiMode} catalog={catalogQuery.data} />
          )}
        </section>

        {/* Placed orders */}
        {placedOrders.length > 0 && (
          <section className={cn('rounded-lg border shadow-sm', getSectionClass(uiMode))}>
            <div
              className={cn(
                sectionHeader,
                uiMode === 'dark' ? 'text-emerald-300' : 'text-green-800',
              )}
            >
              Placed Orders
            </div>
            <OrderTable orders={placedOrders} uiMode={uiMode} catalog={catalogQuery.data} />
          </section>
        )}

        {/* Archived orders */}
        <div>
          <button type="button" className={toggleBtn} onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Hide Archived ▲' : 'Show Archived ▼'}
          </button>

          {showArchived && (
            <section className={cn('mt-4 rounded-lg border shadow-sm', getSectionClass(uiMode))}>
              <div className={sectionHeader}>Archived Orders</div>
              {archivedLoading ? (
                <p className={cn('p-6 text-center text-sm', getMutedTextClass(uiMode))}>Loading…</p>
              ) : archivedOrders.length === 0 ? (
                <p className={cn('p-4 text-sm', getMutedTextClass(uiMode))}>No archived orders.</p>
              ) : (
                <OrderTable orders={archivedOrders} uiMode={uiMode} catalog={catalogQuery.data} />
              )}
            </section>
          )}
        </div>
      </main>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <CreateOrderModal open={modalOpen} onClose={() => setModalOpen(false)} uiMode={uiMode} />
      </Dialog>
    </div>
  )
}
