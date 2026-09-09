import type { ZodError } from 'zod'
import type { Checklist } from '@/shared/domain/inspection'

export interface InspectionFormValues {
  titulo: string
  setor: string
  responsavel: string
  dataInspecao: string
  checklist: Checklist
}

export type InspectionFormErrors = Record<string, string>

const metadataMessages: Record<string, string> = {
  titulo: 'Informe um título com 3 a 80 caracteres, sem contar espaços nas pontas.',
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
