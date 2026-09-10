import type { StatusInspecao } from '@/shared/domain/inspection'

export const inspectionStatus: Record<StatusInspecao, { label: string; style: string }> = {
  em_preenchimento: { label: 'Em preenchimento', style: 'bg-neutral-100 text-neutral-700' },
  em_aprovacao: { label: 'Em aprovação', style: 'bg-amber-50 text-amber-900' },
  aprovada: { label: 'Aprovada', style: 'bg-emerald-50 text-emerald-900' },
  reprovada: { label: 'Reprovada', style: 'bg-red-50 text-red-900' },
}
