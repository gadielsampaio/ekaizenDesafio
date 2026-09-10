import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '@/app/app'
import { createLocalInspectionRepository } from '@/app/inspection-repository'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import type { Inspecao } from '@/shared/domain/inspection'
import { CHECKLIST_PERGUNTAS } from '@/shared/domain/checklist'
import { createInspectionStorage } from '@/shared/storage/inspection-storage'
import { createOperationSimulation } from '@/shared/storage/operation-simulation'
import { INSPECTION_STORAGE_KEY } from '@/shared/storage/inspection-storage-schema'
import { createInspectionFixture } from '@/test/fixtures/inspection'

function renderCreation(repository: Pick<InspectionRepository, 'create' | 'findById'> & Partial<Pick<InspectionRepository, 'createAndSubmit'>>) {
  const appRepository = { ...createLocalInspectionRepository(createInspectionStorage(localStorage)), ...repository }
  const router = createMemoryRouter([{ path: '*', element: <App repository={appRepository} /> }], {
    initialEntries: ['/', '/inspecoes/nova'],
  })
  const view = render(<RouterProvider router={router} />)
  return { ...view, router, user: userEvent.setup() }
}

async function fillForm(user: ReturnType<typeof userEvent.setup>, titulo = 'Transportador 01') {
  await user.type(screen.getByLabelText('Título'), titulo)
  await user.selectOptions(screen.getByLabelText('Setor'), 'Produção')
  await user.selectOptions(screen.getByLabelText('Responsável'), 'Equipe A')
  await user.type(screen.getByLabelText('Data da inspeção'), '2026-09-08')
}

