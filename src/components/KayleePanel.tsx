import { useEffect, useState } from 'react'
import { KayleeStream } from './KayleeStream'
import { KayleeMessage } from './KayleeMessage'
import { useOrderItems } from '@/hooks/use_order_items'
import { useKayleeAnalyze } from '@/hooks/use_kaylee_analyze'
import { useKayleeStream } from '@/hooks/use_kaylee_stream'
import { useCurrentUser } from '@/hooks/use_current_user'
import { useKayleeMessage } from '@/hooks/use_kaylee_message'
import { usePatchPreferences } from '@/hooks/use_patch_preferences'

const ONBOARDING_TEXT =
  "Hi! I'm Kaylee. I review your order history and current stock to suggest quantities for each item. I'll show you my confidence level for each recommendation — green means I'm sure, red means you'll want to take a closer look. Let's get started."

interface ChatEntry {
  role: 'operator' | 'kaylee'
  text: string
}

export function KayleePanel({ orderId }: { orderId: string }) {
  const { data: items } = useOrderItems(orderId)
  const { mutate: analyze, isPending, isError } = useKayleeAnalyze()
  const { tokens, status, start } = useKayleeStream(orderId)
  const { data: user } = useCurrentUser()
  const { sendMessage } = useKayleeMessage(orderId)
  const { mutate: patchPrefs } = usePatchPreferences()

  const [draft, setDraft] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([])
  const [introDismissed, setIntroDismissed] = useState(false)

  const showIntro =
    !introDismissed && user?.preferences?.onboarding_shown !== true

  // Auto-start analyze when items arrive — but only after intro is dismissed.
  useEffect(() => {
    if (showIntro) return
    if (items && items.some((item) => item.ghost_qty === null)) {
      analyze(orderId, {
        onSuccess: () => start(),
      })
    }
  }, [items, orderId, analyze, start, showIntro])

  function handleGotIt() {
    setIntroDismissed(true)
    patchPrefs({ onboarding_shown: true })
  }

  const tier4Items = items?.filter((item) => item.confidence_tier === 4) ?? []
  const isSleepy = user?.preferences?.kaylee_mode === 'sleepy'
  const isStreaming = status === 'streaming'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || isStreaming) return

    setDraft('')
    setChatHistory((prev) => [...prev, { role: 'operator', text }])

    try {
      const token = await sendMessage(text)
      start(token)
    } catch {
      // fire-and-forget: stream will show error state
    }
  }

  return (
    <aside
      data-testid="kaylee-panel"
      className="flex flex-col gap-3 rounded-lg border bg-white p-4 h-full"
    >
      <h2 className="text-sm font-semibold text-gray-700">Kaylee</h2>

      {showIntro ? (
        <div className="flex flex-col gap-3">
          <KayleeMessage role="kaylee" text={ONBOARDING_TEXT} />
          <button
            className="self-start rounded bg-blue-600 px-3 py-1 text-sm text-white"
            onClick={handleGotIt}
          >
            Got it
          </button>
        </div>
      ) : (
        <>
          {isPending && (
            <p className="text-sm text-gray-500 italic">Kaylee is thinking…</p>
          )}
          {isError && (
            <p className="text-sm text-amber-700">Kaylee is unavailable right now.</p>
          )}
          {!isPending && !isError && (
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              {(status === 'timeout' || status === 'error') ? (
                <div className="flex flex-col gap-3">
                  <KayleeMessage
                    role="kaylee"
                    text="Hmm, I'm taking longer than usual. The grid is all yours — I'll be here if you need me."
                  />
                  <button
                    className="self-start text-sm text-blue-600 underline hover:text-blue-800"
                    onClick={() => start()}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <KayleeStream tokens={tokens} status={status} />
                  {tier4Items.map((item) => (
                    <KayleeMessage
                      key={item.id}
                      role="kaylee"
                      text={`I'm not very confident about ${item.item_name}. Want to talk through it?`}
                    />
                  ))}
                  {chatHistory.map((entry, i) => (
                    <KayleeMessage key={i} role={entry.role} text={entry.text} />
                  ))}
                  {isSleepy ? (
                    <p className="text-sm text-gray-500 italic">
                      Kaylee is in Sleepy mode. Switch to Chatty to chat.
                    </p>
                  ) : (
                    <form onSubmit={handleSubmit} className="flex gap-2 mt-auto">
                      <input
                        className="flex-1 rounded border px-2 py-1 text-sm"
                        placeholder="Ask Kaylee..."
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={500}
                        disabled={isStreaming}
                      />
                      <button
                        type="submit"
                        className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                        disabled={!draft.trim() || isStreaming}
                      >
                        Send
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  )
}
