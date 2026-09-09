import type { z } from 'zod'
import type {
  checklistIdSchema,
  checklistSchema,
  eventoHistoricoSchema,
  inspecaoSchema,
  responsavelSchema,
  respostaChecklistSchema,
  respostaItemChecklistSchema,
  setorSchema,
  statusInspecaoSchema,
  tipoEventoSchema,
} from './inspection-schemas'

// Os schemas são a fonte única dos formatos em runtime e dos tipos TypeScript.
export type Setor = z.infer<typeof setorSchema>
export type Responsavel = z.infer<typeof responsavelSchema>
export type StatusInspecao = z.infer<typeof statusInspecaoSchema>
export type ChecklistId = z.infer<typeof checklistIdSchema>
export type RespostaChecklist = z.infer<typeof respostaChecklistSchema>
export type RespostaItemChecklist = z.infer<typeof respostaItemChecklistSchema>
export type Checklist = z.infer<typeof checklistSchema>
export type TipoEvento = z.infer<typeof tipoEventoSchema>
export type EventoHistorico = z.infer<typeof eventoHistoricoSchema>
export type Inspecao = z.infer<typeof inspecaoSchema>
