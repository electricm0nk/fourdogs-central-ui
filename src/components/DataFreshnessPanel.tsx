import { Button } from '@/components/ui/button'
import { useDataFreshness } from '@/hooks/use_data_freshness'
import type { FreshnessEntry } from '@/types/data_freshness'
import type { UiMode } from '@/lib/orderGrid'
import { cn } from '@/lib/utils'

function formatAge(ageMinutes: number): string {
  if (ageMinutes < 0) return 'unknown'
  if (ageMinutes < 60) return `${ageMinutes} minutes ago`
  const hours = Math.round(ageMinutes / 60)
  return `${hours} hours ago`
}

function FreshnessRow({
  label,
  entry,
  dark,
}: {
  label: string
  entry: FreshnessEntry
  dark: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm font-mono">
      <span className={dark ? 'text-[#4ade80]' : 'text-gray-600'}>{label}</span>
      <span className="flex items-center gap-1">
        <span className={dark ? 'text-[#86efac]' : 'text-gray-700'}>{formatAge(entry.age_minutes)}</span>
        {entry.stale ? (
          <span className={dark ? 'text-yellow-400' : 'text-amber-500'}>⚠</span>
        ) : (
          <span className={dark ? 'text-[#4ade80]' : 'text-green-600'}>✓</span>
        )}
      </span>
    </div>
  )
}

export function DataFreshnessPanel({ uiMode }: { uiMode?: UiMode }) {
  const { data, isLoading, error, refetch } = useDataFreshness()
  const dark = uiMode === 'dark'

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3',
        dark
          ? 'border-[#1a3a1a] bg-[#050f05] shadow-[0_0_8px_rgba(74,222,128,0.15)]'
          : 'border-amber-200 bg-white',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            'text-sm font-semibold font-mono tracking-wide',
            dark ? 'text-[#4ade80]' : 'text-stone-700',
          )}
        >
          {dark ? '> DATA FRESHNESS' : 'Data Freshness'}
        </span>
        {!isLoading && (
          <Button
            variant="outline"
            size="sm"
            className={dark ? 'border-[#1a3a1a] bg-[#071607] text-[#4ade80] hover:bg-[#0a1f0a] hover:text-[#86efac] font-mono' : ''}
            onClick={() => refetch()}
          >
            ↻ Refresh
          </Button>
        )}
      </div>
      {isLoading && (
        <p className={cn('text-sm font-mono', dark ? 'text-[#4ade80]' : 'text-gray-500')}>
          {dark ? '... loading' : 'Data freshness loading…'}
        </p>
      )}
      {error && (
        <p className={cn('text-sm font-mono', dark ? 'text-yellow-400' : 'text-amber-600')}>
          Data freshness check unavailable — use with caution.
        </p>
      )}
      {data && (
        <div className="space-y-1.5">
          <FreshnessRow label="inventory" entry={data.inventory} dark={dark} />
          <FreshnessRow label="sales" entry={data.sales} dark={dark} />
          {data.transactions && (
            <FreshnessRow label="transactions" entry={data.transactions} dark={dark} />
          )}
          {data.vendor_product_mapping && (
            <FreshnessRow label="vendor_product_mapping" entry={data.vendor_product_mapping} dark={dark} />
          )}
        </div>
      )}
    </div>
  )
}
