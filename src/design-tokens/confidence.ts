export interface ConfidenceTier {
  tier: 1 | 2 | 3 | 4
  label: string
  color: string       // Tailwind CSS color class
  badgeVariant: string
  icon: string        // Lucide icon name
}

export const confidenceTiers: ConfidenceTier[] = [
  {
    tier: 1,
    label: 'High confidence',
    color: 'text-green-600',
    badgeVariant: 'bg-green-100 text-green-800',
    icon: 'CheckCircle2',
  },
  {
    tier: 2,
    label: 'Good confidence',
    color: 'text-blue-600',
    badgeVariant: 'bg-blue-100 text-blue-800',
    icon: 'ThumbsUp',
  },
  {
    tier: 3,
    label: 'Low confidence',
    color: 'text-amber-600',
    badgeVariant: 'bg-amber-100 text-amber-800',
    icon: 'AlertTriangle',
  },
  {
    tier: 4,
    label: 'Uncertain / Guess',
    color: 'text-red-600',
    badgeVariant: 'bg-red-100 text-red-800',
    icon: 'HelpCircle',
  },
]

export function getConfidenceTier(tier: number): ConfidenceTier {
  const found = confidenceTiers.find((t) => t.tier === tier)
  if (!found) throw new Error(`Unknown confidence tier: ${tier}`)
  return found
}
