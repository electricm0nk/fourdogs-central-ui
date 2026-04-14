import { useEffect, useState } from 'react'

export function useIsWide(breakpointPx = 1280): boolean {
  const [wide, setWide] = useState(() => {
    if (typeof window.matchMedia !== 'function') return false
    return window.matchMedia(`(min-width: ${breakpointPx}px)`).matches
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(`(min-width: ${breakpointPx}px)`)
    const handler = (e: MediaQueryListEvent) => setWide(e.matches)
    mql.addEventListener('change', handler)
    setWide(mql.matches)
    return () => mql.removeEventListener('change', handler)
  }, [breakpointPx])

  return wide
}
