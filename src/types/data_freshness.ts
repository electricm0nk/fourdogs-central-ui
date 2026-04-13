export interface FreshnessEntry {
  updated_at: string
  age_minutes: number
  stale: boolean
  threshold_seconds: number
}

export interface DataFreshnessResponse {
  inventory: FreshnessEntry
  sales: FreshnessEntry
}
