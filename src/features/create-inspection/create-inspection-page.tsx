import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useBeforeUnload, useBlocker, useNavigate } from 'react-router-dom'
import type { CreateInspectionInput, InspectionRepository } from '@/shared/contracts/inspection-repository'
import { CHECKLIST_PERGUNTAS, criarChecklistVazio } from '@/shared/domain/checklist'
import type { Checklist, ChecklistId, RespostaItemChecklist } from '@/shared/domain/inspection'
import { checklistIdSchema, responsavelSchema, setorSchema } from '@/shared/domain/inspection-schemas'
import { Button } from '@/shared/ui/button'
import { createInspectionSchema } from './create-inspection-schema'

type MetadataValues = Record<Exclude<keyof CreateInspectionInput, 'checklist'>, string>
type FormValues = MetadataValues & { checklist: Checklist }
type FieldErrors = Partial<MetadataValues>

const initialValues: MetadataValues = { titulo: '', setor: '', responsavel: '', dataInspecao: '' }
const fieldNames = ['titulo', 'setor', 'responsavel', 'dataInspecao'] as const
const fieldMessages: MetadataValues = {
  titulo: 'Informe um título com 3 a 80 caracteres, sem contar espaços nas pontas.',
  setor: 'Selecione um setor válido.',
  responsavel: 'Selecione um responsável válido.',
  dataInspecao: 'Informe uma data válida de calendário.',
}
const controlClass = 'h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive'

