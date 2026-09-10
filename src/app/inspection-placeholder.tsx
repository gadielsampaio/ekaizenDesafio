import { ReopenInspectionButton } from '@/features/reopen-inspection/reopen-inspection-button'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import type { Inspecao } from '@/shared/domain/inspection'
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

  if (state.status === 'loading') return <p role="status">Carregando inspeção…</p>
  if (state.status === 'error') {
    return (
      <>
        <p role="alert">Não foi possível consultar a inspeção.</p>
        <Button className="self-start" onClick={() => {
          setState({ status: 'loading' })
          setAttempt((current) => current + 1)
        }}>Tentar novamente</Button>
      </>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">{state.inspection ? 'Inspeção encontrada' : 'Inspeção não encontrada'}</h1>
      {state.inspection && (
        <>
          <p className="break-words">{state.inspection.protocolo} — {state.inspection.titulo}</p>
          <p aria-live="polite">Status: {{ em_preenchimento: 'Em preenchimento', em_aprovacao: 'Em aprovação', aprovada: 'Aprovada', reprovada: 'Reprovada' }[state.inspection.status]}</p>
          {<ReviewInspectionPanel
            inspection={state.inspection} repository={repository}
            onReviewed={(inspection) => setState({ status: 'loaded', inspection })}
          />}
          {state.inspection.status === 'reprovada' && <ReopenInspectionButton
            inspection={state.inspection} repository={repository}
            onReopened={(inspection) => setState({ status: 'loaded', inspection })}
          />}
          {state.inspection.status === 'em_preenchimento' && <Button asChild className="self-start">
            <Link to={`/inspecoes/${encodeURIComponent(state.inspection.id)}/editar${search}`}>Editar inspeção</Link>
          </Button>}
        </>
      )}
      <Button asChild variant="outline" className="self-start"><Link to={`/${search}`}>Voltar ao início</Link></Button>
    </>
  )
}
