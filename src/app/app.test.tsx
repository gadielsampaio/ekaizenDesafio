import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from './app'

describe('estrutura inicial da aplicação', () => {
  it('renderiza a página inicial', () => {
    render(<MemoryRouter><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Sistema de inspeções' })).toBeInTheDocument()
  })

  it('permite voltar ao início a partir de uma rota desconhecida', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/desconhecida']}><App /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Voltar ao início' }))
    expect(screen.getByRole('heading', { name: 'Sistema de inspeções' })).toBeInTheDocument()
  })
})
