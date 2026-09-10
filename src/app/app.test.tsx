import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from './app'
import { createLocalInspectionRepository } from './inspection-repository'
import { createInspectionStorage } from '@/shared/storage/inspection-storage'
import { createInspectionFixture } from '@/test/fixtures/inspection'

function renderApp(path = '/') {
  const repository = createLocalInspectionRepository(createInspectionStorage(localStorage))
  const router = createMemoryRouter([{ path: '*', element: <App repository={repository} /> }], {
    initialEntries: [path],
  })
  render(<RouterProvider router={router} />)
  return { repository, router }
}

describe('estrutura inicial da aplicação', () => {
  it('renderiza a página inicial', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Inspeções' })).toBeInTheDocument()
  })

  it('permite voltar para inspeções preservando filtros a partir de uma rota desconhecida', async () => {
    const user = userEvent.setup()
    const search = '?busca=Prensa&setor=Produ%C3%A7%C3%A3o&status=aprovada&ordem=antigos'
    const { router } = renderApp(`/desconhecida${search}`)

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Voltar para inspeções' }))
    expect(screen.getByRole('heading', { name: 'Inspeções' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(router.state.location.search).toBe(search)
  })

  it('abre o formulário pelo link Nova inspeção', async () => {
    const user = userEvent.setup()
    const { router } = renderApp()
    await user.click(screen.getByRole('link', { name: 'Nova inspeção' }))
    expect(screen.getByRole('heading', { name: 'Nova inspeção' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/inspecoes/nova')
  })

  it('informa que o id consultado não existe', async () => {
    renderApp('/inspecoes/inexistente')
    expect(await screen.findByRole('heading', { name: 'Inspeção não encontrada' })).toBeInTheDocument()
  })

  it('abre a edição a partir da inspeção encontrada', async () => {
    const original = createInspectionFixture()
    await createInspectionStorage(localStorage).write([original])
    const user = userEvent.setup()
    const { router } = renderApp(`/inspecoes/${original.id}`)
    await user.click(await screen.findByRole('link', { name: 'Editar inspeção' }))
    expect(await screen.findByRole('heading', { name: 'Editar inspeção' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/inspecoes/${original.id}/editar`)
  })

  it('mostra erro de consulta e permite tentar novamente', async () => {
    localStorage.setItem('ekaizen:inspections', '{')
    const user = userEvent.setup()
    const { repository } = renderApp('/inspecoes/inspecao-1')
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível consultar')
    vi.spyOn(repository, 'findById').mockResolvedValue(createInspectionFixture())
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { name: 'Inspeção encontrada' })).toBeInTheDocument()
  })
})

it.each(['em_preenchimento', 'em_aprovacao', 'aprovada', 'reprovada'] as const)('consulta metadados, checklist e histórico em %s', async (status) => {
  const original = createInspectionFixture()
  original.status = status
  original.historico.push({ id: 'reprovacao-anterior', tipo: 'reprovacao', dataHora: original.atualizadoEm, motivo: 'Pendência de integridade anterior.' })
  await createInspectionStorage(localStorage).write([original])
  renderApp(`/inspecoes/${original.id}`)
  await screen.findByRole('heading', { name: 'Inspeção encontrada' })
  expect(screen.getByText(`${original.protocolo} — ${original.titulo}`)).toBeInTheDocument()
  expect(screen.getByText(original.setor)).toBeInTheDocument()
  expect(screen.getByText(original.responsavel)).toBeInTheDocument()
  expect(screen.getByText('09/09/2026')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Checklist' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Histórico' })).toBeInTheDocument()
  expect(screen.getByText('Motivo: Pendência de integridade anterior.')).toBeInTheDocument()
})
