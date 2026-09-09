import type { Inspecao } from '@/shared/domain/inspection'

export const STATUS_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'em_preenchimento', label: 'Em preenchimento' },
  { value: 'em_aprovacao', label: 'Em aprovação' },
  { value: 'aprovada', label: 'Aprovadas' },
  { value: 'reprovada', label: 'Reprovadas' },
] as const

export function filterInspections(inspections: readonly Inspecao[], filters: { busca: string; setor: string; status: string }) {
  const search = filters.busca.trim().toLocaleLowerCase('pt-BR')
  const base = inspections.filter((inspection) => (
    (!filters.setor || inspection.setor === filters.setor)
    && [inspection.protocolo, inspection.titulo].some((value) => value.toLocaleLowerCase('pt-BR').includes(search))
  ))
  const counts = STATUS_FILTERS.map(({ value, label }) => ({ value, label, count: base.filter((inspection) => !value || inspection.status === value).length }))
  const cards = base.filter((inspection) => !filters.status || inspection.status === filters.status)
    .sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm) || a.id.localeCompare(b.id))
  return { cards, counts }
}
