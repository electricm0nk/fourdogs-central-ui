import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use_current_user'
import { usePatchPreferences } from '@/hooks/use_patch_preferences'

export function KaylaeModeToggle() {
  const { data: user, isLoading } = useCurrentUser()
  const { mutate, isPending } = usePatchPreferences()

  if (isLoading || !user) return null

  const mode = user.preferences?.kaylee_mode ?? 'chatty'
  const nextMode = mode === 'chatty' ? 'sleepy' : 'chatty'

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => mutate({ kaylee_mode: nextMode })}
      title={`Kaylee is ${mode} — click to switch to ${nextMode}`}
    >
      Kaylee: {mode === 'chatty' ? 'Chatty' : 'Sleepy'}
    </Button>
  )
}
