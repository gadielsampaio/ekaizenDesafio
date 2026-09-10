import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '@/app/app'
import { createLocalInspectionRepository } from '@/app/inspection-repository'
import { createInspectionStorage } from '@/shared/storage/inspection-storage'

function setup(path = '/') {
  const repository = createLocalInspectionRepository(createInspectionStorage(localStorage))
  const router = createMemoryRouter([{ path: '*', element: <App repository={repository} /> }], { initialEntries: [path] })
  const { unmount } = render(<RouterProvider router={router} />)
  return { repository, router, user: userEvent.setup(), unmount }
}

describe('listagem na interface', () => {
  it('alterna a ordem pelo teclado sem mudar filtros, contadores ou persistência', async () => {
    const { user, router, repository } = setup('/?busca=INS-&setor=Manuten%C3%A7%C3%A3o')
    await screen.findByRole('link', { name: 'Furadeira 02' })
    const titles = () => screen.getAllByRole('listitem').map((item) => within(item).getByRole('heading').textContent)
    const counts = screen.getByRole('group', { name: 'Filtrar por status' }).textContent
    const list = vi.spyOn(repository, 'list')
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const button = screen.getByRole('button', { name: /Ordenação atual: mais recentes primeiro/ })
    expect(titles()).toEqual(['Esmeril 05', 'Furadeira 02'])

    button.focus()
    await user.keyboard('{Enter}')
    expect(titles()).toEqual(['Furadeira 02', 'Esmeril 05'])
    expect(button).toHaveTextContent('Mais antigos primeiro')
    expect(button).toHaveFocus()
    expect(new URLSearchParams(router.state.location.search).get('ordem')).toBe('antigos')
    expect(screen.getByRole('searchbox')).toHaveValue('INS-')
    expect(screen.getByRole('combobox', { name: 'Setor' })).toHaveValue('Manutenção')
    expect(screen.getByRole('group', { name: 'Filtrar por status' })).toHaveTextContent(counts ?? '')

    await user.keyboard(' ')
    expect(titles()).toEqual(['Esmeril 05', 'Furadeira 02'])
    expect(button).toHaveTextContent('Mais recentes primeiro')
    expect(new URLSearchParams(router.state.location.search).has('ordem')).toBe(false)
    expect(list).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })

  it('restaura a ordenação da URL, inclusive após consultar a linha e recarregar', async () => {
    const path = '/?busca=INS-&setor=Manuten%C3%A7%C3%A3o&ordem=antigos'
    const { user, router, unmount } = setup(path)
    const link = await screen.findByRole('link', { name: 'Furadeira 02' })
    expect(screen.getAllByRole('listitem').map((item) => within(item).getByRole('heading').textContent)).toEqual(['Furadeira 02', 'Esmeril 05'])
    await user.click(within(link).getByText('Equipe B'))
    expect(router.state.location.pathname).toBe('/inspecoes/exemplo-2')
    expect(router.state.location.search).toBe(path.slice(1))
    await user.click(await screen.findByRole('link', { name: 'Voltar ao início' }))
    expect(await screen.findByRole('button', { name: /Ordenação atual: mais antigos primeiro/ })).toBeInTheDocument()
    const restoredPath = router.state.location.pathname + router.state.location.search
    unmount()

    setup(restoredPath)
    await screen.findByRole('link', { name: 'Furadeira 02' })
    expect(screen.getByRole('button', { name: /Ordenação atual: mais antigos primeiro/ })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((item) => within(item).getByRole('heading').textContent)).toEqual(['Furadeira 02', 'Esmeril 05'])
  })

  it('usa recentes para uma ordem desconhecida na URL', async () => {
    setup('/?ordem=invalida')
    await screen.findByRole('link', { name: 'Empilhadeira 06' })
    expect(screen.getByRole('button', { name: /Ordenação atual: mais recentes primeiro/ })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((item) => within(item).getByRole('heading').textContent)[0]).toBe('Empilhadeira 06')
  })

  it('exibe cards completos, combina filtros e limpa o estado vazio', async () => {
    const { user, router } = setup('/?ordem=antigos')
    const link = await screen.findByRole('link', { name: 'Transportador 01' })
    const card = link.closest('li')
    if (!card) throw new Error('Card ausente')
    expect(within(link).getByText('INS-000001')).toBeInTheDocument()
    expect(within(link).getByText('Produção')).toBeInTheDocument()
    expect(within(link).getByText('Equipe A')).toBeInTheDocument()
    expect(within(link).getByText('08/09/2026')).toBeInTheDocument()
    expect(within(link).getByText('Em preenchimento')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Setor' }), 'Produção')
    await user.click(screen.getByRole('button', { name: 'Aprovadas (1)' }))
    expect(screen.getByRole('button', { name: 'Todas (2)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Em preenchimento (1)' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprovadas (1)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('link', { name: 'Transportador 01' })).not.toBeInTheDocument()
    await user.type(screen.getByRole('searchbox'), 'inexistente')
    expect(screen.getByText('Nenhuma inspeção encontrada.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(screen.getByRole('button', { name: 'Todas (6)' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Setor' })).toHaveValue('')
    expect(router.state.location.search).toBe('')
    expect(screen.getByRole('button', { name: /Ordenação atual: mais recentes primeiro/ })).toBeInTheDocument()
  })

  it('preserva filtros no detalhe e atualiza cards e contadores após aprovação', async () => {
    const { user, router } = setup('/?busca=fur&setor=Manuten%C3%A7%C3%A3o&status=em_aprovacao')
    await user.click(await screen.findByRole('link', { name: 'Furadeira 02' }))
    await user.click(await screen.findByRole('button', { name: 'Aprovar' }))
    await screen.findByText('Status: Aprovada')
    await user.click(screen.getByRole('link', { name: 'Voltar ao início' }))
    expect(await screen.findByText('Nenhuma inspeção encontrada.')).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('fur')
    expect(screen.getByRole('combobox', { name: 'Setor' })).toHaveValue('Manutenção')
    expect(screen.getByRole('button', { name: 'Em aprovação (0)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Em aprovação (0)' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aprovadas (1)' }))
    expect(screen.getByRole('link', { name: 'Furadeira 02' })).toBeInTheDocument()
    expect(router.state.location.search).toContain('busca=fur')
  })

  it('preserva filtros ao editar e enviar uma inspeção', async () => {
    const { user } = setup('/?setor=Produ%C3%A7%C3%A3o&status=em_preenchimento')
    await user.click(await screen.findByRole('link', { name: 'Transportador 01' }))
    await user.click(await screen.findByRole('link', { name: 'Editar inspeção' }))
    await screen.findByRole('heading', { name: 'Editar inspeção' })
    for (const radio of screen.getAllByRole('radio', { name: 'Sim' })) await user.click(radio)
    await user.click(screen.getByRole('button', { name: 'Enviar para aprovação' }))
    await screen.findByText('Status: Em aprovação')
    await user.click(screen.getByRole('link', { name: 'Voltar ao início' }))
    expect(await screen.findByText('Nenhuma inspeção encontrada.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Em aprovação (1)' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Setor' })).toHaveValue('Produção')
  })

  it('mostra carregamento e permite tentar novamente após falha', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Sem espaço') })
    const { user } = setup()
    expect(screen.getByText('Carregando inspeções…')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível listar')
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('button', { name: 'Todas (6)' })).toBeInTheDocument()
  })
})

it.each([
  { title: 'Furadeira 02', search: 'fur', from: 'em_aprovacao', action: 'Reprovar', to: 'Reprovadas', old: 'Em aprovação' },
  { title: 'Paleteira 04', search: 'pal', from: 'reprovada', action: 'Reabrir para correção', to: 'Em preenchimento', old: 'Reprovadas' },
])('atualiza cards e contadores após $action', async ({ title, search, from, action, to, old }) => {
  const { user } = setup(`/?busca=${search}&status=${from}`)
  await user.click(await screen.findByRole('link', { name: title }))
  await user.click(await screen.findByRole('button', { name: action }))
  if (action === 'Reprovar') {
    await user.type(screen.getByLabelText('Motivo da reprovação'), 'Pendência de integridade não resolvida.')
    await user.click(screen.getByRole('button', { name: 'Confirmar reprovação' }))
    await screen.findByText('Status: Reprovada')
  } else {
    await screen.findByText('Status: Em preenchimento')
    expect(screen.getByText('Motivo: Pendência de integridade do equipamento não resolvida.')).toBeInTheDocument()
    expect(screen.getByText(/Reabertura ·/)).toBeInTheDocument()
    expect(screen.getByText('Observação: Avaria aparente na carenagem.')).toBeInTheDocument()
  }
  await user.click(screen.getByRole('link', { name: 'Voltar ao início' }))
  expect(await screen.findByText('Nenhuma inspeção encontrada.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: `${old} (0)` })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Todas (1)' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: `${to} (1)` }))
  await user.click(screen.getByRole('link', { name: title }))
  expect(await screen.findByText(/Motivo: Pendência de integridade/)).toBeInTheDocument()
})
