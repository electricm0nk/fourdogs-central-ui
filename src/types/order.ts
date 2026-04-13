export interface Order {
  id: string
  vendor_adapter_id: string
  vendor_name?: string
  created_by: string
  order_date: string
  budget_cents?: number
  submitted: boolean
  archived: boolean
  created_at: string
}

export interface VendorAdapter {
  id: string
  name: string
  adapter_type: string
  created_at: string
}
