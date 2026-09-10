import type { CreateInspectionInput } from '@/shared/contracts/inspection-repository'
import { inspecaoSchema } from '@/shared/domain/inspection-schemas'
import type { createInspectionStorage } from '@/shared/storage/inspection-storage'
import { createInspectionSchema } from './create-inspection-schema'
import { submitInspectionSchema } from '@/features/edit-inspection/edit-inspection-schema'

export async function createInspection(
  storage: ReturnType<typeof createInspectionStorage>,
  input: CreateInspectionInput,
  action: 'draft' | 'submit' = 'draft',
) {
  const fields = (action === 'submit' ? submitInspectionSchema : createInspectionSchema).parse(input)
  const { inspections } = await storage.read()
  const ids = new Set(inspections.map((inspection) => inspection.id))
  const protocols = new Set(inspections.map((inspection) => inspection.protocolo))
  let sequence = inspections.length + 1
  let id = `inspecao-${sequence}`
  let protocolo = `INS-${String(sequence).padStart(6, '0')}`

  // Confere ambos os identificadores, inclusive em dados importados ou com lacunas.
  while (ids.has(id) || protocols.has(protocolo)) {
    sequence += 1
    id = `inspecao-${sequence}`
    protocolo = `INS-${String(sequence).padStart(6, '0')}`
  }

  const now = new Date().toISOString()
  const creationEvent = { id: `${id}:criacao`, tipo: 'criacao' as const, dataHora: now }
  const historico = action === 'submit'
    ? [creationEvent, { id: `${id}:envio:2`, tipo: 'envio' as const, dataHora: now }]
    : [creationEvent]
  const inspection = inspecaoSchema.parse({
    ...fields,
    id,
    protocolo,
    status: action === 'submit' ? 'em_aprovacao' : 'em_preenchimento',
    historico,
    criadoEm: now,
    atualizadoEm: now,
  })

  await storage.write([...inspections, inspection])
  return inspection
}
