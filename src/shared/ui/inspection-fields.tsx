import { CHECKLIST_PERGUNTAS } from '@/shared/domain/checklist'
import type { ChecklistId, RespostaItemChecklist } from '@/shared/domain/inspection'
import { checklistIdSchema, responsavelSchema, setorSchema } from '@/shared/domain/inspection-schemas'
import type { InspectionFormValues, InspectionFormErrors } from '@/shared/lib/inspection-form'

const controlClass = 'field-control'

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
        <fieldset disabled={disabled} className="surface space-y-5 disabled:opacity-70">
          <legend className="sr-only">Dados da inspeção</legend>
          <h2 className="font-semibold">Dados da inspeção</h2>
          <div className="space-y-2">
            <label htmlFor="titulo" className="block text-sm font-medium">Título</label>
            <input
              id="titulo" name="titulo" placeholder="Ex.: Empilhadeira 06" required value={values.titulo}
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
        <fieldset disabled={disabled} aria-describedby="checklist-help" className="surface space-y-5 disabled:opacity-70">
          <legend className="sr-only">Checklist</legend>
          <h2 className="font-semibold">Checklist</h2>
          <p id="checklist-help" className="text-sm text-muted-foreground">Você pode salvar sem responder a todas as perguntas.</p>
          {checklistIdSchema.options.map((id) => {
            const item = values.checklist[id]
            return (
              <fieldset key={id} className="min-w-0 space-y-4 rounded-xl border p-4">
                <legend className="sr-only">{CHECKLIST_PERGUNTAS[id]}</legend>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p aria-hidden="true" className="text-sm font-medium">{CHECKLIST_PERGUNTAS[id]}</p>
                <div className="flex w-fit gap-1 rounded-lg bg-neutral-100 p-1">
                  <label className="relative cursor-pointer">
                    <input
                      type="radio" aria-invalid={Boolean(errors[`checklist.${id}.resposta`])} aria-describedby={errors[`checklist.${id}.resposta`] ? `resposta-${id}-error` : undefined}
                      name={`checklist-${id}`} value="sim" checked={item.resposta === 'sim'}
                      onChange={() => updateChecklistItem(id, { resposta: 'sim' })}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-11 min-w-14 items-center justify-center rounded-md px-3 text-sm text-muted-foreground peer-checked:bg-white peer-checked:font-semibold peer-checked:text-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-disabled:opacity-50">Sim</span>
                  </label>
                  <label className="relative cursor-pointer">
                    <input
                      type="radio" aria-invalid={Boolean(errors[`checklist.${id}.resposta`])} aria-describedby={errors[`checklist.${id}.resposta`] ? `resposta-${id}-error` : undefined}
                      name={`checklist-${id}`} value="nao" checked={item.resposta === 'nao'}
                      onChange={() => updateChecklistItem(id, { resposta: 'nao' })}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-11 min-w-14 items-center justify-center rounded-md px-3 text-sm text-muted-foreground peer-checked:bg-white peer-checked:font-semibold peer-checked:text-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-disabled:opacity-50">Não</span>
                  </label>
                </div>
                </div>
                {errors[`checklist.${id}.resposta`] && <p id={`resposta-${id}-error`} className="text-sm text-destructive">{errors[`checklist.${id}.resposta`]}</p>}
                {item.resposta === 'nao' && (
                  <div className="space-y-2">
                    <label htmlFor={`observacao-${id}`} className="block text-sm font-medium">Observação — {CHECKLIST_PERGUNTAS[id]}</label>
                    <textarea
                      id={`observacao-${id}`} name={`observacao-${id}`} placeholder="Descreva o problema encontrado." rows={3} value={item.observacao}
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
