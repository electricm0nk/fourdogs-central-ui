import type { ChairSku } from '@/lib/chairSandboxMock'

export type UiMode = 'light' | 'dark'

export function readUiMode(): UiMode {
  if (typeof window === 'undefined') return 'light'
  return window.localStorage.getItem('fd-ui-mode') === 'dark' ? 'dark' : 'light'
}

function normalizeNameBase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\d+(?:\.\d+)?\s*(lb|oz|ct|pk|pack)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface ParsedSize {
  groupRank: number
  normalizedValue: number
}

function parseBestSize(text: string): ParsedSize {
  const value = text.toLowerCase()
  const matches = Array.from(value.matchAll(/(\d+(?:\.\d+)?)\s*(lb|oz|ct|pk|pack)\b/g))
  if (matches.length === 0) {
    return {
      groupRank: Number.POSITIVE_INFINITY,
      normalizedValue: Number.POSITIVE_INFINITY,
    }
  }

  let best = {
    groupRank: Number.POSITIVE_INFINITY,
    normalizedValue: Number.POSITIVE_INFINITY,
  }

  for (const match of matches) {
    const qty = Number(match[1])
    const unit = match[2]
    if (!Number.isFinite(qty)) continue

    let groupRank = 2
    let normalizedValue = qty

    if (unit === 'lb' || unit === 'oz') {
      // Weight-based sizes are primary for pet food comparisons.
      groupRank = 0
      normalizedValue = unit === 'lb' ? qty * 16 : qty
    } else if (unit === 'ct' || unit === 'pk' || unit === 'pack') {
      groupRank = 1
      normalizedValue = qty
    }

    const isBetter =
      groupRank < best.groupRank ||
      (groupRank === best.groupRank && normalizedValue < best.normalizedValue)

    if (isBetter) {
      best = { groupRank, normalizedValue }
    }
  }

  return best
}

export function compareSkuByNameAndSize(a: ChairSku, b: ChairSku): number {
  const aBase = normalizeNameBase(a.name)
  const bBase = normalizeNameBase(b.name)

  const byBase = aBase.localeCompare(bBase)
  if (byBase !== 0) return byBase

  const aPackSize = parseBestSize(a.pack)
  const bPackSize = parseBestSize(b.pack)
  const aNameSize = parseBestSize(a.name)
  const bNameSize = parseBestSize(b.name)

  const aSize = aPackSize.groupRank !== Number.POSITIVE_INFINITY ? aPackSize : aNameSize
  const bSize = bPackSize.groupRank !== Number.POSITIVE_INFINITY ? bPackSize : bNameSize

  if (aSize.groupRank !== bSize.groupRank) return aSize.groupRank - bSize.groupRank
  if (aSize.normalizedValue !== bSize.normalizedValue) return aSize.normalizedValue - bSize.normalizedValue

  return a.name.localeCompare(b.name)
}

export function getQtyConfidenceTier(quantity: number): 1 | 2 | 3 | 4 {
  if (quantity >= 8) return 1
  if (quantity >= 4) return 2
  if (quantity >= 1) return 3
  return 4
}

export function getPrototypeSignalLabel(tier: 1 | 2 | 3 | 4): string {
  if (tier === 1) return 'INCREASED'
  if (tier === 2) return 'KAYLEE'
  if (tier === 3) return 'DECREASED'
  return 'GUESS'
}

export function getSignalBadgeClass(tier: 1 | 2 | 3 | 4, mode: UiMode): string {
  const dark = mode === 'dark'
  if (tier === 1) return dark ? 'bg-emerald-900 text-emerald-100 border-emerald-700' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
  if (tier === 2) return dark ? 'bg-blue-900 text-blue-100 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-300'
  if (tier === 3) return dark ? 'bg-amber-900 text-amber-100 border-amber-700' : 'bg-amber-100 text-amber-800 border-amber-300'
  return dark ? 'bg-slate-800 text-slate-100 border-slate-600' : 'bg-slate-100 text-slate-700 border-slate-300'
}

export function getHotBadgeClass(mode: UiMode): string {
  return mode === 'dark'
    ? 'bg-red-900/60 text-red-300 border-red-700'
    : 'bg-red-100 text-red-700 border-red-300'
}

