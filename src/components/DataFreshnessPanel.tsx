import { Button } from '@/components/ui/button'
import { useDataFreshness } from '@/hooks/use_data_freshness'
import type { FreshnessEntry } from '@/types/data_freshness'
import type { UiMode } from '@/lib/orderGrid'

function formatAge(ageMinutes: number): string {
  if (ageMinutes < 0) return 'unknown'
  if (ageMinutes < 60) return `${ageMinutes} minutes ago`
  const hours = Math.round(ageMinutes / 60)
  return `${hours} hours ago`
}

function FreshnessRow({
  label,
  entry,
}: {
  label: string
  entry: FreshnessEntry
}) {
  return (
    <div className="flex items-center justify-between text-sm font-mono">
      <span className="text-[#4ade80]">{label}</span>
      <span className="flex items-center gap-1">
        <span className="text-[#86efac]">{formatAge(entry.age_minutes)}</span>
        {entry.stale ? (
          <span className="text-yellow-400">⚠</span>
        ) : (
          <span className="text-[#4ade80]">✓</span>
        )}
      </span>
    </div>
  )
}

export function DataFreshnessPanel({ uiMode }: { uiMode?: UiMode }) {
  const { data, isLoading, error, refetch } = useDataFreshness()
  void uiMode

  return (
    <div
      className="rounded-lg border px-4 py-3 border-[#1a3a1a] bg-[#050f05] shadow-[0_0_8px_rgba(74,222,128,0.15)]"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold font-mono tracking-wide text-[#4ade80]">{'>'} DATA FRESHNESS</span>
        {!isLoading && (
          <Button
            variant="outline"
            size="sm"
            className="border-[#1a3a1a] bg-[#071607] text-[#4ade80] hover:bg-[#0a1f0a] hover:text-[#86efac] font-mono"
            onClick={() => refetch()}
          >
            ↻ Refresh
          </Button>
        )}
      </div>
      {isLoading && <p className="text-sm font-mono text-[#4ade80]">... loading</p>}
      {error && (
        <p className="text-sm font-mono text-yellow-400">
          Data freshness check unavailable — use with caution.
        </p>
      )}
      {data && (
        <div className="space-y-1.5">
          <FreshnessRow label="inventory" entry={data.inventory} />
          <FreshnessRow label="sales" entry={data.sales} />
          {data.transactions && (
            <FreshnessRow label="transactions" entry={data.transactions} />
          )}
          {data.vendor_product_mapping && (
            <FreshnessRow label="vendor_product_mapping" entry={data.vendor_product_mapping} />
          )}
        </div>
      )}
    </div>
  )
}
