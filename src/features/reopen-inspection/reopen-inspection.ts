import { inspecaoSchema } from '@/shared/domain/inspection-schemas'
import type { createInspectionStorage } from '@/shared/storage/inspection-storage'

export async function reopenInspection(storage: ReturnType<typeof createInspectionStorage>, id: string) {
  const { inspections } = await storage.read()
  const inspection = inspections.find((item) => item.id === id)
  if (!inspection) throw new Error('Inspeção não encontrada.')
  if (inspection.status !== 'reprovada') throw new Error('Somente inspeções reprovadas podem ser reabertas.')

  const now = new Date().toISOString()
  const ids = new Set(inspection.historico.map((event) => event.id))
  let sequence = inspection.historico.length + 1
  while (ids.has(`${id}:reabertura:${sequence}`)) sequence += 1
  const updated = inspecaoSchema.parse({
    ...inspection,
    status: 'em_preenchimento',
    atualizadoEm: now,
    historico: [...inspection.historico, { id: `${id}:reabertura:${sequence}`, tipo: 'reabertura', dataHora: now }],
  })
  await storage.write(inspections.map((item) => item.id === id ? updated : item))
  return updated
}
