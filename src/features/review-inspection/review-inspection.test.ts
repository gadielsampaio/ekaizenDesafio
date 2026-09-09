import { describe, expect, it, vi } from 'vitest'
import { createLocalInspectionRepository } from '@/app/inspection-repository'
import { createInspectionStorage } from '@/shared/storage/inspection-storage'
import { INSPECTION_STORAGE_KEY } from '@/shared/storage/inspection-storage-schema'
import { createInspectionFixture } from '@/test/fixtures/inspection'
import type { StatusInspecao } from '@/shared/domain/inspection'

async function setup(status: StatusInspecao = 'em_aprovacao') {
  const storage = createInspectionStorage(localStorage)
  const original = createInspectionFixture()
  original.status = status
  original.checklist.identificacao.resposta = 'sim'
  original.checklist.avarias = { resposta: 'nao', observacao: 'Avaria aparente na carenagem.' }
  original.checklist.protecoes.resposta = 'sim'
  original.historico.push({ id: 'envio-1', tipo: 'envio', dataHora: original.atualizadoEm })
  await storage.write([original])
  return { original, repository: createLocalInspectionRepository(storage) }
}

describe('revisão na camada de dados', () => {
  it('aprova mesmo com Não no checklist e preserva todos os dados anteriores', async () => {
    const { original, repository } = await setup()
    const updated = await repository.approve(original.id)
    expect(updated).toEqual({ ...original, status: 'aprovada', atualizadoEm: updated.atualizadoEm, historico: [...original.historico, {
      id: `${original.id}:aprovacao:3`, tipo: 'aprovacao', dataHora: updated.atualizadoEm,
    }] })
    expect(Date.parse(updated.atualizadoEm)).toBeGreaterThanOrEqual(Date.parse(original.atualizadoEm))
    const reloaded = createLocalInspectionRepository(createInspectionStorage(localStorage))
    await expect(reloaded.findById(original.id)).resolves.toEqual(updated)
  })

  it.each([10, 300])('reprova com motivo de %i caracteres após trim', async (length) => {
    const { original, repository } = await setup()
    const motivo = 'a'.repeat(length)
    const updated = await repository.reject(original.id, `  ${motivo}  `)
    expect(updated).toEqual({ ...original, status: 'reprovada', atualizadoEm: updated.atualizadoEm, historico: [...original.historico, {
      id: `${original.id}:reprovacao:3`, tipo: 'reprovacao', dataHora: updated.atualizadoEm, motivo,
    }] })
    await expect(repository.findById(original.id)).resolves.toEqual(updated)
  })

  it.each(['', '   ', '  123456789  ', 'a'.repeat(301)])('rejeita motivo inválido %j sem gravar', async (motivo) => {
    const { original, repository } = await setup()
    const before = localStorage.getItem(INSPECTION_STORAGE_KEY)
    const write = vi.spyOn(Storage.prototype, 'setItem')
    await expect(repository.reject(original.id, motivo)).rejects.toThrow()
    expect(write).not.toHaveBeenCalled()
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(before)
  })

  it.each(['em_preenchimento', 'aprovada', 'reprovada'] as const)('bloqueia ambas as decisões no estado %s', async (status) => {
    const { original, repository } = await setup(status)
    const before = localStorage.getItem(INSPECTION_STORAGE_KEY)
    const write = vi.spyOn(Storage.prototype, 'setItem')
    await expect(repository.approve(original.id)).rejects.toThrow('Somente inspeções em aprovação')
    await expect(repository.reject(original.id, 'Pendência de integridade.')).rejects.toThrow('Somente inspeções em aprovação')
    expect(write).not.toHaveBeenCalled()
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(before)
  })

  it.each(['approve', 'reject'] as const)('impede %s repetido e decisão oposta concorrente', async (action) => {
    const { original, repository } = await setup()
    const results = await Promise.allSettled([
      repository[action](original.id, 'Pendência de integridade.'),
      repository[action](original.id, 'Pendência de integridade.'),
      action === 'approve' ? repository.reject(original.id, 'Pendência de integridade.') : repository.approve(original.id),
    ])
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'rejected'])
    const persisted = await repository.findById(original.id)
    expect(persisted?.historico).toHaveLength(original.historico.length + 1)
    expect(persisted?.status).toBe(action === 'approve' ? 'aprovada' : 'reprovada')
  })

  it.each(['approve', 'reject'] as const)('falha de %s preserva snapshot e permite nova tentativa', async (action) => {
    const { original, repository } = await setup()
    const before = localStorage.getItem(INSPECTION_STORAGE_KEY)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Sem espaço') })
    await expect(repository[action](original.id, 'Pendência de integridade.')).rejects.toThrow('Sem espaço')
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(before)
    const updated = await repository[action](original.id, 'Pendência de integridade.')
    expect(updated.historico).toHaveLength(original.historico.length + 1)
  })

  it('rejeita id inexistente sem escrita', async () => {
    const { repository } = await setup()
    const write = vi.spyOn(Storage.prototype, 'setItem')
    await expect(repository.approve('ausente')).rejects.toThrow('não encontrada')
    await expect(repository.reject('ausente', 'Pendência de integridade.')).rejects.toThrow('não encontrada')
    expect(write).not.toHaveBeenCalled()
  })
})
