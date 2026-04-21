import { describe, it, expect } from 'vitest'
import { getWorksheetSignals } from '@/lib/orderGrid'

describe('getWorksheetSignals', () => {
  it('returns no worksheet signals when no Kaylee rec is loaded', () => {
    expect(getWorksheetSignals(0, undefined)).toEqual([])
    expect(getWorksheetSignals(4, undefined)).toEqual([])
    expect(getWorksheetSignals(100, undefined)).toEqual([])
  })

  it('returns KAYLEE plus INCREASED when qty is above Kaylee qty', () => {
    expect(getWorksheetSignals(5, 3)).toEqual(['kaylee', 'increased'])
  })

  it('returns only KAYLEE when qty equals Kaylee qty', () => {
    expect(getWorksheetSignals(3, 3)).toEqual(['kaylee'])
  })

  it('returns KAYLEE plus DECREASED when qty is below Kaylee qty', () => {
    expect(getWorksheetSignals(1, 4)).toEqual(['kaylee', 'decreased'])
    expect(getWorksheetSignals(0, 2)).toEqual(['kaylee', 'decreased'])
  })
})
