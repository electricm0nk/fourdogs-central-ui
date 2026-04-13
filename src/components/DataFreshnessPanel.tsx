import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function DataFreshnessPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Data Freshness</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500">Data freshness loading…</p>
      </CardContent>
    </Card>
  )
}
