import { checklistIdSchema, inspecaoSchema } from '@/shared/domain/inspection-schemas'

export const saveDraftSchema = inspecaoSchema.pick({
  titulo: true,
  setor: true,
  responsavel: true,
  dataInspecao: true,
  checklist: true,
})

export const submitInspectionSchema = saveDraftSchema.superRefine((fields, context) => {
  for (const id of checklistIdSchema.options) {
    const item = fields.checklist[id]
    if (item.resposta === null) {
      context.addIssue({ code: 'custom', path: ['checklist', id, 'resposta'], message: 'Responda esta pergunta antes de enviar.' })
    }
    const length = item.observacao.trim().length
    if (item.resposta === 'nao' && (length < 10 || length > 300)) {
      context.addIssue({ code: 'custom', path: ['checklist', id, 'observacao'], message: 'Informe uma observação com 10 a 300 caracteres, sem contar espaços nas pontas.' })
    }
  }
}).transform((fields) => {
  // O parse do Zod produz uma cópia; o formulário original não é modificado.
  for (const id of checklistIdSchema.options) {
    const item = fields.checklist[id]
    if (item.resposta === 'nao') item.observacao = item.observacao.trim()
  }
  return fields
})
