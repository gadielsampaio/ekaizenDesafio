import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  await screen.findByRole('heading', { name: 'Inspeção da prensa' })
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
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1)
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
    expect(screen.getByRole('status')).toHaveTextContent(action === 'approve' ? 'Aprovando inspeção…' : 'Reprovando inspeção…')
    if (action === 'reject') {
      expect(screen.getByLabelText('Motivo da reprovação')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Cancelar reprovação' })).toBeDisabled()
      await user.keyboard('{Escape}')
      const overlay = document.querySelector('[data-slot="dialog-overlay"]')
      if (!overlay) throw new Error('Overlay ausente')
      await user.click(overlay)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    }
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

it('prende foco no modal, fecha vazio por Escape e devolve foco à origem', async () => {
  const { user } = await setup()
  const trigger = screen.getByRole('button', { name: 'Reprovar' })
  await user.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Reprovar inspeção' })
  expect(dialog).toHaveAccessibleDescription('Informe o motivo para registrar a decisão.')
  expect(screen.queryByRole('link', { name: 'Voltar para inspeções' })).not.toBeInTheDocument()
  await user.tab({ shift: true })
  expect(within(dialog).getByRole('button', { name: 'Confirmar reprovação' })).toHaveFocus()
  await user.tab()
  expect(screen.getByLabelText('Motivo da reprovação')).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it.each(['Escape', 'clique externo'] as const)('confirma descarte por %s, preserva motivo ao desistir e restaura foco', async (method) => {
  const { user, original, repository } = await setup()
  const reject = vi.spyOn(repository, 'reject')
  const trigger = screen.getByRole('button', { name: 'Reprovar' })
  await user.click(trigger)
  const reason = screen.getByLabelText('Motivo da reprovação')
  await user.type(reason, '  Motivo ainda não salvo.  ')
  async function dismiss() {
    if (method === 'Escape') await user.keyboard('{Escape}')
    else {
      const overlay = document.querySelector('[data-slot="dialog-overlay"]')
      if (!overlay) throw new Error('Overlay ausente')
      await user.click(overlay)
    }
  }
  await dismiss()
  const confirmation = screen.getByRole('alertdialog', { name: 'Descartar motivo da reprovação?' })
  const keep = within(confirmation).getByRole('button', { name: 'Continuar escrevendo' })
  expect(keep).toHaveFocus()
  await user.tab({ shift: true })
  expect(within(confirmation).getByRole('button', { name: 'Descartar motivo' })).toHaveFocus()
  await user.tab()
  expect(keep).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(reason).toHaveValue('  Motivo ainda não salvo.  ')
  await waitFor(() => expect(reason).toHaveFocus())
  await dismiss()
  await user.click(screen.getByRole('button', { name: 'Continuar escrevendo' }))
  expect(reason).toHaveValue('  Motivo ainda não salvo.  ')
  await dismiss()
  await user.click(screen.getByRole('button', { name: 'Descartar motivo' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  await waitFor(() => expect(trigger).toHaveFocus())
  expect(reject).not.toHaveBeenCalled()
  await expect(repository.findById(original.id)).resolves.toEqual(original)
  await user.click(trigger)
  expect(screen.getByLabelText('Motivo da reprovação')).toHaveValue('')
})

it('mantém a proteção de navegação e recarga com motivo não salvo', async () => {
  const { user, router } = await setup()
  const cleanUnload = new Event('beforeunload', { cancelable: true })
  fireEvent(window, cleanUnload)
  expect(cleanUnload.defaultPrevented).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Reprovar' }))
  await user.type(screen.getByLabelText('Motivo da reprovação'), 'Motivo ainda não salvo.')
  const dirtyUnload = new Event('beforeunload', { cancelable: true })
  fireEvent(window, dirtyUnload)
  expect(dirtyUnload.defaultPrevented).toBe(true)
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  await act(async () => { await router.navigate('/') })
  expect(confirm).toHaveBeenCalledWith('Descartar o motivo de reprovação não salvo?')
  expect(screen.getByLabelText('Motivo da reprovação')).toHaveValue('Motivo ainda não salvo.')
  confirm.mockReturnValue(true)
  await act(async () => { await router.navigate('/') })
  expect(await screen.findByRole('heading', { name: 'Inspeções' })).toBeInTheDocument()
})

it('mostra um único erro de aprovação e permite repetir sem alterar dados na falha', async () => {
  const { user, repository, original } = await setup()
  vi.spyOn(repository, 'approve').mockRejectedValueOnce(new Error('Falha simulada'))
  await user.click(screen.getByRole('button', { name: 'Aprovar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível registrar')
  expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1)
  await expect(repository.findById(original.id)).resolves.toEqual(original)
  await user.click(screen.getByRole('button', { name: 'Aprovar' }))
  expect(await screen.findByText('Status: Aprovada')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
