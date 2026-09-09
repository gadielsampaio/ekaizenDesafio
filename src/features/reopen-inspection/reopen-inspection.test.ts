import { describe, expect, it, vi } from 'vitest'
import { createLocalInspectionRepository } from '@/app/inspection-repository'
import { createInspectionStorage } from '@/shared/storage/inspection-storage'
import { INSPECTION_STORAGE_KEY } from '@/shared/storage/inspection-storage-schema'
import { createInspectionFixture } from '@/test/fixtures/inspection'
import type { StatusInspecao } from '@/shared/domain/inspection'

async function setup(status: StatusInspecao = 'reprovada') {
  const storage = createInspectionStorage(localStorage)
  const original = createInspectionFixture()
  original.status = status
  original.checklist.identificacao.resposta = 'sim'
  original.checklist.avarias = { resposta: 'nao', observacao: 'Avaria aparente na carenagem.' }
  original.checklist.protecoes.resposta = 'sim'
  original.historico.push(
    { id: 'envio-1', tipo: 'envio', dataHora: original.atualizadoEm },
    { id: 'reprovacao-1', tipo: 'reprovacao', dataHora: original.atualizadoEm, motivo: 'Corrigir avaria na carenagem.' },
  )
  await storage.write([original])
  return { original, repository: createLocalInspectionRepository(storage) }
}

describe('reabertura na camada de dados', () => {
  it('preserva campos, checklist e histórico e persiste um único evento de reabertura', async () => {
    const { original, repository } = await setup()
    const updated = await repository.reopen(original.id)
    expect(updated).toEqual({ ...original, status: 'em_preenchimento', atualizadoEm: updated.atualizadoEm, historico: [...original.historico, {
      id: `${original.id}:reabertura:4`, tipo: 'reabertura', dataHora: updated.atualizadoEm,
    }] })
    expect(Number.isNaN(Date.parse(updated.atualizadoEm))).toBe(false)
    const reloaded = createLocalInspectionRepository(createInspectionStorage(localStorage))
    await expect(reloaded.findById(original.id)).resolves.toEqual(updated)
  })

  it.each(['em_preenchimento', 'em_aprovacao', 'aprovada'] as const)('bloqueia reabertura em %s sem escrita', async (status) => {
    const { original, repository } = await setup(status)
    const before = localStorage.getItem(INSPECTION_STORAGE_KEY)
    const write = vi.spyOn(Storage.prototype, 'setItem')
    await expect(repository.reopen(original.id)).rejects.toThrow('Somente inspeções reprovadas')
    expect(write).not.toHaveBeenCalled()
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(before)
  })

  it('serializa reaberturas concorrentes sem duplicar evento', async () => {
    const { original, repository } = await setup()
    const results = await Promise.allSettled([repository.reopen(original.id), repository.reopen(original.id)])
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected'])
    const persisted = await repository.findById(original.id)
    expect(persisted?.historico).toHaveLength(original.historico.length + 1)
    expect(persisted?.status).toBe('em_preenchimento')
  })

  it('preserva snapshot em falha e permite nova tentativa', async () => {
    const { original, repository } = await setup()
    const before = localStorage.getItem(INSPECTION_STORAGE_KEY)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Sem espaço') })
    await expect(repository.reopen(original.id)).rejects.toThrow('Sem espaço')
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(before)
    const updated = await repository.reopen(original.id)
    expect(updated.historico).toHaveLength(original.historico.length + 1)
  })

  it('permite corrigir, reenviar e reabrir novamente preservando eventos anteriores', async () => {
    const { original, repository } = await setup()
    const reopened = await repository.reopen(original.id)
    await repository.saveDraft(original.id, { titulo: 'Inspeção corrigida', setor: reopened.setor, responsavel: reopened.responsavel, dataInspecao: reopened.dataInspecao, checklist: reopened.checklist })
    await repository.submit(original.id)
    await repository.reject(original.id, 'Nova correção necessária.')
    const updated = await repository.reopen(original.id)
    expect(updated.titulo).toBe('Inspeção corrigida')
    expect(updated.checklist).toEqual(original.checklist)
    expect(updated.historico.slice(0, original.historico.length)).toEqual(original.historico)
    expect(updated.historico.slice(original.historico.length).map((event) => event.tipo)).toEqual(['reabertura', 'envio', 'reprovacao', 'reabertura'])
    expect(new Set(updated.historico.map((event) => event.id)).size).toBe(updated.historico.length)
  })

  it('rejeita id inexistente sem escrita', async () => {
    const { repository } = await setup()
    const write = vi.spyOn(Storage.prototype, 'setItem')
    await expect(repository.reopen('ausente')).rejects.toThrow('não encontrada')
    expect(write).not.toHaveBeenCalled()
  })
})
