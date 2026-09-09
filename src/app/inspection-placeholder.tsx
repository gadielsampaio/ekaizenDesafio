import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import type { Inspecao } from '@/shared/domain/inspection'
import { Button } from '@/shared/ui/button'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; inspection: Inspecao | null }

// Confirma a persistência pela consulta; não é o slice de detalhe.
export function InspectionPlaceholder({ repository }: {
  repository: Pick<InspectionRepository, 'findById'>
}) {
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
        <p className="break-words">{state.inspection.protocolo} — {state.inspection.titulo}</p>
      )}
      <Button asChild variant="outline" className="self-start"><Link to="/">Voltar ao início</Link></Button>
    </>
  )
}