describe('formulário de criação', () => {
  it('permite o primeiro salvamento com Não e observação vazia', async () => {
    const repository = createLocalInspectionRepository(createInspectionStorage(localStorage))
    const { user } = renderCreation(repository)
    await fillForm(user)
    await user.click(within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.avarias })).getByLabelText('Não'))
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByRole('heading', { name: 'Inspeção encontrada' })).toBeInTheDocument()
    expect((await repository.findById('inspecao-1'))?.checklist.avarias).toEqual({ resposta: 'nao', observacao: '' })
  })

  it('inicia sem respostas, salva um checklist parcial e o preserva após recarga', async () => {
    const storage = createInspectionStorage(localStorage)
    const { user, router, unmount } = renderCreation(createLocalInspectionRepository(storage))
    expect(screen.getAllByRole('radio')).toHaveLength(6)
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked()
    expect(screen.queryByLabelText(/Observação/)).not.toBeInTheDocument()
    await fillForm(user, '  Transportador 01  ')
    await user.click(within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.identificacao })).getByLabelText('Sim'))
    await user.click(within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.avarias })).getByLabelText('Não'))
    await user.type(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`), 'Avaria aparente na carenagem.')
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    expect(await screen.findByRole('heading', { name: 'Inspeção encontrada' })).toBeInTheDocument()
    expect(screen.getByText('INS-000001 — Transportador 01')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/inspecoes/inspecao-1')

    unmount()
    const reloaded = createLocalInspectionRepository(createInspectionStorage(localStorage))
    render(<RouterProvider router={createMemoryRouter([
      { path: '*', element: <App repository={reloaded} /> },
    ], { initialEntries: ['/inspecoes/inspecao-1'] })} />)
    expect(await screen.findByRole('heading', { name: 'Inspeção encontrada' })).toBeInTheDocument()
    const inspection = await reloaded.findById('inspecao-1')
    expect(inspection?.checklist).toEqual({
      identificacao: { resposta: 'sim', observacao: '' },
      avarias: { resposta: 'nao', observacao: 'Avaria aparente na carenagem.' },
      protecoes: { resposta: null, observacao: '' },
    })
  })

  it('associa erros aos campos obrigatórios e foca o primeiro inválido', async () => {
    const repository = createLocalInspectionRepository(createInspectionStorage(localStorage))
    const create = vi.spyOn(repository, 'create')
    const { user, router } = renderCreation(repository)
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    for (const label of ['Título', 'Setor', 'Responsável', 'Data da inspeção']) {
      const control = screen.getByLabelText(label)
      expect(control).toHaveAttribute('aria-invalid', 'true')
      expect(control).toHaveAccessibleDescription()
    }
    expect(screen.getByLabelText('Título')).toHaveFocus()
    expect(create).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/inspecoes/nova')
  })

  it.each(['ab', 'a'.repeat(81)])('mostra erro para título fora dos limites (%s)', async (titulo) => {
    const repository = createLocalInspectionRepository(createInspectionStorage(localStorage))
    const create = vi.spyOn(repository, 'create')
    const { user } = renderCreation(repository)
    await fillForm(user, titulo)
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    expect(screen.getByLabelText('Título')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Título')).toHaveAccessibleDescription(/Informe um título/)
    expect(create).not.toHaveBeenCalled()
  })

  it('impede clique repetido e novo submit enquanto aguarda a criação', async () => {
    let resolveCreation: ((inspection: Inspecao) => void) | undefined
    const pending = new Promise<Inspecao>((resolve) => { resolveCreation = resolve })
    const repository = {
      create: vi.fn<InspectionRepository['create']>(() => pending),
      findById: vi.fn<InspectionRepository['findById']>(async () => createInspectionFixture()),
    }
    const { user, router } = renderCreation(repository)
    await fillForm(user)
    await user.dblClick(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await user.keyboard('{Enter}')

    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
    expect(screen.getByLabelText('Título')).toBeDisabled()
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Salvando inspeção…')
    expect(repository.create).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/inspecoes/nova')

    await act(async () => { resolveCreation?.(createInspectionFixture()) })
    expect(await screen.findByRole('heading', { name: 'Inspeção encontrada' })).toBeInTheDocument()
    expect(repository.create).toHaveBeenCalledTimes(1)
  })

  it('preserva todos os valores e a rota em falha de gravação, permitindo tentar novamente', async () => {
    const storage = createInspectionStorage(localStorage)
    const repository = createLocalInspectionRepository(storage)
    const { user, router } = renderCreation(repository)
    await fillForm(user, '  Transportador 01  ')
    const avarias = within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.avarias }))
    await user.click(avarias.getByLabelText('Não'))
    await user.type(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`), '  Avaria aparente na carenagem.  ')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Sem espaço', 'QuotaExceededError')
    })
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar')
    expect(screen.getByLabelText('Título')).toHaveValue('  Transportador 01  ')
    expect(screen.getByLabelText('Setor')).toHaveValue('Produção')
    expect(screen.getByLabelText('Responsável')).toHaveValue('Equipe A')
    expect(screen.getByLabelText('Data da inspeção')).toHaveValue('2026-09-08')
    expect(avarias.getByLabelText('Não')).toBeChecked()
    expect(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`)).toHaveValue('  Avaria aparente na carenagem.  ')
    expect(within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.protecoes })).getByLabelText('Sim')).not.toBeChecked()
    expect(within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.protecoes })).getByLabelText('Não')).not.toBeChecked()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/inspecoes/nova')
    await expect(storage.read()).resolves.toEqual({ version: 1, inspections: [] })

    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByRole('heading', { name: 'Inspeção encontrada' })).toBeInTheDocument()
    expect((await storage.read()).inspections).toHaveLength(1)
    const inspection = await repository.findById('inspecao-1')
    expect(inspection?.checklist.avarias).toEqual({ resposta: 'nao', observacao: '  Avaria aparente na carenagem.  ' })
  })

  it('mantém a ordem de foco dos campos e permite salvar com Enter', async () => {
    const { user } = renderCreation(createLocalInspectionRepository(createInspectionStorage(localStorage)))
    await user.tab()
    expect(screen.getByLabelText('Título')).toHaveFocus()
    await user.keyboard('Prensa 01')
    await user.tab()
    expect(screen.getByLabelText('Setor')).toHaveFocus()
    // user-event não emula a escolha nativa de select por setas no jsdom.
    await user.selectOptions(screen.getByLabelText('Setor'), 'Produção')
    await user.tab()
    expect(screen.getByLabelText('Responsável')).toHaveFocus()
    await user.selectOptions(screen.getByLabelText('Responsável'), 'Equipe A')
    await user.tab()
    expect(screen.getByLabelText('Data da inspeção')).toHaveFocus()
    await user.type(screen.getByLabelText('Data da inspeção'), '2026-09-08')
    for (const question of Object.values(CHECKLIST_PERGUNTAS)) {
      await user.tab()
      expect(within(screen.getByRole('group', { name: question })).getByLabelText('Sim')).toHaveFocus()
      await user.keyboard(' ')
    }
    await user.tab()
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Inspeção encontrada' })).toBeInTheDocument()
  })

  it('confirma descarte mesmo quando somente o checklist foi alterado', async () => {
    const repository = createLocalInspectionRepository(createInspectionStorage(localStorage))
    const create = vi.spyOn(repository, 'create')
    const { user, router } = renderCreation(repository)
    const identificacao = within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.identificacao }))
    await user.click(identificacao.getByLabelText('Sim'))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(identificacao.getByLabelText('Sim')).toBeChecked()
    expect(router.state.location.pathname).toBe('/inspecoes/nova')

    confirm.mockReturnValue(true)
    await act(async () => { await router.navigate(-1) })
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(create).not.toHaveBeenCalled()
  })

  it('mostra observações próprias para Não e oculta a observação ao trocar para Sim', async () => {
    const { user } = renderCreation(createLocalInspectionRepository(createInspectionStorage(localStorage)))
    const identificacao = within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.identificacao }))
    const avarias = within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.avarias }))
    await user.click(identificacao.getByLabelText('Não'))
    await user.type(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.identificacao}`), 'Etiqueta está ilegível.')
    await user.click(avarias.getByLabelText('Não'))
    expect(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`)).toHaveValue('')
    await user.type(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`), 'Avaria na carenagem.')

    await user.click(identificacao.getByLabelText('Sim'))

    expect(screen.queryByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.identificacao}`)).not.toBeInTheDocument()
    expect(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`)).toHaveValue('Avaria na carenagem.')
    await user.click(identificacao.getByLabelText('Não'))
    expect(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.identificacao}`)).toHaveValue('Etiqueta está ilegível.')
  })
})


async function completeForm(user: ReturnType<typeof userEvent.setup>) {
  await fillForm(user, '  Equipamento novo  ')
  for (const question of Object.values(CHECKLIST_PERGUNTAS)) {
    await user.click(within(screen.getByRole('group', { name: question })).getByLabelText('Sim'))
  }
  await user.click(within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.avarias })).getByLabelText('Não'))
  await user.type(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`), '  Avaria aparente na carenagem.  ')
}

