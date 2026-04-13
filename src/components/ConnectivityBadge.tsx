import { useConnectivity } from '@/hooks/use_connectivity'

export function ConnectivityBadge({ isSyncing = false }: { isSyncing?: boolean }) {
  const status = useConnectivity(isSyncing)

  if (status === 'offline') {
    return (
      <div
        role="alert"
        className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-800"
      >
        You're offline. Changes will sync when reconnected.
      </div>
    )
  }

  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-1 text-sm text-gray-500">
        <span className="inline-block animate-spin">⟳</span>
        Saving...
      </div>
    )
  }

  return null
}
