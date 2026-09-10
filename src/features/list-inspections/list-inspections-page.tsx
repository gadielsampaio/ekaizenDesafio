import { inspectionStatus as statuses } from '@/shared/ui/inspection-status'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import type { Inspecao } from '@/shared/domain/inspection'
import { setorSchema, statusInspecaoSchema } from '@/shared/domain/inspection-schemas'
import { Button } from '@/shared/ui/button'
import { InspectionListSkeleton } from '@/shared/ui/inspection-loading-skeletons'
import { filterInspections, type InspectionOrder } from './list-inspections'

type State = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; inspections: Inspecao[] }
const control = 'h-12 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base font-normal outline-none hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:text-sm'

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
  const filtered = Boolean(filters.busca || filters.setor || filters.status)
  return <section className="inspection-list space-y-6" aria-labelledby="inspections-title">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Módulo de inspeções</p>
        <h1 id="inspections-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">Inspeções</h1>
        <p className="mt-2 text-sm text-muted-foreground">Acompanhe inspeções, pendências e aprovações.</p>
      </div>
      <Button asChild className="h-12 gap-2 self-start rounded-lg sm:self-end"><Link to="/inspecoes/nova"><span aria-hidden="true" className="text-lg font-normal">＋</span>Nova inspeção</Link></Button>
    </header>
    <div className="space-y-5">
      {state.status === 'loaded' && <div className="flex min-w-0 flex-wrap gap-1 rounded-xl border bg-neutral-100 p-1" role="group" aria-label="Filtrar por status">
        {counts.map(({ value, label, count }) => <Button key={value} className={`min-h-11 gap-2 rounded-lg px-3 sm:px-4 ${filters.status === value ? 'bg-white text-foreground hover:bg-white' : 'text-muted-foreground hover:bg-neutral-200/60 hover:text-foreground'}`} variant="ghost" aria-pressed={filters.status === value} onClick={() => update('status', value)}>
          {label} <span className="text-xs font-normal tabular-nums text-muted-foreground">({count})</span>
        </Button>)}
      </div>}
      <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_15rem_auto]">
        <label className="block min-w-0 text-sm font-medium"><span className="sr-only">Buscar por protocolo ou título</span>
          <input className={control} type="search" placeholder="Buscar por protocolo ou título" value={filters.busca} onChange={(event) => update('busca', event.target.value)} />
        </label>
        <label className="block min-w-0 text-sm font-medium"><span className="sr-only">Setor</span>
          <select className={control} value={filters.setor} onChange={(event) => update('setor', event.target.value)}><option value="">Todos os setores</option>{setorSchema.options.map((value) => <option key={value}>{value}</option>)}</select>
        </label>
        {filtered && <Button className="h-11 justify-self-start" variant="ghost" onClick={() => setParams({})}>Limpar</Button>}
      </div>
    </div>
    {state.status === 'loading' && <InspectionListSkeleton />}
    {state.status === 'error' && <div className="space-y-4 rounded-lg border bg-card p-6"><p role="alert">Não foi possível listar as inspeções.</p><Button variant="outline" onClick={() => { setState({ status: 'loading' }); setAttempt((value) => value + 1) }}>Tentar novamente</Button></div>}
    {state.status === 'loaded' && <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p role={cards.length > 0 ? 'status' : undefined}>{cards.length} {cards.length === 1 ? 'inspeção encontrada' : 'inspeções encontradas'}</p>
        <Button
          type="button"
          variant="ghost"
          className="px-0 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
          aria-label={`Ordenação atual: ${order === 'recentes' ? 'mais recentes primeiro' : 'mais antigos primeiro'}. Clique para mostrar ${order === 'recentes' ? 'mais antigos' : 'mais recentes'} primeiro.`}
          onClick={() => update('ordem', order === 'recentes' ? 'antigos' : '')}
        >
          {order === 'recentes' ? 'Mais recentes primeiro' : 'Mais antigos primeiro'} <span aria-hidden="true">↕</span>
        </Button>
      </div>
      {cards.length === 0 ? <div className="rounded-lg border bg-card px-6 py-10 text-center"><p role="status" className="font-medium">Nenhuma inspeção encontrada.</p><p className="mt-2 text-sm text-muted-foreground">{filtered ? 'Ajuste os filtros para buscar novamente.' : 'Crie uma inspeção para começar.'}</p></div> :
        <div className="overflow-hidden rounded-2xl border bg-card">
        <div aria-hidden="true" className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_8rem_10rem] gap-6 border-b bg-neutral-50 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid"><span>Inspeção</span><span>Setor / equipe</span><span>Data</span><span>Status</span></div>
        <ul className="divide-y">{cards.map((inspection) => <li key={inspection.id}>
          <Link aria-labelledby={`title-${inspection.id}`} className="group grid grid-cols-2 gap-3 p-4 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_8rem_10rem] lg:items-center lg:gap-6 lg:px-5 lg:py-5" to={`/inspecoes/${encodeURIComponent(inspection.id)}${search}`}>
            <div className="col-span-2 min-w-0 lg:col-span-1">
              <p className="font-mono text-xs text-muted-foreground">{inspection.protocolo}</p>
              <h2 id={`title-${inspection.id}`} className="mt-1 wrap-anywhere text-base font-semibold group-hover:underline">{inspection.titulo}</h2>
            </div>
            <p className="col-span-2 text-sm lg:col-span-1">{inspection.setor}<span className="text-muted-foreground"><span className="lg:hidden"> · </span><span className="lg:block lg:mt-1">{inspection.responsavel}</span></span></p>
            <p className="text-sm tabular-nums"><span className="mr-2 block text-xs text-muted-foreground lg:sr-only">Data da inspeção</span><time dateTime={inspection.dataInspecao}>{inspection.dataInspecao.split('-').reverse().join('/')}</time></p>
            <span className={`flex w-fit items-center gap-1.5 self-center justify-self-end rounded-full border border-transparent px-2.5 py-1.5 text-xs font-medium lg:justify-self-start ${statuses[inspection.status].style}`}><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />{statuses[inspection.status].label}</span>
          </Link>
        </li>)}</ul></div>}
    </>}
  </section>
}
