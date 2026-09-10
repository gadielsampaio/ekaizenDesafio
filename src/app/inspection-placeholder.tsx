import { ReopenInspectionButton } from '@/features/reopen-inspection/reopen-inspection-button'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import type { Inspecao } from '@/shared/domain/inspection'
import { BackToInspections } from '@/shared/ui/back-to-inspections'
import { inspectionStatus } from '@/shared/ui/inspection-status'
import { Button } from '@/shared/ui/button'
import { ReviewInspectionPanel } from '@/features/review-inspection/review-inspection-panel'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; inspection: Inspecao | null }

// Consulta os dados confirmados e mantém o histórico visível em todos os estados.
export function InspectionPlaceholder({ repository }: {
  repository: Pick<InspectionRepository, 'findById' | 'approve' | 'reject' | 'reopen'>
}) {
  const { search } = useLocation()
  const { id = '' } = useParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    repository.findById(id).then(
      (inspection) => { if (active) setState({ status: 'loaded', inspection }) },
      () => { if (active) setState({ status: 'error' }) },
    )
    return () => { active = false }
  }, [id, repository, attempt])

  if (state.status === 'loading') return <><BackToInspections /><p role="status">Carregando inspeção…</p></>
  if (state.status === 'error') {
    return (
      <>
        <BackToInspections />
        <p role="alert" className="notice border-red-200 bg-red-50 text-red-900">Não foi possível consultar a inspeção.</p>
        <Button className="self-start" onClick={() => {
          setState({ status: 'loading' })
          setAttempt((current) => current + 1)
        }}>Tentar novamente</Button>
      </>
    )
  }

  const inspection = state.inspection
  return (
    <>
      <BackToInspections />
      {inspection ? <>
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{inspection.protocolo}</p>
            <p aria-live="polite" className={`rounded-full px-3 py-1.5 text-xs font-medium ${inspectionStatus[inspection.status].style}`}>Status: {inspectionStatus[inspection.status].label}</p>
          </div>
          <h1 className="wrap-anywhere text-3xl font-semibold tracking-tight sm:text-4xl">{inspection.titulo}</h1>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div><dt className="mb-1 text-xs text-muted-foreground">Setor</dt><dd>{inspection.setor}</dd></div>
            <div><dt className="mb-1 text-xs text-muted-foreground">Responsável</dt><dd>{inspection.responsavel}</dd></div>
            <div><dt className="mb-1 text-xs text-muted-foreground">Data da inspeção</dt><dd><time dateTime={inspection.dataInspecao}>{inspection.dataInspecao.split('-').reverse().join('/')}</time></dd></div>
          </dl>
        </header>
        <ReviewInspectionPanel
          inspection={inspection} repository={repository}
          onReviewed={(updated) => setState({ status: 'loaded', inspection: updated })}
        >
          {inspection.status === 'reprovada' && <ReopenInspectionButton
            inspection={inspection} repository={repository}
            onReopened={(updated) => setState({ status: 'loaded', inspection: updated })}
          />}
          {inspection.status === 'em_preenchimento' && <Button asChild>
            <Link to={`/inspecoes/${encodeURIComponent(inspection.id)}/editar${search}`}>Editar inspeção</Link>
          </Button>}
        </ReviewInspectionPanel>
      </> : <h1 className="text-2xl font-semibold">Inspeção não encontrada</h1>}
    </>
  )
}
