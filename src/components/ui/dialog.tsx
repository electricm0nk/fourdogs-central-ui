import * as React from 'react'

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open: _open, onOpenChange: _onOpenChange, children }: DialogProps) {
  return <>{children}</>
}

function DialogTrigger({ children, asChild: _asChild }: { children: React.ReactNode; asChild?: boolean }) {
  return <>{children}</>
}

function DialogContent({
  children,
  className,
  overlayClassName,
}: {
  children: React.ReactNode
  className?: string
  overlayClassName?: string
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${overlayClassName ?? ''}`}
    >
      <div className={`rounded-lg shadow-xl p-6 w-full max-w-md mx-4 ${className ?? 'bg-white'}`}>
        {children}
      </div>
    </div>
  )
}

function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4">{children}</div>
}

function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>
}

function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter }
