import { useEffect, useState } from 'react'

export type ConnectivityStatus = 'online' | 'offline' | 'syncing'

export function useConnectivity(isSyncing = false): ConnectivityStatus {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!online) return 'offline'
  if (isSyncing) return 'syncing'
  return 'online'
}
