import { describe, expect, it, vi } from 'vitest'
import { createLocalInspectionRepository } from '@/app/inspection-repository'
import type { CreateInspectionInput } from '@/shared/contracts/inspection-repository'
import { criarChecklistVazio } from '@/shared/domain/checklist'
import { createInspectionStorage } from '@/shared/storage/inspection-storage'
import { INSPECTION_STORAGE_KEY } from '@/shared/storage/inspection-storage-schema'
import { createInspectionFixture } from '@/test/fixtures/inspection'
import { createInspectionSchema } from './create-inspection-schema'

const input: CreateInspectionInput = {
  titulo: '  Transportador 01  ',
  setor: 'Produção',
  responsavel: 'Equipe A',
  dataInspecao: '2026-09-08',
  checklist: criarChecklistVazio(),
}

describe('entrada da criação', () => {
  it.each([
    ['título vazio', { titulo: '' }],
    ['título em branco', { titulo: '   ' }],
    ['título curto após trim', { titulo: '  ab  ' }],
    ['título longo', { titulo: 'a'.repeat(81) }],
    ['setor ausente', { setor: undefined }],
    ['setor desconhecido', { setor: 'Financeiro' }],
    ['responsável ausente', { responsavel: undefined }],
    ['responsável desconhecido', { responsavel: 'Equipe D' }],
    ['data ausente', { dataInspecao: undefined }],
    ['data impossível', { dataInspecao: '2026-02-29' }],
    ['status fornecido pelo chamador', { status: 'aprovada' }],
    ['checklist ausente', { checklist: undefined }],
    ['checklist sem as três perguntas', { checklist: {} }],
  ])('rejeita %s', (_label, fields) => {
    expect(createInspectionSchema.safeParse({ ...input, ...fields }).success).toBe(false)
  })
})

describe('criação pelo repositório concreto', () => {
  it('normaliza e persiste o cadastro com checklist vazio e um único evento de criação', async () => {
    const storage = createInspectionStorage(localStorage)
    const repository = createLocalInspectionRepository(storage)
    const before = Date.now()
    const inspection = await repository.create(input)

    expect(inspection).toMatchObject({
      titulo: 'Transportador 01',
      setor: input.setor,
      responsavel: input.responsavel,
      dataInspecao: input.dataInspecao,
      status: 'em_preenchimento',
      checklist: {
        identificacao: { resposta: null, observacao: '' },
        avarias: { resposta: null, observacao: '' },
        protecoes: { resposta: null, observacao: '' },
      },
    })
    expect(inspection.id).toBe('inspecao-1')
    expect(inspection.protocolo).toBe('INS-000001')
    expect(Date.parse(inspection.criadoEm)).toBeGreaterThanOrEqual(before)
    expect(Date.parse(inspection.criadoEm)).toBeLessThanOrEqual(Date.now())
    expect(inspection.atualizadoEm).toBe(inspection.criadoEm)
    expect(inspection.historico).toEqual([{
      id: 'inspecao-1:criacao', tipo: 'criacao', dataHora: inspection.criadoEm,
    }])
    await expect(storage.read()).resolves.toEqual({ version: 1, inspections: [inspection] })

    // Uma nova composição lê os dados persistidos, sem depender de estado em memória.
    const reloaded = createLocalInspectionRepository(createInspectionStorage(localStorage))
    await expect(reloaded.findById(inspection.id)).resolves.toEqual(inspection)
  })

  it.each(['2000-02-29', '2099-12-31'])('aceita a data válida %s sem limitar passado ou futuro', async (dataInspecao) => {
    const repository = createLocalInspectionRepository(createInspectionStorage(localStorage))
    const inspection = await repository.create({ ...input, dataInspecao })
    expect(inspection.dataInspecao).toBe(dataInspecao)
  })

  it('persiste o checklist parcial recebido sem substituí-lo por um checklist vazio', async () => {
    const storage = createInspectionStorage(localStorage)
    const repository = createLocalInspectionRepository(storage)
    const checklist = criarChecklistVazio()
    checklist.identificacao.resposta = 'sim'
    checklist.avarias = { resposta: 'nao', observacao: 'Avaria aparente na carenagem.' }

    const inspection = await repository.create({ ...input, checklist })

    expect(inspection.checklist).toEqual(checklist)
    expect(inspection.status).toBe('em_preenchimento')
    expect(inspection.historico).toHaveLength(1)
    await expect(repository.findById(inspection.id)).resolves.toEqual(inspection)
  })

  it('valida na camada de dados e não grava nem gera histórico quando o cadastro é inválido', async () => {
    const repository = createLocalInspectionRepository(createInspectionStorage(localStorage))
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    await expect(repository.create({ ...input, titulo: ' x ' })).rejects.toThrow()

    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBeNull()
  })

  it('não perde inspeções nem duplica identificadores em criações simultâneas ou após recarga', async () => {
    const storage = createInspectionStorage(localStorage)
    const repository = createLocalInspectionRepository(storage)
    const firstTwo = await Promise.all([repository.create(input), repository.create(input)])
    const reloaded = createLocalInspectionRepository(createInspectionStorage(localStorage))
    const third = await reloaded.create(input)
    const created = [...firstTwo, third]

    expect(new Set(created.map((inspection) => inspection.id)).size).toBe(3)
    expect(new Set(created.map((inspection) => inspection.protocolo)).size).toBe(3)
    expect(created.every((inspection) => inspection.historico.length === 1)).toBe(true)
    await expect(storage.read()).resolves.toEqual({ version: 1, inspections: created })
  })

  it('desvia de colisões de id e protocolo já presentes nos dados', async () => {
    const storage = createInspectionStorage(localStorage)
    const existing = [
      { ...createInspectionFixture(), id: 'inspecao-3', protocolo: 'LEGADO-1' },
      { ...createInspectionFixture(), id: 'legado-2', protocolo: 'INS-000004' },
    ]
    await storage.write(existing)
    const repository = createLocalInspectionRepository(storage)

    const inspection = await repository.create(input)

    expect(inspection.id).toBe('inspecao-5')
    expect(inspection.protocolo).toBe('INS-000005')
    await expect(storage.read()).resolves.toEqual({ version: 1, inspections: [...existing, inspection] })
  })

  it('mantém os dados em falha de gravação e permite uma nova tentativa sem evento extra', async () => {
    const storage = createInspectionStorage(localStorage)
    const repository = createLocalInspectionRepository(storage)
    const first = await repository.create(input)
    const before = localStorage.getItem(INSPECTION_STORAGE_KEY)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Sem espaço', 'QuotaExceededError')
    })

    await expect(repository.create(input)).rejects.toThrow('Sem espaço')
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(before)
    const second = await repository.create(input)

    expect(second.historico).toHaveLength(1)
    await expect(storage.read()).resolves.toEqual({ version: 1, inspections: [first, second] })
  })

  it('rejeita criação em armazenamento corrompido sem sobrescrevê-lo', async () => {
    localStorage.setItem(INSPECTION_STORAGE_KEY, '{')
    const repository = createLocalInspectionRepository(createInspectionStorage(localStorage))

    await expect(repository.create(input)).rejects.toThrow('Dados de inspeções inválidos')
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe('{')
  })
})
