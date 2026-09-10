import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import type { Inspecao } from '@/shared/domain/inspection'
import { CHECKLIST_PERGUNTAS } from '@/shared/domain/checklist'
import { checklistIdSchema, motivoReprovacaoSchema } from '@/shared/domain/inspection-schemas'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { DiscardReasonDialog } from './discard-reason-dialog'

const eventLabels = { criacao: 'Criação', envio: 'Envio', aprovacao: 'Aprovação', reprovacao: 'Reprovação', reabertura: 'Reabertura' }

export function ReviewInspectionPanel({ inspection, repository, onReviewed, children }: {
  children?: ReactNode
  inspection: Inspecao
  repository: Pick<InspectionRepository, 'approve' | 'reject'>
  onReviewed: (inspection: Inspecao) => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [failure, setFailure] = useState(false)
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null)
  const processing = useRef(false)
  const decided = useRef(false)
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const rejectButtonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const [discarding, setDiscarding] = useState(false)
  const dirty = rejecting && motivo !== ''
  const blocker = useBlocker(() => !decided.current && (dirty || processing.current))

  useBeforeUnload((event) => {
    if (!decided.current && (dirty || processing.current)) event.preventDefault()
  })
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (!processing.current && window.confirm('Descartar o motivo de reprovação não salvo?')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  function closeRejection() {
    setRejecting(false)
    setMotivo('')
    setInvalid(false)
    setFailure(false)
  }

  function requestClose() {
    if (processing.current) return
    if (dirty) setDiscarding(true)
    else closeRejection()
  }

  async function review(action: 'approve' | 'reject') {
    if (processing.current || decided.current || inspection.status !== 'em_aprovacao') return
    if (action === 'reject' && !motivoReprovacaoSchema.safeParse(motivo).success) {
      setInvalid(true)
      reasonRef.current?.focus()
      return
    }
    processing.current = true
    setPending(action)
    setFailure(false)
    setInvalid(false)
    try {
      const updated = action === 'approve'
        ? await repository.approve(inspection.id)
        : await repository.reject(inspection.id, motivo)
      decided.current = true
      setRejecting(false)
      onReviewed(updated)
    } catch {
      setFailure(true)
    } finally {
      processing.current = false
      setPending(null)
    }
  }

  const failureMessage = failure && <p role="alert" className="notice border-red-200 bg-red-50 text-red-900">Não foi possível registrar a decisão. Os dados foram mantidos. Tente novamente.</p>

  return (
    <section ref={panelRef} tabIndex={-1} className="grid min-w-0 gap-4 outline-none lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start" aria-label="Revisão da inspeção">
      <div className="min-w-0 space-y-4">
        <div className="surface">
          <h2 className="mb-4 font-semibold">Checklist</h2>
          {checklistIdSchema.options.map((id) => {
            const item = inspection.checklist[id]
            return <div key={id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b py-4 last:border-0 last:pb-0">
              <h3 className="text-sm font-medium">{CHECKLIST_PERGUNTAS[id]}</h3>
              <p className={`text-sm font-semibold ${item.resposta === 'sim' ? 'text-emerald-800' : item.resposta === 'nao' ? 'text-red-800' : 'text-muted-foreground'}`}>{item.resposta === 'sim' ? 'Sim' : item.resposta === 'nao' ? 'Não' : 'Não respondida'}</p>
              {item.resposta === 'nao' && <p className="col-span-2 whitespace-pre-wrap wrap-anywhere border-l-2 border-red-200 bg-red-50/40 p-3 text-sm text-muted-foreground">Observação: {item.observacao}</p>}
            </div>
          })}
        </div>
        {inspection.status === 'em_aprovacao' && <div className="surface space-y-4" aria-busy={pending !== null}>
          {!rejecting && failureMessage}
          {pending === 'approve' && <p role="status">Aprovando inspeção…</p>}
          <div className="flex flex-wrap gap-3">
            <Button disabled={pending !== null} onClick={() => { void review('approve') }}>Aprovar</Button>
            <Dialog open={rejecting} onOpenChange={(open) => {
              if (open) { setRejecting(true); setFailure(false) }
              else requestClose()
            }}>
              <DialogTrigger asChild><Button ref={rejectButtonRef} variant="outline" className="border-red-200 text-red-800 hover:bg-red-50 hover:text-red-900" disabled={pending !== null}>Reprovar</Button></DialogTrigger>
              <DialogContent
                onOpenAutoFocus={(event) => { event.preventDefault(); reasonRef.current?.focus() }}
                onCloseAutoFocus={(event) => {
                  event.preventDefault()
                  if (rejectButtonRef.current) rejectButtonRef.current.focus()
                  else panelRef.current?.focus()
                }}
                onEscapeKeyDown={(event) => { if (processing.current || discarding) event.preventDefault() }}
                onPointerDownOutside={(event) => { if (processing.current || discarding) event.preventDefault() }}
              >
                <DialogTitle className="text-lg font-semibold">Reprovar inspeção</DialogTitle>
                <DialogDescription className="mt-2 mb-6 text-sm text-muted-foreground">Informe o motivo para registrar a decisão.</DialogDescription>
                <form className="space-y-3" aria-busy={pending !== null} noValidate onSubmit={(event) => { event.preventDefault(); void review('reject') }}>
                  <label htmlFor="motivo-reprovacao" className="block text-sm font-medium">Motivo da reprovação</label>
                  <textarea
                    ref={reasonRef} id="motivo-reprovacao" rows={4} required disabled={pending !== null} value={motivo}
                    onChange={(event) => setMotivo(event.target.value)} aria-invalid={invalid}
                    aria-describedby={invalid ? 'motivo-error' : 'motivo-help'}
                    className="field-control py-3"
                  />
                  <p id="motivo-help" className="text-sm text-muted-foreground">De 10 a 300 caracteres, sem contar espaços nas pontas.</p>
                  {invalid && <p id="motivo-error" className="notice border-red-200 bg-red-50 text-red-900">Informe um motivo com 10 a 300 caracteres após remover os espaços nas pontas.</p>}
                  {failureMessage}
                  {pending === 'reject' && <p role="status">Reprovando inspeção…</p>}
                  <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" disabled={pending !== null} onClick={closeRejection}>Cancelar reprovação</Button>
                    <Button type="submit" disabled={pending !== null}>Confirmar reprovação</Button>
                  </div>
                </form>
                <DiscardReasonDialog open={discarding} onOpenChange={setDiscarding} onDiscard={closeRejection} onKeep={() => reasonRef.current?.focus()} />
              </DialogContent>
            </Dialog>
          </div>
        </div>}
        {children}
      </div>
      <div className="surface min-w-0">
        <h2 className="mb-5 font-semibold">Histórico</h2>
        <ol className="text-sm">
          {inspection.historico.map((event) => <li key={event.id} className="relative ml-1 border-l pb-6 pl-5 last:pb-0 before:absolute before:-left-1 before:top-1 before:size-2 before:rounded-full before:bg-neutral-400">
            <p>{eventLabels[event.tipo]} · <time className="mt-1 block text-xs text-muted-foreground" dateTime={event.dataHora}>{new Date(event.dataHora).toLocaleString('pt-BR')}</time></p>
            {event.tipo === 'reprovacao' && <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-xs leading-relaxed text-muted-foreground">Motivo: {event.motivo}</p>}
          </li>)}
        </ol>
      </div>
    </section>
  )
}
