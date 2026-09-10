import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '@/app/app'
import { createLocalInspectionRepository } from '@/app/inspection-repository'
import { createInspectionStorage } from '@/shared/storage/inspection-storage'
import { createInspectionFixture } from '@/test/fixtures/inspection'
import type { Inspecao, StatusInspecao } from '@/shared/domain/inspection'

async function setup(status: StatusInspecao = 'reprovada') {
  const storage = createInspectionStorage(localStorage)
  const original = createInspectionFixture()
  original.status = status
  original.checklist.avarias = { resposta: 'nao', observacao: 'Avaria aparente na carenagem.' }
  original.historico.push({ id: 'reprovacao-1', tipo: 'reprovacao', dataHora: original.atualizadoEm, motivo: 'Corrigir avaria na carenagem.' })
  await storage.write([original])
  const repository = createLocalInspectionRepository(storage)
  const router = createMemoryRouter([{ path: '*', element: <App repository={repository} /> }], { initialEntries: [`/inspecoes/${original.id}`] })
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { name: 'Inspeção da prensa' })
  return { original, repository, user: userEvent.setup() }
}

describe('ação de reabertura', () => {
  it('reflete o novo estado e permite editar os valores preservados', async () => {
    const { user, original } = await setup()
    await user.click(screen.getByRole('button', { name: 'Reabrir para correção' }))
    expect(await screen.findByText('Status: Em preenchimento')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reabrir para correção' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Editar inspeção' }))
    expect(await screen.findByRole('textbox', { name: 'Título' })).toHaveValue(original.titulo)
    expect(within(screen.getByRole('group', { name: 'Equipamento sem avarias aparentes?' })).getByRole('radio', { name: 'Não' })).toBeChecked()
    expect(screen.getByRole('textbox', { name: /Observação/ })).toHaveValue(original.checklist.avarias.observacao)
    await user.clear(screen.getByRole('textbox', { name: 'Título' }))
    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Inspeção corrigida')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument()
  })

  it('bloqueia clique repetido e mantém estado confirmado durante processamento', async () => {
    const { user, original, repository } = await setup()
    let resolve: ((value: Inspecao) => void) | undefined
    const reopen = vi.spyOn(repository, 'reopen').mockReturnValue(new Promise<Inspecao>((done) => { resolve = done }))
    await user.dblClick(screen.getByRole('button', { name: 'Reabrir para correção' }))
    expect(reopen).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Reabrindo...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reabrindo...' }).querySelector('[data-slot="spinner"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()
    expect(screen.getByText('Status: Reprovada')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Editar inspeção' })).not.toBeInTheDocument()
    await act(async () => { resolve?.({ ...original, status: 'em_preenchimento' }) })
    expect(screen.getByText('Status: Em preenchimento')).toBeInTheDocument()
  })

  it('mantém estado e histórico em falha e permite tentar novamente', async () => {
    const { user, original, repository } = await setup()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Sem espaço') })
    await user.click(screen.getByRole('button', { name: 'Reabrir para correção' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível reabrir')
    expect(screen.getByText('Status: Reprovada')).toBeInTheDocument()
    expect(screen.getByText('Motivo: Corrigir avaria na carenagem.')).toBeInTheDocument()
    await expect(repository.findById(original.id)).resolves.toEqual(original)
    expect(screen.queryByRole('link', { name: 'Editar inspeção' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reabrir para correção' }))
    expect(await screen.findByRole('link', { name: 'Editar inspeção' })).toBeInTheDocument()
  })

  it.each(['em_preenchimento', 'em_aprovacao', 'aprovada'] as const)('não oferece reabertura em %s', async (status) => {
    await setup(status)
    expect(screen.queryByRole('button', { name: 'Reabrir para correção' })).not.toBeInTheDocument()
  })
})
