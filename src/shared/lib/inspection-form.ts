import type { ZodError } from 'zod'
import type { Checklist } from '@/shared/domain/inspection'
import { checklistIdSchema } from '@/shared/domain/inspection-schemas'

export interface InspectionFormValues {
  titulo: string
  setor: string
  responsavel: string
  dataInspecao: string
  checklist: Checklist
}

export type InspectionFormErrors = Record<string, string>

const metadataMessages: Record<string, string> = {
  titulo: 'Informe um título válido.',
  setor: 'Selecione um setor válido.',
  responsavel: 'Selecione um responsável válido.',
  dataInspecao: 'Informe uma data válida de calendário.',
}

export function getInspectionFormErrors(error: ZodError): InspectionFormErrors {
  const errors: InspectionFormErrors = {}
  for (const issue of error.issues) {
    const field = issue.path.join('.')
    errors[field] = metadataMessages[field] ?? issue.message
  }
  return errors
}

export function getPendingChecklistIds(error: ZodError | undefined) {
  if (!error) return []
  return checklistIdSchema.options.filter((id) => error.issues.some((issue) => (
    issue.path[0] === 'checklist' && issue.path[1] === id
  )))
}
