import { useEffect, useRef } from 'react'
import { KayleeMessage } from './KayleeMessage'
import type { StreamStatus } from '@/hooks/use_kaylee_stream'

export function KayleeStream({
  tokens,
  status,
}: {
  tokens: string[]
  status: StreamStatus
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [tokens])

  const fullText = tokens.join('')

  return (
    <div
      data-testid="kaylee-stream"
      className="flex-1 overflow-y-auto rounded border bg-gray-50 p-3 space-y-2 h-[480px]"
    >
      {fullText && <KayleeMessage role="kaylee" text={fullText} />}
      {status === 'streaming' && (
        <div
          data-testid="kaylee-typing"
          className="flex gap-1 px-2 py-1"
          aria-label="Kaylee is typing"
        >
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
