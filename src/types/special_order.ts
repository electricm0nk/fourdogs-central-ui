export interface SpecialOrdersStaging {
  id: string
  order_id?: string
  item_id: string
  item_name: string
  requested_qty: number
  vendor_notes?: string
  status: 'pending' | 'confirmed' | 'discarded'
  imported_by: string
  imported_at: string
}

export interface CsvRowError {
  row: number
  message: string
}

export interface ImportResult {
  imported: number
  staging_ids: string[]
}
