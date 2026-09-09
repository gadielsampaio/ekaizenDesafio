import { criarChecklistVazio } from '@/shared/domain/checklist'
import type { Inspecao } from '@/shared/domain/inspection'

export function createInspectionFixture(): Inspecao {
  return {
    id: 'inspecao-1',
    protocolo: 'INS-0001',
    titulo: 'Inspeção da prensa',
    setor: 'Produção',
    responsavel: 'Equipe A',
    dataInspecao: '2026-09-09',
    status: 'em_preenchimento',
    checklist: criarChecklistVazio(),
    historico: [{ id: 'evento-1', tipo: 'criacao', dataHora: '2026-09-09T12:00:00Z' }],
    criadoEm: '2026-09-09T12:00:00Z',
    atualizadoEm: '2026-09-09T12:00:00Z',
  }
}
