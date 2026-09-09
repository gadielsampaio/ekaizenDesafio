import type { Checklist, ChecklistId } from './inspection'

export const CHECKLIST_PERGUNTAS = {
  identificacao: 'Identificação legível?',
  avarias: 'Equipamento sem avarias aparentes?',
  protecoes: 'Proteções fixadas?',
} as const satisfies Record<ChecklistId, string>

export function criarChecklistVazio(): Checklist {
  return {
    identificacao: { resposta: null, observacao: '' },
    avarias: { resposta: null, observacao: '' },
    protecoes: { resposta: null, observacao: '' },
  }
}
