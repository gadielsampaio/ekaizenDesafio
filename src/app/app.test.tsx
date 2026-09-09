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
    expect(screen.getByRole('heading', { name: 'Sistema de inspeções' })).toBeInTheDocument()
  })

  it('permite voltar ao início a partir de uma rota desconhecida', async () => {
    const user = userEvent.setup()
    renderApp('/desconhecida')

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Voltar ao início' }))
    expect(screen.getByRole('heading', { name: 'Sistema de inspeções' })).toBeInTheDocument()
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
