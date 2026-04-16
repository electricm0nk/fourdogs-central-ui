import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface VersionsResponse {
  velocity_version: number
  kaylee_version: number | null
}

/**
 * Fetches the current velocity wiring version from GET /v1/versions.
 * Returns a formatted string for display:
 * - If both versions are present: "<velocity_version>.<kaylee_version>"  (e.g. "18.1")
 * - If only velocity is present: "<velocity_version>"  (e.g. "3")
 */
export function formatWiringVersion(data: VersionsResponse | undefined): string {
  if (!data) return ''
  if (data.kaylee_version != null) {
    return `${data.velocity_version}.${data.kaylee_version}`
  }
  return String(data.velocity_version)
}

export function useVersions() {
  return useQuery({
    queryKey: ['versions'],
    queryFn: () =>
      api.get<{ data: VersionsResponse }>('/v1/versions').then((r) => {
        const raw = r as unknown as { data: VersionsResponse }
        return raw.data
      }),
    staleTime: 5 * 60 * 1000,
  })
}
