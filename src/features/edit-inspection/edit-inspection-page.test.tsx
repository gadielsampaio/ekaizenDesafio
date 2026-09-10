import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '@/app/app'
import { createLocalInspectionRepository } from '@/app/inspection-repository'
import { CHECKLIST_PERGUNTAS } from '@/shared/domain/checklist'
import { createInspectionStorage } from '@/shared/storage/inspection-storage'
import { createInspectionFixture } from '@/test/fixtures/inspection'

async function setup(status = createInspectionFixture().status) {
  const original = { ...createInspectionFixture(), status }
  const storage = createInspectionStorage(localStorage)
  await storage.write([original])
  const repository = createLocalInspectionRepository(storage)
  const router = createMemoryRouter([{ path: '*', element: <App repository={repository} /> }], {
    initialEntries: [`/inspecoes/${original.id}`, `/inspecoes/${original.id}/editar`],
  })
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { name: status === 'em_preenchimento' ? 'Editar inspeção' : 'Edição indisponível' })
  return { original, repository, router, user: userEvent.setup() }
}

async function answerAll(user: ReturnType<typeof userEvent.setup>) {
  for (const question of Object.values(CHECKLIST_PERGUNTAS)) {
    await user.click(within(screen.getByRole('group', { name: question })).getByLabelText('Sim'))
  }
}

describe('edição e envio pela interface', () => {
  it('associa o erro e foca os metadados inválidos ao tentar salvar rascunho', async () => {
    const { original, repository, user } = await setup()
    const save = vi.spyOn(repository, 'saveDraft')
    await user.clear(screen.getByLabelText('Título'))
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(screen.getByLabelText('Título')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Título')).toHaveAccessibleDescription(/Informe um título/)
    expect(screen.getByLabelText('Título')).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Enviar para aprovação' })).toBeDisabled()
    expect(save).not.toHaveBeenCalled()
    await expect(repository.findById(original.id)).resolves.toEqual(original)
  })

  it('carrega os campos, aceita rascunho incompleto e salva sem criar evento de edição', async () => {
    const { original, repository, user } = await setup()
    expect(screen.getByLabelText('Título')).toHaveValue(original.titulo)
    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Prensa alterada')
    await user.selectOptions(screen.getByLabelText('Setor'), 'Almoxarifado')
    await user.selectOptions(screen.getByLabelText('Responsável'), 'Equipe C')
    await user.clear(screen.getByLabelText('Data da inspeção'))
    await user.type(screen.getByLabelText('Data da inspeção'), '2000-02-29')
    await user.click(within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.avarias })).getByLabelText('Não'))
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Alterações salvas.')
    const updated = await repository.findById(original.id)
    expect(updated).toMatchObject({ titulo: 'Prensa alterada', setor: 'Almoxarifado', responsavel: 'Equipe C', dataInspecao: '2000-02-29', status: 'em_preenchimento' })
    expect(updated?.checklist.avarias).toEqual({ resposta: 'nao', observacao: '' })
    expect(updated?.historico).toEqual(original.historico)
  })

  it('mantém o envio indisponível até todas as respostas e observações serem válidas', async () => {
    const { repository, user } = await setup()
    const submit = vi.spyOn(repository, 'submit')
    await user.click(within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.avarias })).getByLabelText('Não'))
    await user.type(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`), 'curta')
    const button = screen.getByRole('button', { name: 'Enviar para aprovação' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`)).toHaveAccessibleDescription(/10 a 300/)
    expect(submit).not.toHaveBeenCalled()
    await answerAll(user)
    expect(button).toBeEnabled()
    await user.clear(screen.getByLabelText('Título'))
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText('Título'), 'Prensa válida')
    await user.click(within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.avarias })).getByLabelText('Não'))
    expect(button).toBeDisabled()
    await user.clear(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`))
    await user.type(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`), 'Avaria aparente na carenagem.')
    expect(button).toBeEnabled()
  })

  it('envia alterações não salvas em uma operação e exibe o status persistido no destino', async () => {
    const { original, repository, router, user } = await setup()
    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Prensa para revisão')
    await answerAll(user)
    const avarias = within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.avarias }))
    await user.click(avarias.getByLabelText('Não'))
    await user.type(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`), 'inválida')
    await user.click(avarias.getByLabelText('Sim'))
    expect(screen.queryByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`)).not.toBeInTheDocument()
    const save = vi.spyOn(repository, 'saveDraft')
    await user.click(screen.getByRole('button', { name: 'Enviar para aprovação' }))
    expect(await screen.findByText('Status: Em aprovação')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/inspecoes/${original.id}`)
    expect(screen.queryByRole('link', { name: 'Editar inspeção' })).not.toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
    const reloaded = createLocalInspectionRepository(createInspectionStorage(localStorage))
    expect(await reloaded.findById(original.id)).toMatchObject({ titulo: 'Prensa para revisão', status: 'em_aprovacao' })
  })

  it.each(['Salvar alterações', 'Enviar para aprovação'])('falha em %s preserva campos, checklist, rota e estado confirmado', async (button) => {
    const { original, repository, router, user } = await setup()
    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), '  Título editado  ')
    await answerAll(user)
    await user.click(within(screen.getByRole('group', { name: CHECKLIST_PERGUNTAS.avarias })).getByLabelText('Não'))
    await user.type(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`), '  Avaria aparente na carenagem.  ')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Sem espaço') })
    await user.click(screen.getByRole('button', { name: button }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Suas alterações foram mantidas')
    expect(screen.getByLabelText('Título')).toHaveValue('  Título editado  ')
    expect(screen.getByLabelText(`Observação — ${CHECKLIST_PERGUNTAS.avarias}`)).toHaveValue('  Avaria aparente na carenagem.  ')
    expect(router.state.location.pathname).toBe(`/inspecoes/${original.id}/editar`)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await expect(repository.findById(original.id)).resolves.toEqual(original)
    await user.click(screen.getByRole('button', { name: button }))
    if (button === 'Salvar alterações') expect(await screen.findByRole('status')).toHaveTextContent('Alterações salvas.')
    else expect(await screen.findByText('Status: Em aprovação')).toBeInTheDocument()
  })

  it('bloqueia cliques repetidos e edição durante o envio', async () => {
    const { original, repository, user } = await setup()
    await answerAll(user)
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    const originalSubmit = repository.submit
    const submit = vi.spyOn(repository, 'submit').mockImplementation(async (id, input) => {
      await gate
      return originalSubmit(id, input)
    })
    await user.dblClick(screen.getByRole('button', { name: 'Enviar para aprovação' }))
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled()
    expect(screen.getByLabelText('Título')).toBeDisabled()
    expect(submit).toHaveBeenCalledTimes(1)
    await expect(repository.findById(original.id)).resolves.toEqual(original)
    await act(async () => { release?.() })
    expect(await screen.findByText('Status: Em aprovação')).toBeInTheDocument()
    expect((await repository.findById(original.id))?.historico.filter((event) => event.tipo === 'envio')).toHaveLength(1)
  })

  it.each(['em_aprovacao', 'aprovada', 'reprovada'] as const)('não oferece edição nem envio no estado %s', async (status) => {
    await setup(status)
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar para aprovação' })).not.toBeInTheDocument()
  })

  it('confirma descarte e mantém alterações quando o usuário recusa', async () => {
    const { original, repository, router, user } = await setup()
    await user.type(screen.getByLabelText('Título'), ' alterada')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Título')).toHaveValue(`${original.titulo} alterada`)
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(router.state.location.pathname).toBe(`/inspecoes/${original.id}`)
    await expect(repository.findById(original.id)).resolves.toEqual(original)
  })
})
