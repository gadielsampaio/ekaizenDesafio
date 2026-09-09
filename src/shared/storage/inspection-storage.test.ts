import { describe, expect, it, vi } from 'vitest'
import { createInspectionFixture } from '@/test/fixtures/inspection'
import { createInspectionStorage } from './inspection-storage'
import { INSPECTION_STORAGE_KEY, inspectionStorageSchema } from './inspection-storage-schema'

describe('storage versionado de inspeções', () => {
  it('retorna um envelope vazio sem gravar quando a chave não existe', async () => {
    const storage = createInspectionStorage(localStorage)
    await expect(storage.read()).resolves.toEqual({ version: 1, inspections: [] })
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBeNull()
  })

  it('persiste e recupera inspeções e histórico em uma nova instância', async () => {
    const inspection = createInspectionFixture()
    const storage = createInspectionStorage(localStorage)
    await expect(storage.write([inspection])).resolves.toBeUndefined()

    const reloaded = createInspectionStorage(localStorage)
    await expect(reloaded.read()).resolves.toEqual({ version: 1, inspections: [inspection] })
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).not.toContain('Identificação legível?')
  })

  it('não compartilha objetos mutáveis entre leituras e o snapshot persistido', async () => {
    const inspection = createInspectionFixture()
    const storage = createInspectionStorage(localStorage)
    await storage.write([inspection])
    const snapshot = await storage.read()
    snapshot.inspections.pop()

    await expect(storage.read()).resolves.toEqual({ version: 1, inspections: [inspection] })
  })

  it.each([
    ['JSON malformado', '{'],
    ['string vazia', ''],
    ['null', 'null'],
    ['array sem envelope', '[]'],
    ['versão ausente', '{"inspections":[]}'],
    ['versão futura', '{"version":2,"inspections":[]}'],
    ['versão antiga', '{"version":0,"inspections":[]}'],
    ['versão como string', '{"version":"1","inspections":[]}'],
    ['coleção inválida', '{"version":1,"inspections":{}}'],
    ['inspeção inválida', '{"version":1,"inspections":[{"id":"1"}]}'],
  ])('rejeita %s e preserva o conteúdo inclusive em tentativa de escrita', async (_label, raw) => {
    localStorage.setItem(INSPECTION_STORAGE_KEY, raw)
    const storage = createInspectionStorage(localStorage)

    await expect(storage.read()).rejects.toThrow('Dados de inspeções inválidos')
    await expect(storage.write([createInspectionFixture()])).rejects.toThrow('Dados de inspeções inválidos')
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(raw)
  })

  it('rejeita escrita inválida sem alterar dados nem histórico existentes', async () => {
    const inspection = createInspectionFixture()
    const storage = createInspectionStorage(localStorage)
    await storage.write([inspection])
    const before = localStorage.getItem(INSPECTION_STORAGE_KEY)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    await expect(storage.write([{ ...inspection, titulo: '' }])).rejects.toThrow()

    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(before)
    await expect(storage.read()).resolves.toEqual({ version: 1, inspections: [inspection] })
  })

  it('rejeita metadados extras em vez de persistir definições das perguntas', () => {
    expect(inspectionStorageSchema.safeParse({
      version: 1,
      inspections: [{ ...createInspectionFixture(), perguntas: ['Identificação legível?'] }],
    }).success).toBe(false)
  })

  it('propaga falhas de leitura como rejeição assíncrona', async () => {
    const error = new DOMException('Acesso bloqueado', 'SecurityError')
    const adapter = {
      getItem: vi.fn(() => { throw error }),
      setItem: vi.fn(),
    }
    const storage = createInspectionStorage(adapter)

    await expect(storage.read()).rejects.toBe(error)
    await expect(storage.write([])).rejects.toBe(error)
    expect(adapter.setItem).not.toHaveBeenCalled()
  })

  it('propaga falhas de escrita e mantém o snapshot anterior', async () => {
    const inspection = createInspectionFixture()
    const storage = createInspectionStorage(localStorage)
    await storage.write([inspection])
    const before = localStorage.getItem(INSPECTION_STORAGE_KEY)
    const error = new DOMException('Sem espaço', 'QuotaExceededError')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw error })

    await expect(storage.write([])).rejects.toBe(error)
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(before)
  })
})
