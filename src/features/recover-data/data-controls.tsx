import { useRef, useState, useSyncExternalStore } from 'react'
import { Button } from '@/shared/ui/button'
import type { createOperationSimulation } from '@/shared/storage/operation-simulation'

export function DataControls({ simulation, reset, onRecovered }: {
  simulation: ReturnType<typeof createOperationSimulation>
  reset: () => Promise<void>
  onRecovered: () => void
}) {
  const state = useSyncExternalStore(simulation.subscribe, simulation.getSnapshot)
  const [failed, setFailed] = useState(false)
  const [resetting, setResetting] = useState(false)
  const processing = useRef(false)
  async function recover() {
    if (processing.current || state.pending > 0) return
    if (!window.confirm('Restaurar os seis exemplos? Todos os dados e alterações desta aplicação, inclusive campos não salvos, serão descartados. Dados de outros sites não serão alterados.')) return
    processing.current = true
    setResetting(true)
    setFailed(false)
    try {
      await reset()
      onRecovered()
    } catch {
      setFailed(true)
    } finally {
      processing.current = false
      setResetting(false)
    }
  }
  return <aside className="space-y-3 rounded-md border p-4" aria-label="Controles de dados">
    <details>
      <summary className="cursor-pointer focus-visible:outline-2">Simulação de operações</summary>
      <label className="my-3 block">Atraso por operação
        <select className="ml-2 rounded border p-2 focus-visible:outline-2" value={state.delay} onChange={(event) => simulation.setDelay(Number(event.target.value))}>
          <option value={0}>Sem atraso</option><option value={1000}>1 segundo</option><option value={3000}>3 segundos</option><option value={5000}>5 segundos</option>
        </select>
      </label>
      <Button variant="outline" disabled={state.failNext} onClick={() => simulation.failNext()}>Falhar próxima operação</Button>
      <p role="status">{state.failNext ? 'A próxima operação falhará uma vez.' : 'Nenhuma falha programada.'}</p>
      <p>Operações pendentes: {state.pending}</p>
    </details>
    {state.invalidStorage && <p role="alert">O armazenamento da aplicação está inválido ou usa uma versão incompatível. Seus dados não foram apagados. Você pode restaurar os seis exemplos abaixo.</p>}
    {failed && <p role="alert">Não foi possível restaurar os dados. O armazenamento anterior foi mantido. Tente novamente.</p>}
    {resetting && <p role="status">Restaurando dados…</p>}
    <Button variant="outline" disabled={state.pending > 0 || resetting} onClick={() => { void recover() }}>{resetting ? 'Restaurando…' : 'Restaurar dados da aplicação'}</Button>
  </aside>
}