describe('envio direto pela criação', () => {
  it('habilita somente com metadados, respostas e observações válidos e volta a bloquear ao invalidar', async () => {
    const repository = createLocalInspectionRepository(createInspectionStorage(localStorage))
    const send = vi.spyOn(repository, 'createAndSubmit')
    const { user } = renderCreation(repository)
    const button = screen.getByRole('button', { name: 'Enviar para aprovação' })
    expect(button).toBeDisabled()
    await fillForm(user)
    expect(button).toBeDisabled()
    for (const question of Object.values(CHECKLIST_PERGUNTAS)) {
      await user.click(within(screen.getByRole('group', { name: question })).getByLabelText('Sim'))
    }
    expect(button).toBeEnabled()
    const avarias = within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.avarias }))
    await user.click(avarias.getByLabelText('Não'))
    const observation = screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`)
    for (const text of ['', '   ', '123456789', 'a'.repeat(301)]) {
      fireEvent.change(observation, { target: { value: text } })
      expect(button).toBeDisabled()
    }
    for (const text of [' 1234567890 ', 'a'.repeat(300)]) {
      fireEvent.change(observation, { target: { value: text } })
      expect(button).toBeEnabled()
    }
    fireEvent.change(observation, { target: { value: '' } })
    expect(button).toBeDisabled()
    await user.click(avarias.getByLabelText('Sim'))
    expect(button).toBeEnabled()
    await user.clear(screen.getByLabelText('Título'))
    expect(button).toBeDisabled()
    await user.click(button)
    expect(send).not.toHaveBeenCalled()
  })

  it('preserva campos e rota na falha real e repete sem cadastro ou eventos parciais', async () => {
    const storage = createInspectionStorage(localStorage)
    const repository = createLocalInspectionRepository(storage)
    const { user, router } = renderCreation(repository)
    await completeForm(user)
    const draft = vi.spyOn(repository, 'create')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Sem espaço') })
    await user.click(screen.getByRole('button', { name: 'Enviar para aprovação' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Seus dados foram mantidos')
    expect(screen.getByLabelText('Título')).toHaveValue('  Equipamento novo  ')
    expect(screen.getByLabelText('Setor')).toHaveValue('Produção')
    expect(screen.getByLabelText('Responsável')).toHaveValue('Equipe A')
    expect(screen.getByLabelText('Data da inspeção')).toHaveValue('2026-09-08')
    expect(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`)).toHaveValue('  Avaria aparente na carenagem.  ')
    expect(router.state.location.pathname).toBe('/inspecoes/nova')
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBeNull()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Enviar para aprovação' }))
    expect(await screen.findByText('Status: Em aprovação')).toBeInTheDocument()
    const records = (await storage.read()).inspections
    expect(records).toHaveLength(1)
    expect(records[0]?.historico.map((event) => event.tipo)).toEqual(['criacao', 'envio'])
    expect(draft).not.toHaveBeenCalled()
  })

  it('usa o atraso existente e bloqueia repetição, edição e saída durante o envio', async () => {
    const simulation = createOperationSimulation()
    const repository = createLocalInspectionRepository(createInspectionStorage(localStorage), simulation)
    const send = vi.spyOn(repository, 'createAndSubmit')
    const { user, router } = renderCreation(repository)
    await completeForm(user)
    simulation.setDelay(1000)
    vi.useFakeTimers()
    try {
      const button = screen.getByRole('button', { name: 'Enviar para aprovação' })
      const form = button.closest('form')
      if (!form) throw new Error('Formulário ausente')
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.submit(form)
      expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
      expect(screen.getByLabelText('Título')).toBeDisabled()
      for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
      expect(screen.getByRole('status')).toHaveTextContent('Enviando para aprovação…')
      expect(send).toHaveBeenCalledTimes(1)
      await act(async () => { await router.navigate('/') })
      expect(router.state.location.pathname).toBe('/inspecoes/nova')
      simulation.setDelay(0)
      await act(async () => { await vi.advanceTimersByTimeAsync(999) })
      expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBeNull()
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(screen.getByText('Status: Em aprovação')).toBeInTheDocument()
      expect(send).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
