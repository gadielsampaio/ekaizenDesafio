import { describe, expect, it, vi } from 'vitest'
import { createLocalInspectionRepository } from '@/app/inspection-repository'
import type { SaveDraftInput } from '@/shared/contracts/inspection-repository'
import { criarChecklistVazio } from '@/shared/domain/checklist'
import { createInspectionStorage } from '@/shared/storage/inspection-storage'
import { INSPECTION_STORAGE_KEY } from '@/shared/storage/inspection-storage-schema'
import { createInspectionFixture } from '@/test/fixtures/inspection'

function draft(): SaveDraftInput {
  return { titulo: 'Prensa revisada', setor: 'Manutenção', responsavel: 'Equipe B', dataInspecao: '2099-12-31', checklist: criarChecklistVazio() }
}

function completeDraft(): SaveDraftInput {
  const input = draft()
  input.checklist.identificacao.resposta = 'sim'
  input.checklist.avarias.resposta = 'sim'
  input.checklist.protecoes.resposta = 'sim'
  return input
}

async function setup() {
  const storage = createInspectionStorage(localStorage)
  const original = createInspectionFixture()
  await storage.write([original])
  return { storage, original, repository: createLocalInspectionRepository(storage) }
}

describe('edição e envio na camada de dados', () => {
  it('salva metadados e checklist parcial, preservando identidade, estado e histórico', async () => {
    const { original, repository } = await setup()
    const input = draft()
    input.titulo = '  Prensa revisada  '
    input.checklist.avarias = { resposta: 'nao', observacao: 'curta' }
    const updated = await repository.saveDraft(original.id, input)

    expect(updated).toMatchObject({ ...input, titulo: 'Prensa revisada', status: 'em_preenchimento', id: original.id, protocolo: original.protocolo, criadoEm: original.criadoEm })
    expect(updated.historico).toEqual(original.historico)
    expect(Date.parse(updated.atualizadoEm)).toBeGreaterThanOrEqual(Date.parse(original.atualizadoEm))
    const reloaded = createLocalInspectionRepository(createInspectionStorage(localStorage))
    await expect(reloaded.findById(original.id)).resolves.toEqual(updated)
  })

  it.each(['', '   ', '  123456789  ', 'a'.repeat(301)])('salva observação incompleta %j mas bloqueia envio sem modificar o snapshot', async (observacao) => {
    const { original, repository } = await setup()
    const input = completeDraft()
    input.checklist.avarias = { resposta: 'nao', observacao }
    await repository.saveDraft(original.id, input)
    const before = localStorage.getItem(INSPECTION_STORAGE_KEY)
    const write = vi.spyOn(Storage.prototype, 'setItem')

    await expect(repository.submit(original.id)).rejects.toThrow('10 a 300')
    expect(write).not.toHaveBeenCalled()
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(before)
  })

  it.each([10, 300])('envia com observação de %i caracteres após trim e registra somente um envio', async (length) => {
    const { original, repository } = await setup()
    const input = completeDraft()
    input.checklist.avarias = { resposta: 'nao', observacao: `  ${'a'.repeat(length)}  ` }
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const updated = await repository.submit(original.id, input)

    expect(updated.status).toBe('em_aprovacao')
    expect(updated.titulo).toBe(input.titulo)
    expect(updated.checklist.avarias.observacao).toBe('a'.repeat(length))
    expect(input.checklist.avarias.observacao).toBe(`  ${'a'.repeat(length)}  `)
    expect(updated.historico).toEqual([...original.historico, {
      id: `${original.id}:envio:2`, tipo: 'envio', dataHora: updated.atualizadoEm,
    }])
    expect(write).toHaveBeenCalledTimes(1)
    await expect(repository.findById(original.id)).resolves.toEqual(updated)
  })

  it('bloqueia o envio incompleto inclusive pela API e não salva alterações recebidas', async () => {
    const { original, repository } = await setup()
    const before = localStorage.getItem(INSPECTION_STORAGE_KEY)
    await expect(repository.submit(original.id, draft())).rejects.toThrow('Responda esta pergunta')
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(before)
  })

  it('ignora a antiga observação como ressalva quando a resposta passa de Não para Sim', async () => {
    const { original, repository } = await setup()
    const input = completeDraft()
    input.checklist.avarias = { resposta: 'nao', observacao: 'x' }
    await repository.saveDraft(original.id, input)
    input.checklist.avarias.resposta = 'sim'
    const updated = await repository.submit(original.id, input)
    expect(updated.status).toBe('em_aprovacao')
    expect(updated.checklist.avarias).toEqual({ resposta: 'sim', observacao: 'x' })
  })

  it.each(['em_aprovacao', 'aprovada', 'reprovada'] as const)('bloqueia salvar e enviar quando o estado é %s', async (status) => {
    const { storage, original, repository } = await setup()
    await storage.write([{ ...original, status }])
    const before = localStorage.getItem(INSPECTION_STORAGE_KEY)
    const write = vi.spyOn(Storage.prototype, 'setItem')
    await expect(repository.saveDraft(original.id, draft())).rejects.toThrow('Somente inspeções em preenchimento')
    await expect(repository.submit(original.id, completeDraft())).rejects.toThrow('Somente inspeções em preenchimento')
    expect(write).not.toHaveBeenCalled()
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(before)
  })

  it('serializa envios repetidos e grava um único evento', async () => {
    const { original, repository } = await setup()
    const results = await Promise.allSettled([
      repository.submit(original.id, completeDraft()),
      repository.submit(original.id, completeDraft()),
    ])
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected'])
    const persisted = await repository.findById(original.id)
    expect(persisted?.historico.filter((event) => event.tipo === 'envio')).toHaveLength(1)
  })

  it('não permite que um rascunho concorrente reverta um envio confirmado', async () => {
    const { original, repository } = await setup()
    const results = await Promise.allSettled([
      repository.submit(original.id, completeDraft()), repository.saveDraft(original.id, draft()),
    ])
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected'])
    expect((await repository.findById(original.id))?.status).toBe('em_aprovacao')
  })

  it.each(['saveDraft', 'submit'] as const)('falha de %s não altera dados e permite tentar novamente', async (action) => {
    const { original, repository } = await setup()
    const before = localStorage.getItem(INSPECTION_STORAGE_KEY)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Falha de gravação') })
    await expect(repository[action](original.id, completeDraft())).rejects.toThrow('Falha de gravação')
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe(before)
    const updated = await repository[action](original.id, completeDraft())
    expect(updated.status).toBe(action === 'submit' ? 'em_aprovacao' : 'em_preenchimento')
  })

  it('rejeita ids inexistentes e metadados inválidos sem gravar', async () => {
    const { original, repository } = await setup()
    const write = vi.spyOn(Storage.prototype, 'setItem')
    await expect(repository.saveDraft('ausente', draft())).rejects.toThrow('não encontrada')
    await expect(repository.submit('ausente')).rejects.toThrow('não encontrada')
    await expect(repository.saveDraft(original.id, { ...draft(), titulo: 'x' })).rejects.toThrow()
    await expect(repository.submit(original.id, { ...completeDraft(), dataInspecao: '2026-02-30' })).rejects.toThrow()
    expect(write).not.toHaveBeenCalled()
  })
})
