import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '@/app/app'
import { createLocalInspectionRepository } from '@/app/inspection-repository'
import { createInspectionStorage } from '@/shared/storage/inspection-storage'
import { createOperationSimulation } from '@/shared/storage/operation-simulation'
import { INSPECTION_STORAGE_KEY } from '@/shared/storage/inspection-storage-schema'

function setup(path = '/') {
  const simulation = createOperationSimulation()
  const repository = createLocalInspectionRepository(createInspectionStorage(localStorage), simulation)
  const router = createMemoryRouter([{ path: '*', element: <App repository={repository} dataControls={{ simulation, reset: repository.reset }} /> }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return { simulation, repository, user: userEvent.setup() }
}

describe('controles de simulação e recuperação', () => {
  it('detecta corrupção, cancelar preserva dados, confirmar restaura exemplos e outras chaves', async () => {
    localStorage.setItem(INSPECTION_STORAGE_KEY, '{')
    localStorage.setItem('outro-app', 'preservado')
    const { user } = setup()
    expect(await screen.findByText(/O armazenamento da aplicação está inválido/)).toBeInTheDocument()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await user.click(screen.getByRole('button', { name: 'Restaurar dados da aplicação' }))
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe('{')
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Restaurar dados da aplicação' }))
    expect(await screen.findByRole('button', { name: 'Todas (6)' })).toBeInTheDocument()
    expect(screen.queryByText(/O armazenamento da aplicação está inválido/)).not.toBeInTheDocument()
    expect(localStorage.getItem('outro-app')).toBe('preservado')
  })

  it('falha de recuperação exibe erro e permite nova tentativa', async () => {
    localStorage.setItem(INSPECTION_STORAGE_KEY, '{')
    const { user } = setup()
    await screen.findByText(/O armazenamento da aplicação está inválido/)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByText('Simulação de operações'))
    await user.click(screen.getByRole('button', { name: 'Falhar próxima operação' }))
    await user.click(screen.getByRole('button', { name: 'Restaurar dados da aplicação' }))
    expect(await screen.findByText(/Não foi possível restaurar os dados/)).toBeInTheDocument()
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBe('{')
    await user.click(screen.getByRole('button', { name: 'Restaurar dados da aplicação' }))
    expect(await screen.findByRole('button', { name: 'Todas (6)' })).toBeInTheDocument()
  })

  it('falha simulada preserva motivo e estado confirmado da revisão', async () => {
    const { user, repository } = setup()
    await user.click(await screen.findByRole('link', { name: 'Furadeira 02' }))
    await screen.findByRole('button', { name: 'Reprovar' })
    const before = await repository.findById('exemplo-2')
    await user.click(screen.getByText('Simulação de operações'))
    await user.click(screen.getByRole('button', { name: 'Falhar próxima operação' }))
    await user.click(await screen.findByRole('button', { name: 'Reprovar' }))
    await user.type(screen.getByLabelText('Motivo da reprovação'), '  Pendência de integridade.  ')
    await user.click(screen.getByRole('button', { name: 'Confirmar reprovação' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Motivo da reprovação')).toHaveValue('  Pendência de integridade.  ')
    expect(screen.getByText('Status: Em aprovação')).toBeInTheDocument()
    await expect(repository.findById('exemplo-2')).resolves.toEqual(before)
    await user.click(screen.getByRole('button', { name: 'Confirmar reprovação' }))
    expect(await screen.findByText('Status: Reprovada')).toBeInTheDocument()
  })

  it('falha simulada preserva campos de criação e não navega', async () => {
    const { user } = setup('/inspecoes/nova')
    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Equipamento novo')
    await user.selectOptions(screen.getByLabelText('Setor'), 'Produção')
    await user.selectOptions(screen.getByLabelText('Responsável'), 'Equipe A')
    fireEvent.change(screen.getByLabelText('Data da inspeção'), { target: { value: '2026-09-08' } })
    const answer = screen.getAllByRole('radio', { name: 'Não' })[0]
    if (!answer) throw new Error('Resposta ausente')
    await user.click(answer)
    await user.type(screen.getByRole('textbox', { name: /Observação/ }), 'Rascunho')
    await user.click(screen.getByText('Simulação de operações'))
    await user.click(screen.getByRole('button', { name: 'Falhar próxima operação' }))
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('heading', { name: 'Nova inspeção' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Equipamento novo')
    expect(screen.getByLabelText('Setor')).toHaveValue('Produção')
    expect(screen.getByLabelText('Responsável')).toHaveValue('Equipe A')
    expect(screen.getByLabelText('Data da inspeção')).toHaveValue('2026-09-08')
    expect(screen.getByRole('textbox', { name: /Observação/ })).toHaveValue('Rascunho')
    expect(localStorage.getItem(INSPECTION_STORAGE_KEY)).toBeNull()
  })

  it('bloqueia formulário durante reset e preserva valores se a restauração falhar', async () => {
    const { user, simulation, repository } = setup('/inspecoes/nova')
    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Rascunho preservado')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const create = vi.spyOn(repository, 'create')
    act(() => { simulation.setDelay(1000); simulation.failNext() })
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Restaurar dados da aplicação' }))
      expect(screen.getByRole('textbox', { name: 'Título' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled()
      expect(screen.getByRole('group', { name: 'Inspeções' })).toHaveAttribute('inert')
      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
      expect(create).not.toHaveBeenCalled()
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(screen.getByText(/Não foi possível restaurar os dados/)).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Título' })).toBeEnabled()
      expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Rascunho preservado')
      expect(screen.getByRole('group', { name: 'Inspeções' })).not.toHaveAttribute('inert')
    } finally {
      vi.useRealTimers()
    }
  })

  it('configura atraso e bloqueia reset repetido enquanto pendente', async () => {
    const { user, simulation } = setup()
    await screen.findByRole('button', { name: 'Todas (6)' })
    await user.click(screen.getByText('Simulação de operações'))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Atraso por operação' }), '1000')
    expect(simulation.getSnapshot().delay).toBe(1000)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.useFakeTimers()
    try {
      const button = screen.getByRole('button', { name: 'Restaurar dados da aplicação' })
      fireEvent.click(button)
      fireEvent.click(button)
      expect(window.confirm).toHaveBeenCalledTimes(1)
      const resetting = screen.getByRole('button', { name: 'Restaurando...' })
      expect(resetting).toBeDisabled()
      expect(resetting.querySelector('[data-slot="spinner"]')).toBeInTheDocument()
      expect(screen.getByRole('complementary', { name: 'Controles de dados' })).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByRole('link', { name: 'Empilhadeira 06' })).toBeInTheDocument()
      expect(document.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(screen.getByRole('button', { name: 'Todas (6)' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
