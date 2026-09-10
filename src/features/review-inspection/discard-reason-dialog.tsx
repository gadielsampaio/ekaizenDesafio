import { useRef } from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Button } from '@/shared/ui/button'

export function DiscardReasonDialog({ open, onOpenChange, onDiscard, onKeep }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDiscard: () => void
  onKeep: () => void
}) {
  const discarded = useRef(false)
  return <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
      <AlertDialog.Content
        onOpenAutoFocus={() => { discarded.current = false }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (!discarded.current) onKeep()
        }}
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl">
        <AlertDialog.Title className="text-lg font-semibold">Descartar motivo da reprovação?</AlertDialog.Title>
        <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">O motivo ainda não foi salvo e será perdido.</AlertDialog.Description>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AlertDialog.Cancel asChild><Button variant="outline">Continuar escrevendo</Button></AlertDialog.Cancel>
          <AlertDialog.Action asChild><Button onClick={() => { discarded.current = true; onDiscard() }}>Descartar motivo</Button></AlertDialog.Action>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>
}
