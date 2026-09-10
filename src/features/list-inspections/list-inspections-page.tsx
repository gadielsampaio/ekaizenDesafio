import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import type { Inspecao } from '@/shared/domain/inspection'
import { setorSchema, statusInspecaoSchema } from '@/shared/domain/inspection-schemas'
import { Button } from '@/shared/ui/button'
import { filterInspections, STATUS_FILTERS, type InspectionOrder } from './list-inspections'

type State = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; inspections: Inspecao[] }
const control = 'h-11 w-full rounded-md border bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring'

export function ListInspectionsPage({ repository }: { repository: Pick<InspectionRepository, 'list'> }) {
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const filters = {
    busca: params.get('busca') ?? '',
    setor: setorSchema.safeParse(params.get('setor')).data ?? '',
    status: statusInspecaoSchema.safeParse(params.get('status')).data ?? '',
  }
  const order: InspectionOrder = params.get('ordem') === 'antigos' ? 'antigos' : 'recentes'
  useEffect(() => {
    let active = true
    repository.list().then(
      (inspections) => { if (active) setState({ status: 'loaded', inspections }) },
      () => { if (active) setState({ status: 'error' }) },
    )
    return () => { active = false }
  }, [repository, attempt])
  function update(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }
  const { cards, counts } = filterInspections(state.status === 'loaded' ? state.inspections : [], filters, order)
  const search = params.size ? `?${params.toString()}` : ''
  return <>
    <h1 className="text-3xl font-semibold tracking-tight">Sistema de inspeções</h1>
    <Button asChild className="self-start"><Link to="/inspecoes/nova">Nova inspeção</Link></Button>
    {state.status === 'loaded' && <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">{counts.map(({ value, label, count }) => <Button key={value} variant={filters.status === value ? 'default' : 'outline'} aria-pressed={filters.status === value} onClick={() => update('status', value)}>{label} ({count})</Button>)}</div>}
    <div className="space-y-4">
      <label className="block space-y-1">Buscar por protocolo ou título<input className={control} type="search" value={filters.busca} onChange={(event) => update('busca', event.target.value)} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">Setor<select className={control} value={filters.setor} onChange={(event) => update('setor', event.target.value)}><option value="">Todos os setores</option>{setorSchema.options.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="block space-y-1">Status<select className={control} value={filters.status} onChange={(event) => update('status', event.target.value)}>{STATUS_FILTERS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <Button variant="outline" onClick={() => setParams({})}>Limpar filtros</Button>
    </div>
    {state.status === 'loading' && <p role="status">Carregando inspeções…</p>}
    {state.status === 'error' && <><p role="alert">Não foi possível listar as inspeções.</p><Button onClick={() => { setState({ status: 'loading' }); setAttempt((value) => value + 1) }}>Tentar novamente</Button></>}
    {state.status === 'loaded' && <>
      <p role="status">{cards.length === 0 ? 'Nenhuma inspeção encontrada.' : `${cards.length} inspeções encontradas.`}</p>
        <Button
          type="button"
          variant="outline"
          aria-label={`Ordenação atual: ${order === 'recentes' ? 'mais recentes primeiro' : 'mais antigos primeiro'}. Clique para mostrar ${order === 'recentes' ? 'mais antigos' : 'mais recentes'} primeiro.`}
          onClick={() => update('ordem', order === 'recentes' ? 'antigos' : '')}
        >
          {order === 'recentes' ? 'Mais recentes primeiro' : 'Mais antigos primeiro'} <span aria-hidden="true">↕</span>
        </Button>
      <ul className="space-y-4">{cards.map((inspection) => <li key={inspection.id} className="min-w-0 space-y-2 rounded-lg border p-4">
        <p className="text-sm">{inspection.protocolo}</p>
        <h2 className="wrap-break-word text-lg font-semibold"><Link className="underline focus-visible:outline-2 focus-visible:outline-ring" to={`/inspecoes/${encodeURIComponent(inspection.id)}${search}`}>{inspection.titulo}</Link></h2>
        <p>{inspection.setor} · {inspection.responsavel}</p>
        <p>Data: <time dateTime={inspection.dataInspecao}>{inspection.dataInspecao.split('-').reverse().join('/')}</time></p>
        <p>Status: {{ em_preenchimento: 'Em preenchimento', em_aprovacao: 'Em aprovação', aprovada: 'Aprovada', reprovada: 'Reprovada' }[inspection.status]}</p>
      </li>)}</ul>
    </>}
  </>
}
