import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useBlocker, useNavigate, useParams } from 'react-router-dom'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import type { Inspecao } from '@/shared/domain/inspection'
import { getInspectionFormErrors, type InspectionFormErrors, type InspectionFormValues } from '@/shared/lib/inspection-form'
import { Button } from '@/shared/ui/button'
import { InspectionFormShell } from '@/shared/ui/inspection-form-shell'
import { BackToInspections } from '@/shared/ui/back-to-inspections'
import { InspectionFields } from '@/shared/ui/inspection-fields'
import { Spinner } from '@/shared/ui/spinner'
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog'
import { saveDraftSchema, submitInspectionSchema } from './edit-inspection-schema'

type Repository = Pick<InspectionRepository, 'findById' | 'saveDraft' | 'submit'>
type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; inspection: Inspecao | null }

export function EditInspectionPage({ repository }: { repository: Repository }) {
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
    return <>
      <BackToInspections /><p className="notice border-red-200 bg-red-50 text-red-900" role="alert">Não foi possível carregar a inspeção.</p>
      <Button onClick={() => { setState({ status: 'loading' }); setAttempt((value) => value + 1) }}>Tentar novamente</Button>
    </>
  }
  if (!state.inspection) return <><BackToInspections /><h1 className="text-2xl font-semibold">Inspeção não encontrada</h1></>
  if (state.inspection.status !== 'em_preenchimento') {
    return <>
      <BackToInspections /><h1 className="text-2xl font-semibold">Edição indisponível</h1>
      <p>Somente inspeções em preenchimento podem ser alteradas ou enviadas.</p>
      <Link className="underline" to={`/inspecoes/${encodeURIComponent(id)}${search}`}>Voltar à inspeção</Link>
    </>
  }
  return <EditInspectionForm inspection={state.inspection} repository={repository} />
}

function editableFields(inspection: Inspecao): InspectionFormValues {
  const { titulo, setor, responsavel, dataInspecao, checklist } = inspection
  return { titulo, setor, responsavel, dataInspecao, checklist }
}

function EditInspectionForm({ inspection, repository }: { inspection: Inspecao; repository: Repository }) {
  const navigate = useNavigate()
  const { search } = useLocation()
  const [confirmed, setConfirmed] = useState(inspection)
  const [values, setValues] = useState(() => editableFields(inspection))
  const [errors, setErrors] = useState<InspectionFormErrors>({})
  const [failure, setFailure] = useState(false)
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState<'save' | 'submit' | null>(null)
  const processing = useRef(false)
  const submitted = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const navigationOrigin = useRef<HTMLElement | null>(null)
  const dirty = JSON.stringify(values) !== JSON.stringify(editableFields(confirmed))
  const canSubmit = submitInspectionSchema.safeParse(values).success
  const blocker = useBlocker(() => !submitted.current && (dirty || processing.current))

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (processing.current) blocker.reset()
    else if (document.activeElement instanceof HTMLElement) navigationOrigin.current = document.activeElement
  }, [blocker])
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [errors])

  async function persist(action: 'save' | 'submit') {
    if (processing.current || submitted.current) return
    setSuccess(false)
    setFailure(false)
    const result = (action === 'save' ? saveDraftSchema : submitInspectionSchema).safeParse(values)
    if (!result.success) {
      setErrors(getInspectionFormErrors(result.error))
      return
    }
    processing.current = true
    setPending(action)
    setErrors({})
    try {
      const updated = action === 'save'
        ? await repository.saveDraft(inspection.id, result.data)
        : await repository.submit(inspection.id, result.data)
      setConfirmed(updated)
      setValues(editableFields(updated))
      if (action === 'submit') {
        submitted.current = true
        await navigate(`/inspecoes/${encodeURIComponent(updated.id)}${search}`)
      } else {
        setSuccess(true)
      }
    } catch {
      setFailure(true)
    } finally {
      processing.current = false
      setPending(null)
    }
  }

  return <InspectionFormShell title="Editar inspeção" description={`${confirmed.protocolo} · Em preenchimento`}>
    <form ref={formRef} noValidate aria-busy={pending !== null} className="space-y-6" onSubmit={(event) => {
      event.preventDefault()
      void persist('save')
    }}>
      <InspectionFields values={values} errors={errors} disabled={pending !== null} onChange={(next) => {
        setValues(next)
        setSuccess(false)
      }} />
      {failure && <p role="alert" className="notice border-red-200 bg-red-50 text-red-900">Não foi possível concluir a operação. Suas alterações foram mantidas. Tente novamente.</p>}
      {success && <p className="notice border-emerald-200 bg-emerald-50 text-emerald-900" role="status">Alterações salvas.</p>}
      {pending && <p role="status">{pending === 'save' ? 'Salvando alterações…' : 'Enviando para aprovação…'}</p>}
      <div className="form-actions">
        <Button type="submit" variant="outline" disabled={pending !== null}>{pending === 'save' && <Spinner />}{pending === 'save' ? 'Salvando...' : 'Salvar alterações'}</Button>
        <Button type="button" disabled={pending !== null || !canSubmit} onClick={() => { void persist('submit') }}>
          {pending === 'submit' && <Spinner />}{pending === 'submit' ? 'Enviando...' : 'Enviar para aprovação'}
        </Button>
        <Button type="button" variant="ghost" disabled={pending !== null} onClick={() => navigate(`/inspecoes/${encodeURIComponent(inspection.id)}${search}`)}>Cancelar</Button>
      </div>
    </form>
    <ConfirmationDialog
      open={blocker.state === 'blocked' && pending === null}
      title="Descartar alterações?"
      description="As alterações não salvas desta inspeção serão perdidas."
      confirmLabel="Descartar alterações"
      cancelLabel="Continuar editando"
      onCancel={() => { if (blocker.state === 'blocked') blocker.reset() }}
      onConfirm={() => { if (blocker.state === 'blocked') blocker.proceed() }}
      returnFocus={() => navigationOrigin.current?.focus()}
    />
  </InspectionFormShell>
}
