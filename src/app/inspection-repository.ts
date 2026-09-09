import { reopenInspection } from '@/features/reopen-inspection/reopen-inspection'
import { createInspection } from '@/features/create-inspection/create-inspection'
import { saveInspectionDraft, submitInspection } from '@/features/edit-inspection/edit-inspection'
import { approveInspection, rejectInspection } from '@/features/review-inspection/review-inspection'
import type { Inspecao } from '@/shared/domain/inspection'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import type { createInspectionStorage } from '@/shared/storage/inspection-storage'

// A composição conecta o slice ao storage. Operações futuras não ganham stubs.
export function createLocalInspectionRepository(
  storage: ReturnType<typeof createInspectionStorage>,
): Pick<InspectionRepository, 'create' | 'findById' | 'saveDraft' | 'submit' | 'approve' | 'reject' | 'reopen'> {
  let pending = Promise.resolve()

  function enqueueMutation(action: () => Promise<Inspecao>) {
    const operation = pending.then(action)
    pending = operation.then(() => undefined, () => undefined)
    return operation
  }

  return {
    create(input) {
      return enqueueMutation(() => createInspection(storage, input))
    },
    saveDraft(id, input) {
      return enqueueMutation(() => saveInspectionDraft(storage, id, input))
    },
    submit(id, input) {
      return enqueueMutation(() => submitInspection(storage, id, input))
    },
    approve(id) {
      return enqueueMutation(() => approveInspection(storage, id))
    },
    reject(id, motivo) {
      return enqueueMutation(() => rejectInspection(storage, id, motivo))
    },
    reopen(id) {
      return enqueueMutation(() => reopenInspection(storage, id))
    },
    async findById(id) {
      const { inspections } = await storage.read()
      return inspections.find((inspection) => inspection.id === id) ?? null
    },
  }
}