export function getPriorityBadgeClass(mode: UiMode): string {
  return mode === 'dark'
    ? 'bg-fuchsia-900 text-fuchsia-100 border-fuchsia-700'
    : 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300'
}

export function getPriorityRowClass(mode: UiMode): string {
  return mode === 'dark' ? 'bg-fuchsia-950/30' : 'bg-fuchsia-50'
}

// ── Layout / chrome ────────────────────────────────────────────────────────

export function getPageClass(mode: UiMode): string {
  return mode === 'dark' ? 'bg-[#060A12] text-slate-100' : 'bg-amber-50 text-stone-900'
}

/** Header bar / top card */
export function getCardClass(mode: UiMode): string {
  return mode === 'dark' ? 'border-[#23314A] bg-[#101B31]' : 'border-amber-200 bg-amber-50'
}

/** Main content panels */
export function getSectionClass(mode: UiMode): string {
  return mode === 'dark' ? 'border-[#25324A] bg-[#0B1424]' : 'border-amber-200 bg-white'
}

export function getMutedTextClass(mode: UiMode): string {
  return mode === 'dark' ? 'text-slate-400' : 'text-stone-500'
}

// ── Table ──────────────────────────────────────────────────────────────────

export function getTableHeaderClass(mode: UiMode): string {
  return mode === 'dark' ? 'bg-[#13233C] text-[#C8D7EA]' : 'bg-amber-100 text-stone-800'
}

export function getTableRowBaseClass(mode: UiMode): string {
  return mode === 'dark' ? 'border-t border-[#23314A]' : 'border-t border-amber-100'
}

export function getTableAltRowClass(mode: UiMode): string {
  return mode === 'dark' ? 'odd:bg-[#0D1A2E]' : 'odd:bg-amber-50/40'
}

// ── Interactive controls ───────────────────────────────────────────────────

export function getTogglePillClass(mode: UiMode): string {
  return mode === 'dark'
    ? 'inline-flex rounded border border-[#23314A] bg-[#0B1424] p-1 text-xs'
    : 'inline-flex rounded border border-amber-300 bg-amber-50 p-1 text-xs'
}

export function getActiveToggleBtnClass(mode: UiMode): string {
  return mode === 'dark'
    ? 'rounded px-2 py-1 bg-blue-700 text-white'
    : 'rounded px-2 py-1 bg-teal-700 text-white'
}

export function getInactiveToggleBtnClass(mode: UiMode): string {
  return mode === 'dark' ? 'rounded px-2 py-1 text-slate-400' : 'rounded px-2 py-1 text-stone-600'
}

export function getInputClass(mode: UiMode): string {
  return mode === 'dark'
    ? 'rounded border border-[#334155] bg-[#0B1424] px-2 py-1 text-slate-100'
    : 'rounded border border-amber-300 bg-white px-2 py-1 text-stone-900'
}

export function getQtyBtnClass(mode: UiMode): string {
  return mode === 'dark'
    ? 'h-7 w-7 rounded border border-[#334155] bg-[#1E293B] text-slate-300'
    : 'h-7 w-7 rounded border border-amber-300 bg-amber-50 text-stone-700'
}

// ── Footer / chat ──────────────────────────────────────────────────────────

export function getFooterClass(mode: UiMode): string {
  return mode === 'dark'
    ? 'border-t border-[#23314A] bg-[#0F172A] text-slate-100'
    : 'border-t border-amber-200 bg-amber-50 text-stone-900'
}

export function getChatBgClass(mode: UiMode): string {
  return mode === 'dark' ? 'border-[#25324A] bg-[#0A182A]' : 'border-amber-200 bg-stone-50'
}

export function getOperatorBubbleClass(mode: UiMode): string {
  return mode === 'dark'
    ? 'ml-auto bg-blue-800 text-white'
    : 'ml-auto bg-teal-700 text-white'
}

export function getKayleeBubbleClass(mode: UiMode): string {
  return mode === 'dark'
    ? 'mr-auto border border-[#25324A] bg-[#0F1F36] text-slate-200'
    : 'mr-auto border border-amber-200 bg-amber-50 text-stone-800'
}