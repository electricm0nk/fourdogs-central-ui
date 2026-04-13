const TIER_CONFIG = {
  1: { label: 'High Confidence', className: 'bg-green-100 text-green-800' },
  2: { label: 'Moderate', className: 'bg-blue-100 text-blue-800' },
  3: { label: 'Review', className: 'bg-amber-100 text-amber-800' },
  4: { label: 'Low Confidence', className: 'bg-red-100 text-red-800' },
} as const

type Tier = keyof typeof TIER_CONFIG

export function ConfidenceBadge({ tier }: { tier: Tier }) {
  const config = TIER_CONFIG[tier]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
