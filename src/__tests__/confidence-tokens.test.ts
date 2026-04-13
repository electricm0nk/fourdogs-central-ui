import { describe, it, expect } from 'vitest'
import { confidenceTiers } from '@/design-tokens/confidence'

describe('confidence tier tokens', () => {
  it('defines all four tiers', () => {
    expect(confidenceTiers).toHaveLength(4)
    expect(confidenceTiers.map((t) => t.tier)).toEqual([1, 2, 3, 4])
  })

  it('each tier has a color token', () => {
    for (const tier of confidenceTiers) {
      expect(typeof tier.color).toBe('string')
      expect(tier.color.length).toBeGreaterThan(0)
    }
  })

  it('each tier has an icon token', () => {
    for (const tier of confidenceTiers) {
      expect(typeof tier.icon).toBe('string')
      expect(tier.icon.length).toBeGreaterThan(0)
    }
  })

  it('tier 1 is high confidence', () => {
    const tier1 = confidenceTiers.find((t) => t.tier === 1)
    expect(tier1?.label).toMatch(/high/i)
  })

  it('tier 4 is uncertain or guess', () => {
    const tier4 = confidenceTiers.find((t) => t.tier === 4)
    expect(tier4?.label).toMatch(/uncertain|guess/i)
  })
})
