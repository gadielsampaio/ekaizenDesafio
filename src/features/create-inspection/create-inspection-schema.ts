import { inspecaoSchema } from '@/shared/domain/inspection-schemas'

export const createInspectionSchema = inspecaoSchema.pick({
  titulo: true,
  setor: true,
  responsavel: true,
  dataInspecao: true,
  checklist: true,
})
