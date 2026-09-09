import { CHECKLIST_PERGUNTAS } from '@/shared/domain/checklist'
import type { ChecklistId, RespostaItemChecklist } from '@/shared/domain/inspection'
import { checklistIdSchema, responsavelSchema, setorSchema } from '@/shared/domain/inspection-schemas'
import type { InspectionFormValues, InspectionFormErrors } from '@/shared/lib/inspection-form'

const controlClass = 'h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive'

export function InspectionFields({ values, errors, disabled, onChange }: {
  values: InspectionFormValues
  errors: InspectionFormErrors
  disabled: boolean
  onChange: (values: InspectionFormValues) => void
}) {
  function updateField(field: 'titulo' | 'setor' | 'responsavel' | 'dataInspecao', value: string) {
    onChange({ ...values, [field]: value })
  }

  function updateChecklistItem(id: ChecklistId, changes: Partial<RespostaItemChecklist>) {
    onChange({
      ...values,
      checklist: { ...values.checklist, [id]: { ...values.checklist[id], ...changes } },
    })
  }

  return (
    <>
        <fieldset disabled={disabled} className="min-w-0 space-y-5 disabled:opacity-70">
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
        <fieldset disabled={disabled} aria-describedby="checklist-help" className="min-w-0 space-y-5 disabled:opacity-70">
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
                      type="radio" aria-invalid={Boolean(errors[`checklist.${id}.resposta`])} aria-describedby={errors[`checklist.${id}.resposta`] ? `resposta-${id}-error` : undefined}
                      name={`checklist-${id}`} value="sim" checked={item.resposta === 'sim'}
                      onChange={() => updateChecklistItem(id, { resposta: 'sim' })}
                      className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                    Sim
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2">
                    <input
                      type="radio" aria-invalid={Boolean(errors[`checklist.${id}.resposta`])} aria-describedby={errors[`checklist.${id}.resposta`] ? `resposta-${id}-error` : undefined}
                      name={`checklist-${id}`} value="nao" checked={item.resposta === 'nao'}
                      onChange={() => updateChecklistItem(id, { resposta: 'nao' })}
                      className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                    Não
                  </label>
                </div>
                {errors[`checklist.${id}.resposta`] && <p id={`resposta-${id}-error`} className="text-sm text-destructive">{errors[`checklist.${id}.resposta`]}</p>}
                {item.resposta === 'nao' && (
                  <div className="space-y-2">
                    <label htmlFor={`observacao-${id}`} className="block text-sm font-medium">Observação — {CHECKLIST_PERGUNTAS[id]}</label>
                    <textarea
                      id={`observacao-${id}`} name={`observacao-${id}`} rows={3} value={item.observacao}
                      aria-invalid={Boolean(errors[`checklist.${id}.observacao`])}
                      aria-describedby={errors[`checklist.${id}.observacao`] ? `observacao-${id}-error` : `observacao-${id}-help`}
                      onChange={(event) => updateChecklistItem(id, { observacao: event.target.value })}
                      className={`${controlClass} h-auto resize-y py-2`}
                    />
                    <p id={`observacao-${id}-help`} className="text-xs text-muted-foreground">
                      Para enviar à aprovação, informe de 10 a 300 caracteres, sem contar espaços nas pontas.
                    </p>
                    {errors[`checklist.${id}.observacao`] && <p id={`observacao-${id}-error`} className="text-sm text-destructive">{errors[`checklist.${id}.observacao`]}</p>}
                  </div>
                )}
              </fieldset>
            )
          })}
        </fieldset>
    </>
  )
}
