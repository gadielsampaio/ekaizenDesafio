import { useEffect, useRef, useState } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import type { Inspecao } from '@/shared/domain/inspection'
import { CHECKLIST_PERGUNTAS } from '@/shared/domain/checklist'
import { checklistIdSchema, motivoReprovacaoSchema } from '@/shared/domain/inspection-schemas'
import { Button } from '@/shared/ui/button'

const eventLabels = { criacao: 'Criação', envio: 'Envio', aprovacao: 'Aprovação', reprovacao: 'Reprovação', reabertura: 'Reabertura' }

export function ReviewInspectionPanel({ inspection, repository, onReviewed }: {
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
  const returnFocus = useRef(false)
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
  useEffect(() => {
    if (rejecting) reasonRef.current?.focus()
    else if (returnFocus.current) {
      rejectButtonRef.current?.focus()
      returnFocus.current = false
    }
  }, [rejecting])

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
      onReviewed(updated)
    } catch {
      setFailure(true)
    } finally {
      processing.current = false
      setPending(null)
    }
  }

  return (
    <section className="min-w-0 space-y-6" aria-label="Revisão da inspeção">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="font-medium">Setor</dt><dd>{inspection.setor}</dd></div>
        <div><dt className="font-medium">Responsável</dt><dd>{inspection.responsavel}</dd></div>
        <div><dt className="font-medium">Data da inspeção</dt><dd><time dateTime={inspection.dataInspecao}>{inspection.dataInspecao.split('-').reverse().join('/')}</time></dd></div>
      </dl>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Checklist</h2>
        {checklistIdSchema.options.map((id) => {
          const item = inspection.checklist[id]
          return <div key={id} className="space-y-1 rounded-md border p-3">
            <h3 className="font-medium">{CHECKLIST_PERGUNTAS[id]}</h3>
            <p>{item.resposta === 'sim' ? 'Sim' : item.resposta === 'nao' ? 'Não' : 'Não respondida'}</p>
            {item.resposta === 'nao' && <p className="whitespace-pre-wrap break-words text-sm">Observação: {item.observacao}</p>}
          </div>
        })}
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico</h2>
        <ol className="space-y-3 text-sm">
          {inspection.historico.map((event) => <li key={event.id}>
            <p>{eventLabels[event.tipo]} · <time dateTime={event.dataHora}>{new Date(event.dataHora).toLocaleString('pt-BR')}</time></p>
            {event.tipo === 'reprovacao' && <p className="whitespace-pre-wrap break-words">Motivo: {event.motivo}</p>}
          </li>)}
        </ol>
      </div>
      {inspection.status === 'em_aprovacao' && <div className="space-y-4" aria-busy={pending !== null}>
        {failure && <p role="alert" className="text-sm text-destructive">Não foi possível registrar a decisão. Os dados foram mantidos. Tente novamente.</p>}
        {pending && <p role="status">{pending === 'approve' ? 'Aprovando inspeção…' : 'Reprovando inspeção…'}</p>}
        {!rejecting ? <div className="flex flex-wrap gap-3">
          <Button disabled={pending !== null} onClick={() => { void review('approve') }}>Aprovar</Button>
          <Button ref={rejectButtonRef} variant="outline" disabled={pending !== null} onClick={() => { setRejecting(true); setFailure(false) }}>Reprovar</Button>
        </div> : <form className="space-y-3" noValidate onSubmit={(event) => { event.preventDefault(); void review('reject') }}>
          <label htmlFor="motivo-reprovacao" className="block font-medium">Motivo da reprovação</label>
          <textarea
            ref={reasonRef} id="motivo-reprovacao" rows={4} required disabled={pending !== null} value={motivo}
            onChange={(event) => setMotivo(event.target.value)} aria-invalid={invalid}
            aria-describedby={invalid ? 'motivo-error' : 'motivo-help'}
            className="w-full min-w-0 rounded-md border bg-background p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p id="motivo-help" className="text-sm text-muted-foreground">De 10 a 300 caracteres, sem contar espaços nas pontas.</p>
          {invalid && <p id="motivo-error" className="text-sm text-destructive">Informe um motivo com 10 a 300 caracteres após remover os espaços nas pontas.</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending !== null}>Confirmar reprovação</Button>
            <Button type="button" variant="outline" disabled={pending !== null} onClick={() => {
              returnFocus.current = true
              setRejecting(false)
              setMotivo('')
              setInvalid(false)
              setFailure(false)
            }}>Cancelar reprovação</Button>
          </div>
        </form>}
      </div>}
    </section>
  )
}
