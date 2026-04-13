import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDataFreshness } from '@/hooks/use_data_freshness'
import type { FreshnessEntry } from '@/types/data_freshness'

function formatAge(ageMinutes: number): string {
  if (ageMinutes < 0) return 'unknown'
  if (ageMinutes < 60) return `${ageMinutes} minutes ago`
  const hours = Math.round(ageMinutes / 60)
  return `${hours} hours ago`
}

function FreshnessRow({ label, entry }: { label: string; entry: FreshnessEntry }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="flex items-center gap-1">
        <span className="text-gray-700">{formatAge(entry.age_minutes)}</span>
        {entry.stale ? (
          <span className="text-amber-500">⚠</span>
        ) : (
          <span className="text-green-600">✓</span>
        )}
      </span>
    </div>
  )
}

export function DataFreshnessPanel() {
  const { data, isLoading, error, refetch } = useDataFreshness()

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Data Freshness</CardTitle>
          {!isLoading && (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              ↻ Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-gray-500">Data freshness loading…</p>
        )}
        {error && (
          <p className="text-sm text-amber-600">
            Data freshness check unavailable — use with caution.
          </p>
        )}
        {data && (
          <div className="space-y-2">
            <FreshnessRow label="Inventory" entry={data.inventory} />
            <FreshnessRow label="Last sale" entry={data.sales} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
