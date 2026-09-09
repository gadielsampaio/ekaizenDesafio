import { reopenInspection } from '@/features/reopen-inspection/reopen-inspection'
import { createInspection } from '@/features/create-inspection/create-inspection'
import { saveInspectionDraft, submitInspection } from '@/features/edit-inspection/edit-inspection'
import { approveInspection, rejectInspection } from '@/features/review-inspection/review-inspection'
import { addMissingExamples } from '@/features/list-inspections/inspection-examples'
import { createOperationSimulation } from '@/shared/storage/operation-simulation'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import type { createInspectionStorage } from '@/shared/storage/inspection-storage'

// A composição conecta o slice ao storage. Operações futuras não ganham stubs.
export function createLocalInspectionRepository(
  storage: ReturnType<typeof createInspectionStorage>,
  simulation = createOperationSimulation(),
): InspectionRepository & { reset(): Promise<void> } {
  let pending = Promise.resolve()

  function enqueueMutation<T>(action: () => Promise<T>) {
    const run = simulation.prepare()
    const operation = pending.then(() => run(action))
    pending = operation.then(() => undefined, () => undefined)
    return operation
  }

  return {
    reset() {
      return enqueueMutation(async () => {
        await storage.reset(addMissingExamples([]))
        simulation.recovered()
      })
    },
    list() {
      return enqueueMutation(async () => {
        const { inspections } = await storage.read()
        const initialized = addMissingExamples(inspections)
        if (initialized.length !== inspections.length) await storage.write(initialized)
        return initialized
      })
    },
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
    findById(id) {
      return enqueueMutation(async () => {
        const { inspections } = await storage.read()
        return inspections.find((inspection) => inspection.id === id) ?? null
      })
    },
  }
}
