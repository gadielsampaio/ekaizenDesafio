import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '@/app/app'
import { createLocalInspectionRepository } from '@/app/inspection-repository'
import { createInspectionStorage } from '@/shared/storage/inspection-storage'
import { createInspectionFixture } from '@/test/fixtures/inspection'
import type { StatusInspecao } from '@/shared/domain/inspection'

async function setup(status: StatusInspecao = 'em_aprovacao') {
  const original = createInspectionFixture()
  original.status = status
  original.checklist.identificacao.resposta = 'sim'
  original.checklist.identificacao.observacao = 'Observação antiga inativa.'
  original.checklist.avarias = { resposta: 'nao', observacao: 'Avaria na carenagem.' }
  original.checklist.protecoes.resposta = 'sim'
  original.historico.push({ id: 'envio-1', tipo: 'envio', dataHora: original.atualizadoEm })
  const storage = createInspectionStorage(localStorage)
  await storage.write([original])
  const repository = createLocalInspectionRepository(storage)
  const router = createMemoryRouter([{ path: '*', element: <App repository={repository} /> }], { initialEntries: [`/inspecoes/${original.id}`] })
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { name: 'Inspeção encontrada' })
  return { original, repository, router, user: userEvent.setup() }
}

describe('revisão pela interface', () => {
  it('exibe os dados somente leitura e permite aprovar com ressalva no checklist', async () => {
    const { original, repository, user } = await setup()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Editar inspeção' })).not.toBeInTheDocument()
    expect(screen.getByText('Observação: Avaria na carenagem.')).toBeInTheDocument()
    expect(screen.queryByText(/Observação antiga inativa/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aprovar' }))
    expect(await screen.findByText('Status: Aprovada')).toBeInTheDocument()
    expect(screen.getByText(/Aprovação ·/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument()
    expect((await repository.findById(original.id))?.status).toBe('aprovada')
  })

  it('valida o motivo, permite corrigir e mostra a reprovação confirmada imediatamente', async () => {
    const { original, repository, user } = await setup()
    const reject = vi.spyOn(repository, 'reject')
    await user.click(screen.getByRole('button', { name: 'Reprovar' }))
    const reason = screen.getByLabelText('Motivo da reprovação')
    expect(reason).toHaveFocus()
    for (const invalid of ['', '   ', 'curto', 'a'.repeat(301)]) {
      await user.clear(reason)
      if (invalid) await user.type(reason, invalid)
      await user.click(screen.getByRole('button', { name: 'Confirmar reprovação' }))
      expect(reason).toHaveAttribute('aria-invalid', 'true')
      expect(reason).toHaveAccessibleDescription(/10 a 300/)
    }
    expect(reject).not.toHaveBeenCalled()
    await user.clear(reason)
    await user.type(reason, '  Pendência de integridade.  ')
    await user.click(screen.getByRole('button', { name: 'Confirmar reprovação' }))
    expect(await screen.findByText('Status: Reprovada')).toBeInTheDocument()
    expect(screen.getByText('Motivo: Pendência de integridade.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect((await repository.findById(original.id))?.status).toBe('reprovada')
  })

  it('cancelar reprovação não chama mutações e retorna o foco ao botão', async () => {
    const { original, repository, user } = await setup()
    const reject = vi.spyOn(repository, 'reject')
    const approve = vi.spyOn(repository, 'approve')
    await user.click(screen.getByRole('button', { name: 'Reprovar' }))
    await user.type(screen.getByLabelText('Motivo da reprovação'), 'Pendência de integridade.')
    await user.click(screen.getByRole('button', { name: 'Cancelar reprovação' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reprovar' })).toHaveFocus()
    expect(reject).not.toHaveBeenCalled()
    expect(approve).not.toHaveBeenCalled()
    await expect(repository.findById(original.id)).resolves.toEqual(original)
  })

  it('falha na reprovação preserva motivo, rota e estado confirmado e permite tentar novamente', async () => {
    const { original, repository, router, user } = await setup()
    await user.click(screen.getByRole('button', { name: 'Reprovar' }))
    await user.type(screen.getByLabelText('Motivo da reprovação'), '  Pendência de integridade.  ')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Sem espaço') })
    await user.click(screen.getByRole('button', { name: 'Confirmar reprovação' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível registrar')
    expect(screen.getByLabelText('Motivo da reprovação')).toHaveValue('  Pendência de integridade.  ')
    expect(screen.getByText('Status: Em aprovação')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/inspecoes/${original.id}`)
    await expect(repository.findById(original.id)).resolves.toEqual(original)
    await user.click(screen.getByRole('button', { name: 'Confirmar reprovação' }))
    expect(await screen.findByText('Status: Reprovada')).toBeInTheDocument()
  })

  it.each(['approve', 'reject'] as const)('bloqueia repetição durante %s', async (action) => {
    const { original, repository, user } = await setup()
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    const originalAction = repository[action]
    const spy = action === 'approve'
      ? vi.spyOn(repository, 'approve').mockImplementation(async (id) => { await gate; return originalAction(id, 'Pendência de integridade.') })
      : vi.spyOn(repository, 'reject').mockImplementation(async (id, motivo) => { await gate; return originalAction(id, motivo) })
    if (action === 'reject') {
      await user.click(screen.getByRole('button', { name: 'Reprovar' }))
      await user.type(screen.getByLabelText('Motivo da reprovação'), 'Pendência de integridade.')
    }
    const button = screen.getByRole('button', { name: action === 'approve' ? 'Aprovar' : 'Confirmar reprovação' })
    await user.dblClick(button)
    expect(button).toBeDisabled()
    expect(spy).toHaveBeenCalledTimes(1)
    if (action === 'reject') expect(screen.getByLabelText('Motivo da reprovação')).toBeDisabled()
    await expect(repository.findById(original.id)).resolves.toEqual(original)
    await act(async () => { release?.() })
    expect(await screen.findByText(action === 'approve' ? 'Status: Aprovada' : 'Status: Reprovada')).toBeInTheDocument()
  })

  it.each(['em_preenchimento', 'aprovada', 'reprovada'] as const)('não oferece decisões em %s', async (status) => {
    await setup(status)
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reprovar' })).not.toBeInTheDocument()
  })
})
