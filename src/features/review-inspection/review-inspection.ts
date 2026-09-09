import { inspecaoSchema, motivoReprovacaoSchema } from '@/shared/domain/inspection-schemas'
import type { createInspectionStorage } from '@/shared/storage/inspection-storage'

type InspectionStorage = ReturnType<typeof createInspectionStorage>
type Decision = { tipo: 'aprovacao' } | { tipo: 'reprovacao'; motivo: string }

async function decide(storage: InspectionStorage, id: string, decision: Decision) {
  const { inspections } = await storage.read()
  const inspection = inspections.find((item) => item.id === id)
  if (!inspection) throw new Error('Inspeção não encontrada.')
  if (inspection.status !== 'em_aprovacao') {
    throw new Error('Somente inspeções em aprovação podem ser aprovadas ou reprovadas.')
  }
  const now = new Date().toISOString()
  const ids = new Set(inspection.historico.map((event) => event.id))
  let sequence = inspection.historico.length + 1
  while (ids.has(`${id}:${decision.tipo}:${sequence}`)) sequence += 1
  const event = decision.tipo === 'reprovacao'
    ? { id: `${id}:${decision.tipo}:${sequence}`, tipo: decision.tipo, dataHora: now, motivo: motivoReprovacaoSchema.parse(decision.motivo) }
    : { id: `${id}:${decision.tipo}:${sequence}`, tipo: decision.tipo, dataHora: now }
  const updated = inspecaoSchema.parse({
    ...inspection,
    status: decision.tipo === 'aprovacao' ? 'aprovada' : 'reprovada',
    atualizadoEm: now,
    historico: [...inspection.historico, event],
  })
  await storage.write(inspections.map((item) => item.id === id ? updated : item))
  return updated
}

export function approveInspection(storage: InspectionStorage, id: string) {
  return decide(storage, id, { tipo: 'aprovacao' })
}

export function rejectInspection(storage: InspectionStorage, id: string, motivo: string) {
  return decide(storage, id, { tipo: 'reprovacao', motivo })
}
