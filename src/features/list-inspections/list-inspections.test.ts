import { describe, expect, it, vi } from 'vitest'
import { addMissingExamples } from './inspection-examples'
import { filterInspections } from './list-inspections'
import { createLocalInspectionRepository } from '@/app/inspection-repository'
import { createInspectionStorage } from '@/shared/storage/inspection-storage'
import { createInspectionFixture } from '@/test/fixtures/inspection'

const empty = { busca: '', setor: '', status: '' }

describe('exemplos e listagem', () => {
  it('inicializa exatamente os exemplos do PDF com históricos compatíveis e horários fixos', () => {
    const examples = addMissingExamples([])
    expect(examples.map((item) => [item.titulo, item.setor, item.responsavel, item.status, Object.values(item.checklist).map((answer) => answer.resposta)])).toEqual([
      ['Transportador 01', 'Produção', 'Equipe A', 'em_preenchimento', ['sim', null, null]],
      ['Furadeira 02', 'Manutenção', 'Equipe B', 'em_aprovacao', ['sim', 'nao', 'sim']],
      ['Prensa 03', 'Produção', 'Equipe A', 'aprovada', ['sim', 'sim', 'sim']],
      ['Paleteira 04', 'Almoxarifado', 'Equipe C', 'reprovada', ['sim', 'nao', 'sim']],
      ['Esmeril 05', 'Manutenção', 'Equipe B', 'em_preenchimento', [null, null, null]],
      ['Empilhadeira 06', 'Almoxarifado', 'Equipe C', 'em_aprovacao', ['sim', 'sim', 'sim']],
    ])
    expect(examples.every((item) => item.dataInspecao === '2026-09-08')).toBe(true)
    expect(examples.map((item) => item.historico.map((event) => event.tipo))).toEqual([
      ['criacao'], ['criacao', 'envio'], ['criacao', 'envio', 'aprovacao'], ['criacao', 'envio', 'reprovacao'], ['criacao'], ['criacao', 'envio'],
    ])
    for (const item of examples) {
      expect(item.atualizadoEm).toBe(item.historico.at(-1)?.dataHora)
      for (const answer of Object.values(item.checklist)) if (answer.resposta === 'nao') expect(answer.observacao).toBe('Avaria aparente na carenagem.')
    }
    expect(examples[3]?.historico.at(-1)).toMatchObject({ motivo: 'Pendência de integridade do equipamento não resolvida.' })
    expect(addMissingExamples([])).toEqual(examples)
  })

  it('não duplica em chamadas concorrentes ou recarga, nem restaura status editado', async () => {
    const storage = createInspectionStorage(localStorage)
    const repository = createLocalInspectionRepository(storage)
    await Promise.all([repository.list(), repository.list()])
    await repository.approve('exemplo-2')
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const reloaded = await createLocalInspectionRepository(storage).list()
    expect(reloaded).toHaveLength(6)
    expect(reloaded.find((item) => item.id === 'exemplo-2')?.status).toBe('aprovada')
    expect(write).not.toHaveBeenCalled()
  })

  it('preserva cadastros existentes e evita colisão de protocolos', async () => {
    const storage = createInspectionStorage(localStorage)
    const original = { ...createInspectionFixture(), protocolo: 'INS-000001' }
    await storage.write([original])
    const records = await createLocalInspectionRepository(storage).list()
    expect(records).toContainEqual(original)
    expect(records).toHaveLength(7)
    expect(new Set(records.map((item) => item.protocolo)).size).toBe(7)
    expect(new Set(records.map((item) => item.id)).size).toBe(7)
  })

  it('falha de inicialização não deixa seed parcial e permite tentar novamente', async () => {
    const repository = createLocalInspectionRepository(createInspectionStorage(localStorage))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Sem espaço') })
    await expect(repository.list()).rejects.toThrow('Sem espaço')
    expect(localStorage.length).toBe(0)
    await expect(repository.list()).resolves.toHaveLength(6)
  })

  it('combina busca, setor e status e conta antes do status', () => {
    const records = addMissingExamples([])
    const filtered = filterInspections(records, { busca: 'INS-', setor: 'Produção', status: 'aprovada' })
    expect(filtered.cards.map((item) => item.titulo)).toEqual(['Prensa 03'])
    expect(filtered.counts.map((item) => item.count)).toEqual([2, 1, 0, 1, 0])
    expect(filterInspections(records, { ...empty, busca: 'pReNsA' }).cards).toHaveLength(1)
    expect(filterInspections(records, { ...empty, busca: '000002' }).cards[0]?.titulo).toBe('Furadeira 02')
    const none = filterInspections(records, { busca: 'prensa', setor: 'Manutenção', status: '' })
    expect(none.cards).toEqual([])
    expect(none.counts.every((item) => item.count === 0)).toBe(true)
  })

  it('ordena por criação decrescente sem modificar a entrada', () => {
    const records = addMissingExamples([])
    expect(filterInspections(records, empty).cards.map((item) => item.id)).toEqual(['exemplo-6', 'exemplo-5', 'exemplo-4', 'exemplo-3', 'exemplo-2', 'exemplo-1'])
    expect(records[0]?.id).toBe('exemplo-1')
  })
})
