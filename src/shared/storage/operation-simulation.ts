import { InvalidInspectionStorageError } from './inspection-storage'

type Snapshot = { delay: number; failNext: boolean; pending: number; invalidStorage: boolean }

export function createOperationSimulation() {
  let snapshot: Snapshot = { delay: 0, failNext: false, pending: 0, invalidStorage: false }
  const listeners = new Set<() => void>()
  function update(changes: Partial<Snapshot>) {
    snapshot = { ...snapshot, ...changes }
    listeners.forEach((listener) => listener())
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    setDelay(delay: number) {
      if (!Number.isInteger(delay) || delay < 0 || delay > 30000) throw new Error('Informe um atraso entre 0 e 30000 ms.')
      update({ delay })
    },
    failNext() { update({ failNext: true }) },
    recovered() { update({ invalidStorage: false }) },
    // Captura a configuração ao chamar a operação, mesmo se ela entrar na fila.
    prepare() {
      const { delay, failNext } = snapshot
      update({ failNext: false, pending: snapshot.pending + 1 })
      return async function run<T>(action: () => Promise<T>): Promise<T> {
        try {
          if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay))
          if (failNext) throw new Error('Falha simulada na operação.')
          return await action()
        } catch (error) {
          if (error instanceof InvalidInspectionStorageError) update({ invalidStorage: true })
          throw error
        } finally {
          update({ pending: snapshot.pending - 1 })
        }
      }
    },
  }
}
