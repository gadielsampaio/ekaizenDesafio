import type { SaveDraftInput } from '@/shared/contracts/inspection-repository'
import { inspecaoSchema } from '@/shared/domain/inspection-schemas'
import type { createInspectionStorage } from '@/shared/storage/inspection-storage'
import { saveDraftSchema, submitInspectionSchema } from './edit-inspection-schema'

type InspectionStorage = ReturnType<typeof createInspectionStorage>

async function readEditableInspection(storage: InspectionStorage, id: string) {
  const { inspections } = await storage.read()
  const inspection = inspections.find((item) => item.id === id)
  if (!inspection) throw new Error('Inspeção não encontrada.')
  if (inspection.status !== 'em_preenchimento') {
    throw new Error('Somente inspeções em preenchimento podem ser alteradas ou enviadas.')
  }
  return { inspection, inspections }
}

export async function saveInspectionDraft(storage: InspectionStorage, id: string, input: SaveDraftInput) {
  const { inspection, inspections } = await readEditableInspection(storage, id)
  const fields = saveDraftSchema.parse(input)
  const updated = inspecaoSchema.parse({ ...inspection, ...fields, atualizadoEm: new Date().toISOString() })
  await storage.write(inspections.map((item) => item.id === id ? updated : item))
  return updated
}

export async function submitInspection(storage: InspectionStorage, id: string, input?: SaveDraftInput) {
  const { inspection, inspections } = await readEditableInspection(storage, id)
  const fields = submitInspectionSchema.parse(input ?? {
    titulo: inspection.titulo,
    setor: inspection.setor,
    responsavel: inspection.responsavel,
    dataInspecao: inspection.dataInspecao,
    checklist: inspection.checklist,
  })
  const now = new Date().toISOString()
  const eventIds = new Set(inspection.historico.map((event) => event.id))
  let sequence = inspection.historico.length + 1
  while (eventIds.has(`${id}:envio:${sequence}`)) sequence += 1
  const updated = inspecaoSchema.parse({
    ...inspection,
    ...fields,
    status: 'em_aprovacao',
    atualizadoEm: now,
    historico: [...inspection.historico, { id: `${id}:envio:${sequence}`, tipo: 'envio', dataHora: now }],
  })
  await storage.write(inspections.map((item) => item.id === id ? updated : item))
  return updated
}
