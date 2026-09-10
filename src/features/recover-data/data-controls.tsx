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
  return <aside className="surface space-y-4 text-sm" aria-label="Controles de dados">
    <details>
      <summary className="min-h-11 cursor-pointer content-center rounded-md font-semibold focus-visible:outline-2 focus-visible:outline-ring">Simulação de operações</summary>
      <div className="mt-4 grid items-end gap-4 sm:grid-cols-[minmax(0,15rem)_auto]">
      <label className="block space-y-2 text-sm font-medium">Atraso por operação
        <select className="field-control block" value={state.delay} onChange={(event) => simulation.setDelay(Number(event.target.value))}>
          <option value={0}>Sem atraso</option><option value={1000}>1 segundo</option><option value={3000}>3 segundos</option><option value={5000}>5 segundos</option>
        </select>
      </label>
      <Button className="sm:justify-self-start" variant="outline" disabled={state.failNext} onClick={() => simulation.failNext()}>Falhar próxima operação</Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground" role="status">{state.failNext ? 'A próxima operação falhará uma vez.' : 'Nenhuma falha programada.'}</p>
      <p className="mt-1 text-xs text-muted-foreground">Operações pendentes: {state.pending}</p>
    </details>
    {state.invalidStorage && <p className="notice border-red-200 bg-red-50 text-red-900" role="alert">O armazenamento da aplicação está inválido ou usa uma versão incompatível. Seus dados não foram apagados. Você pode restaurar os seis exemplos abaixo.</p>}
    {failed && <p className="notice border-red-200 bg-red-50 text-red-900" role="alert">Não foi possível restaurar os dados. O armazenamento anterior foi mantido. Tente novamente.</p>}
    {resetting && <p role="status">Restaurando dados…</p>}
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">Restaure os exemplos iniciais mediante confirmação.</p>
      <Button className="whitespace-normal" variant="outline" disabled={state.pending > 0 || resetting} onClick={() => { void recover() }}>{resetting ? 'Restaurando…' : 'Restaurar dados da aplicação'}</Button>
    </div>
  </aside>
}
