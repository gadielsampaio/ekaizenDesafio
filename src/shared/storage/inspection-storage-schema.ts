import { z } from 'zod'
import { inspecaoSchema } from '@/shared/domain/inspection-schemas'

// A chave permanece estável; futuras migrações usarão a versão do envelope.
export const INSPECTION_STORAGE_KEY = 'ekaizen:inspections'
export const INSPECTION_STORAGE_VERSION = 1

export const inspectionStorageSchema = z.strictObject({
  version: z.literal(INSPECTION_STORAGE_VERSION),
  inspections: z.array(inspecaoSchema),
})

export type InspectionStorageData = z.infer<typeof inspectionStorageSchema>