export function CreateInspectionPage({ repository }: {
  repository: Pick<InspectionRepository, 'create'>
}) {
  const navigate = useNavigate()
  const [values, setValues] = useState<FormValues>(() => ({
    ...initialValues,
    checklist: criarChecklistVazio(),
  }))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [failure, setFailure] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
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
    if (processing.current || saved.current) return

    const result = createInspectionSchema.safeParse(values)
    if (!result.success) {
      const nextErrors: FieldErrors = {}
      for (const field of fieldNames) {
        if (result.error.issues.some((issue) => issue.path[0] === field)) {
          nextErrors[field] = fieldMessages[field]
        }
      }
      setErrors(nextErrors)
      return
    }

    processing.current = true
    setIsSaving(true)
    setErrors({})
    setFailure(false)
    try {
      const inspection = await repository.create(result.data)
      saved.current = true
      await navigate(`/inspecoes/${encodeURIComponent(inspection.id)}`)
    } catch {
      setFailure(true)
    } finally {
      processing.current = false
      setIsSaving(false)
    }
  }

  function updateField(field: keyof MetadataValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function updateChecklistItem(id: ChecklistId, changes: Partial<RespostaItemChecklist>) {
    setValues((current) => ({
      ...current,
      checklist: {
        ...current.checklist,
        [id]: { ...current.checklist[id], ...changes },
      },
    }))
  }

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Nova inspeção</h1>
        <p className="text-muted-foreground">Identifique o equipamento. Título, setor, responsável e data são obrigatórios.</p>
      </header>
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-6" aria-busy={isSaving}>
        <fieldset disabled={isSaving} className="min-w-0 space-y-5 disabled:opacity-70">
          <legend className="sr-only">Dados da inspeção</legend>
          <div className="space-y-2">
            <label htmlFor="titulo" className="block text-sm font-medium">Título</label>
            <input
              id="titulo" name="titulo" required value={values.titulo}
              onChange={(event) => updateField('titulo', event.target.value)}
              aria-invalid={Boolean(errors.titulo)}
              aria-describedby={errors.titulo ? 'titulo-help titulo-error' : 'titulo-help'}
              className={controlClass}
            />
            <p id="titulo-help" className="text-sm text-muted-foreground">Identificação do equipamento, de 3 a 80 caracteres.</p>
            {errors.titulo && <p id="titulo-error" className="text-sm text-destructive">{errors.titulo}</p>}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label htmlFor="setor" className="block text-sm font-medium">Setor</label>
              <select
                id="setor" name="setor" required value={values.setor}
                onChange={(event) => updateField('setor', event.target.value)}
                aria-invalid={Boolean(errors.setor)} aria-describedby={errors.setor ? 'setor-error' : undefined}
                className={controlClass}
              >
                <option value="">Selecione o setor</option>
                {setorSchema.options.map((setor) => <option key={setor} value={setor}>{setor}</option>)}
              </select>
              {errors.setor && <p id="setor-error" className="text-sm text-destructive">{errors.setor}</p>}
            </div>
            <div className="min-w-0 space-y-2">
              <label htmlFor="responsavel" className="block text-sm font-medium">Responsável</label>
              <select
                id="responsavel" name="responsavel" required value={values.responsavel}
                onChange={(event) => updateField('responsavel', event.target.value)}
                aria-invalid={Boolean(errors.responsavel)} aria-describedby={errors.responsavel ? 'responsavel-error' : undefined}
                className={controlClass}
              >
                <option value="">Selecione o responsável</option>
                {responsavelSchema.options.map((responsavel) => <option key={responsavel} value={responsavel}>{responsavel}</option>)}
              </select>
              {errors.responsavel && <p id="responsavel-error" className="text-sm text-destructive">{errors.responsavel}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="dataInspecao" className="block text-sm font-medium">Data da inspeção</label>
            <input
              id="dataInspecao" name="dataInspecao" type="date" required value={values.dataInspecao}
              onChange={(event) => updateField('dataInspecao', event.target.value)}
              aria-invalid={Boolean(errors.dataInspecao)}
              aria-describedby={errors.dataInspecao ? 'data-error' : undefined}
              className={controlClass}
            />
            {errors.dataInspecao && <p id="data-error" className="text-sm text-destructive">{errors.dataInspecao}</p>}
          </div>
        </fieldset>
        <fieldset disabled={isSaving} aria-describedby="checklist-help" className="min-w-0 space-y-5 disabled:opacity-70">
          <legend className="text-lg font-semibold">Checklist</legend>
          <p id="checklist-help" className="text-sm text-muted-foreground">Você pode salvar sem responder a todas as perguntas.</p>
          {checklistIdSchema.options.map((id) => {
            const item = values.checklist[id]
            return (
              <fieldset key={id} className="min-w-0 space-y-3 rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">{CHECKLIST_PERGUNTAS[id]}</legend>
                <div className="flex gap-6">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2">
                    <input
                      type="radio" name={`checklist-${id}`} value="sim" checked={item.resposta === 'sim'}
                      onChange={() => updateChecklistItem(id, { resposta: 'sim', })}
                      className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                    Sim
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2">
                    <input
                      type="radio" name={`checklist-${id}`} value="nao" checked={item.resposta === 'nao'}
                      onChange={() => updateChecklistItem(id, { resposta: 'nao' })}
                      className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                    Não
                  </label>
                </div>
                {item.resposta === 'nao' && (
                  <div className="space-y-2">
                    <label htmlFor={`observacao-${id}`} className="block text-sm font-medium">Observação — {CHECKLIST_PERGUNTAS[id]}</label>
                    <textarea
                      id={`observacao-${id}`} name={`observacao-${id}`} rows={3} value={item.observacao}
                      onChange={(event) => updateChecklistItem(id, { observacao: event.target.value })}
                      className={`${controlClass} h-auto resize-y py-2`}
                    />
                    {!item.observacao?.trim() && (
                      <p className="text-xs text-muted-foreground text-red-700">
                        * Será obrigatório informar uma observação antes de enviar para aprovação.
                      </p>
                    )}
                  </div>
                )}
              </fieldset>
            )
          })}
        </fieldset>
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível salvar a inspeção. Seus dados foram mantidos. Tente salvar novamente.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isSaving}>{isSaving ? 'Salvando…' : 'Salvar inspeção'}</Button>
          <Button type="button" variant="outline" disabled={isSaving} onClick={() => navigate('/')}>Cancelar</Button>
        </div>
        {isSaving && <p role="status" className="text-sm text-muted-foreground">Salvando inspeção…</p>}
      </form>
    </>
  )
}
