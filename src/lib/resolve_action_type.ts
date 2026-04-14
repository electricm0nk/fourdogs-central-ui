export function resolveActionType(
  item: { ghost_qty: number | null; confidence_tier: number | null },
  finalQty: number
): 'qty_edit' | 'accept_ghost' | 'reject_ghost' | 'override_tier1' {
  if (item.ghost_qty === null) return 'qty_edit'
  if (item.confidence_tier === 1) return 'override_tier1'
  if (finalQty === item.ghost_qty) return 'accept_ghost'
  return 'reject_ghost'
}
