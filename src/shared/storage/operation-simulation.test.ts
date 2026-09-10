import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOperationSimulation } from './operation-simulation'
import { createInspectionStorage } from './inspection-storage'
import { createLocalInspectionRepository } from '@/app/inspection-repository'
import { createInspectionFixture } from '@/test/fixtures/inspection'
import { INSPECTION_STORAGE_KEY } from './inspection-storage-schema'

afterEach(() => vi.useRealTimers())

describe('simulação e recuperação', () => {
  it('aplica atraso antes da escrita e consome falha somente na próxima chamada', async () => {
    vi.useFakeTimers()
    const simulation = createOperationSimulation()
    simulation.setDelay(1000)
    simulation.failNext()
    const repository = createLocalInspectionRepository(createInspectionStorage(localStorage), simulation)
    const first = expect(repository.list()).rejects.toThrow('Falha simulada')
    const second = repository.list()
    expect(simulation.getSnapshot()).toMatchObject({ pending: 2, failNext: false })
    await vi.advanceTimersByTimeAsync(999)
    expect(localStorage.length).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    await first
    expect(localStorage.length).toBe(0)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(second).resolves.toHaveLength(6)
    expect(simulation.getSnapshot().pending).toBe(0)
  })

  it.each(['list', 'findById', 'create', 'createAndSubmit', 'saveDraft', 'submit', 'approve', 'reject', 'reopen'] as const)('falha de %s não escreve dados nem eventos', async (action) => {
    const simulation = createOperationSimulation()
    const storage = createInspectionStorage(localStorage)
    const repository = createLocalInspectionRepository(storage, simulation)
    const original = createInspectionFixture()
    await storage.write([original])
    const before = localStorage.getItem(INSPECTION_STORAGE_KEY)
    const { titulo, setor, responsavel, dataInspecao, checklist } = original
    const input = { titulo, setor, responsavel, dataInspecao, checklist }
    const actions = {
      list: () => repository.list(), findById: () => repository.findById(original.id),
      create: () => repository.create(input), createAndSubmit: () => repository.createAndSubmit(input), saveDraft: () => repository.saveDraft(original.id, input),
      submit: () => repository.submit(original.id), approve: () => repository.approve(original.id),
      reject: () => repository.reject(original.id, 'Pendência não resolvida.'), reopen: () => repository.reopen(original.id),
    }
    simulation.failNext()
    await expect(actions[action]()).rejects.toThrow('Falha simulada')
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(before)
    await expect(repository.findById(original.id)).resolves.toEqual(original)
  })

  it.each(['{', '{"version":2,"inspections":[]}', '{"version":1,"inspections":[{}]}'])('detecta %s e restaura somente a chave da aplicação', async (raw) => {
    localStorage.setItem(INSPECTION_STORAGE_KEY, raw)
    localStorage.setItem('outro-app', 'preservado')
    const simulation = createOperationSimulation()
    const repository = createLocalInspectionRepository(createInspectionStorage(localStorage), simulation)
    await expect(repository.list()).rejects.toThrow('Dados de inspeções inválidos')
    expect(simulation.getSnapshot().invalidStorage).toBe(true)
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(raw)
    await repository.reset()
    expect(simulation.getSnapshot().invalidStorage).toBe(false)
    expect(localStorage.getItem('outro-app')).toBe('preservado')
    await expect(repository.list()).resolves.toHaveLength(6)
    await expect(repository.list()).resolves.toHaveLength(6)
  })

  it('falha real ou simulada no reset mantém conteúdo inválido e permite retry', async () => {
    localStorage.setItem(INSPECTION_STORAGE_KEY, '{')
    const simulation = createOperationSimulation()
    const repository = createLocalInspectionRepository(createInspectionStorage(localStorage), simulation)
    await expect(repository.list()).rejects.toThrow()
    simulation.failNext()
    await expect(repository.reset()).rejects.toThrow('Falha simulada')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Sem espaço') })
    await expect(repository.reset()).rejects.toThrow('Sem espaço')
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe('{')
    expect(simulation.getSnapshot().invalidStorage).toBe(true)
    await repository.reset()
    await expect(repository.list()).resolves.toHaveLength(6)
  })

  it('valida atraso configurado', () => {
    const simulation = createOperationSimulation()
    for (const value of [-1, 1.5, NaN, Infinity, 30001]) expect(() => simulation.setDelay(value)).toThrow()
    expect(simulation.getSnapshot().delay).toBe(0)
  })
})

it.each([false, true])('bloqueia mutações durante reset e libera ao terminar (falha: %s)', async (fail) => {
  vi.useFakeTimers()
  const simulation = createOperationSimulation()
  const storage = createInspectionStorage(localStorage)
  const repository = createLocalInspectionRepository(storage, simulation)
  await repository.list()
  const before = await storage.read()
  simulation.setDelay(1000)
  if (fail) simulation.failNext()
  const reset = repository.reset()
  const finished = fail ? expect(reset).rejects.toThrow('Falha simulada') : expect(reset).resolves.toBeUndefined()
  const original = createInspectionFixture()
  const { titulo, setor, responsavel, dataInspecao, checklist } = original
  const input = { titulo, setor, responsavel, dataInspecao, checklist }
  const attempts = [repository.create(input), repository.createAndSubmit(input), repository.saveDraft('exemplo-1', input), repository.submit('exemplo-1', input), repository.approve('exemplo-2'), repository.reject('exemplo-2', 'Pendência de integridade.'), repository.reopen('exemplo-4'), repository.reset()]
  await Promise.all(attempts.map((attempt) => expect(attempt).rejects.toThrow('Aguarde a restauração')))
  expect(simulation.getSnapshot().resetting).toBe(true)
  await vi.advanceTimersByTimeAsync(1000)
  await finished
  expect(simulation.getSnapshot().resetting).toBe(false)
  expect(await storage.read()).toEqual(before)
  simulation.setDelay(0)
  await expect(repository.approve('exemplo-2')).resolves.toMatchObject({ status: 'aprovada' })
})
