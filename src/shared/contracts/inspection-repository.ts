import type { Inspecao } from '@/shared/domain/inspection'

export type CreateInspectionInput = Pick<
  Inspecao,
  'titulo' | 'setor' | 'responsavel' | 'dataInspecao'
>

export type SaveDraftInput = Pick<
  Inspecao,
  'titulo' | 'setor' | 'responsavel' | 'dataInspecao' | 'checklist'
>

/**
 * Operações assíncronas de inspeção, sem dependência de React ou do navegador.
 * A implementação deve validar cada ação antes de alterar dados ou histórico.
 * Falhas rejeitam a Promise; mutações bem-sucedidas retornam a inspeção persistida.
 */
export interface InspectionRepository {
  list(): Promise<Inspecao[]>
  findById(id: string): Promise<Inspecao | null>
  create(input: CreateInspectionInput): Promise<Inspecao>
  saveDraft(id: string, input: SaveDraftInput): Promise<Inspecao>
  submit(id: string): Promise<Inspecao>
  approve(id: string): Promise<Inspecao>
  reject(id: string, motivo: string): Promise<Inspecao>
  reopen(id: string): Promise<Inspecao>
}
