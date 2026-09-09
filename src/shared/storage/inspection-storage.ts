import type { Inspecao } from '@/shared/domain/inspection'
import {
  INSPECTION_STORAGE_KEY,
  INSPECTION_STORAGE_VERSION,
  inspectionStorageSchema,
  type InspectionStorageData,
} from './inspection-storage-schema'

// Injetado para testes. A composição futura poderá passar window.localStorage.
export function createInspectionStorage(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  function readSnapshot(): InspectionStorageData {
    const raw = storage.getItem(INSPECTION_STORAGE_KEY)

    if (raw === null) {
      return { version: INSPECTION_STORAGE_VERSION, inspections: [] }
    }

    try {
      const parsed: unknown = JSON.parse(raw)
      return inspectionStorageSchema.parse(parsed)
    } catch (cause) {
      // Nunca apagar ou substituir silenciosamente dados que não entendemos.
      throw new Error('Dados de inspeções inválidos ou versão de storage não suportada.', {
        cause,
      })
    }
  }

  return {
    async read(): Promise<InspectionStorageData> {
      return readSnapshot()
    },
    async write(inspections: readonly Inspecao[]): Promise<void> {
      const validated = inspectionStorageSchema.parse({
        version: INSPECTION_STORAGE_VERSION,
        inspections,
      })

      // Bloqueia também a sobrescrita de um envelope corrompido/desconhecido.
      // Sem await entre leitura e escrita, não há intercalação neste contexto JS.
      readSnapshot()
      storage.setItem(INSPECTION_STORAGE_KEY, JSON.stringify(validated))
    },
  }
}
