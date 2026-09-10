import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { useRef } from 'react'
import { Button } from '@/shared/ui/button'

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  disabled = false,
  onConfirm,
  onCancel,
  returnFocus,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  disabled?: boolean
  onConfirm: () => void
  onCancel: () => void
  returnFocus?: () => void
}) {
  const confirmed = useRef(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <AlertDialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !confirmed.current) onCancel()
        confirmed.current = false
      }}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <AlertDialogPrimitive.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            confirmed.current = false
            cancelRef.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocus?.()
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl outline-none"
        >
          <AlertDialogPrimitive.Title className="text-lg font-semibold">{title}</AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</AlertDialogPrimitive.Description>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button ref={cancelRef} type="button" variant="outline" disabled={disabled}>{cancelLabel}</Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button
                type="button"
                disabled={disabled}
                onClick={() => {
                  confirmed.current = true
                  onConfirm()
                }}
              >
                {confirmLabel}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
