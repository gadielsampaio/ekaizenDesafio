import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useBeforeUnload, useBlocker, useNavigate } from 'react-router-dom'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import { criarChecklistVazio } from '@/shared/domain/checklist'
import { checklistIdSchema } from '@/shared/domain/inspection-schemas'
import { Button } from '@/shared/ui/button'
import { InspectionFields } from '@/shared/ui/inspection-fields'
import { getInspectionFormErrors, type InspectionFormValues, type InspectionFormErrors } from '@/shared/lib/inspection-form'
import { submitInspectionSchema } from '@/features/edit-inspection/edit-inspection-schema'
import { createInspectionSchema } from './create-inspection-schema'

const initialValues = { titulo: '', setor: '', responsavel: '', dataInspecao: '' }
const fieldNames = ['titulo', 'setor', 'responsavel', 'dataInspecao'] as const

export function CreateInspectionPage({ repository }: {
  repository: Pick<InspectionRepository, 'create' | 'createAndSubmit'>
}) {
  const navigate = useNavigate()
  const [values, setValues] = useState<InspectionFormValues>(() => ({
    ...initialValues,
    checklist: criarChecklistVazio(),
  }))
  const [errors, setErrors] = useState<InspectionFormErrors>({})
  const [failure, setFailure] = useState(false)
  const [pending, setPending] = useState<'draft' | 'submit' | null>(null)
  const isSaving = pending !== null
  const canSubmit = submitInspectionSchema.safeParse(values).success
  const processing = useRef(false)
  const saved = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const hasChanges = fieldNames.some((field) => values[field] !== initialValues[field])
    || checklistIdSchema.options.some((id) => {
      const item = values.checklist[id]
      return item.resposta !== null || item.observacao !== ''
    })
  const blocker = useBlocker(() => !saved.current && (hasChanges || processing.current))

  useBeforeUnload((event) => {
    if (!saved.current && (hasChanges || processing.current)) event.preventDefault()
  })

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (!processing.current && window.confirm('Descartar os dados não salvos desta inspeção?')) {
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker])

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [errors])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await persist('draft')
  }

  async function persist(action: 'draft' | 'submit') {
    if (processing.current || saved.current) return

    const result = (action === 'draft' ? createInspectionSchema : submitInspectionSchema).safeParse(values)
    if (!result.success) {
      setErrors(getInspectionFormErrors(result.error))
      return
    }

    processing.current = true
    setPending(action)
    setErrors({})
    setFailure(false)
    try {
      const inspection = action === 'draft'
        ? await repository.create(result.data)
        : await repository.createAndSubmit(result.data)
      saved.current = true
      await navigate(`/inspecoes/${encodeURIComponent(inspection.id)}`)
    } catch {
      setFailure(true)
    } finally {
      processing.current = false
      setPending(null)
    }
  }

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Nova inspeção</h1>
        <p className="text-muted-foreground">Identifique o equipamento. Título, setor, responsável e data são obrigatórios.</p>
      </header>
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-6" aria-busy={isSaving}>
        <InspectionFields values={values} errors={errors} disabled={isSaving} onChange={setValues} />
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível salvar a inspeção. Seus dados foram mantidos. Tente salvar novamente.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isSaving}>{pending === 'draft' ? 'Salvando…' : 'Salvar rascunho'}</Button>
          <Button type="button" disabled={isSaving || !canSubmit} onClick={() => { void persist('submit') }}>{pending === 'submit' ? 'Enviando…' : 'Enviar para aprovação'}</Button>
          <Button type="button" variant="outline" disabled={isSaving} onClick={() => navigate('/')}>Cancelar</Button>
        </div>
        {isSaving && <p role="status" className="text-sm text-muted-foreground">{pending === 'submit' ? 'Enviando para aprovação…' : 'Salvando inspeção…'}</p>}
      </form>
    </>
  )
}
