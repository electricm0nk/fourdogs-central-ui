export interface OrderItem {
  id: string
  order_id: string
  item_id: string
  item_name: string
  category: string | null
  current_stock_qty: number
  velocity_tier: string | null
  must_have: boolean
  final_qty: number
  ghost_qty: number | null
  confidence_tier: number | null
}
