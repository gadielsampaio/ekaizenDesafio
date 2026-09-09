import { createInspection } from '@/features/create-inspection/create-inspection'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import type { createInspectionStorage } from '@/shared/storage/inspection-storage'

// A composição conecta o slice ao storage. Operações futuras não ganham stubs.
export function createLocalInspectionRepository(
  storage: ReturnType<typeof createInspectionStorage>,
): Pick<InspectionRepository, 'create' | 'findById'> {
  let pending = Promise.resolve()

  return {
    create(input) {
      // Serializa leitura + escrita nesta instância para evitar criações perdidas
      // ou identificadores repetidos em chamadas simultâneas.
      const operation = pending.then(() => createInspection(storage, input))
      pending = operation.then(() => undefined, () => undefined)
      return operation
    },
    async findById(id) {
      const { inspections } = await storage.read()
      return inspections.find((inspection) => inspection.id === id) ?? null
    },
  }
}
