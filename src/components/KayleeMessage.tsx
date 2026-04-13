export function KayleeMessage({
  role,
  text,
}: {
  role: 'kaylee' | 'operator'
  text: string
}) {
  const isKaylee = role === 'kaylee'
  return (
    <div
      data-testid="kaylee-message"
      className={`rounded-lg px-3 py-2 text-sm max-w-[90%] ${
        isKaylee
          ? 'bg-blue-50 text-blue-900 self-start'
          : 'bg-gray-200 text-gray-800 self-end ml-auto'
      }`}
    >
      {text}
    </div>
  )
}
