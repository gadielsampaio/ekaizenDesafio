import { z } from 'zod'

export const setorSchema = z.enum(['Produção', 'Manutenção', 'Almoxarifado'])
export const responsavelSchema = z.enum(['Equipe A', 'Equipe B', 'Equipe C'])
export const statusInspecaoSchema = z.enum([
  'em_preenchimento',
  'em_aprovacao',
  'aprovada',
  'reprovada',
])
export const checklistIdSchema = z.enum(['identificacao', 'avarias', 'protecoes'])
export const respostaChecklistSchema = z.enum(['sim', 'nao']).nullable()
export const tipoEventoSchema = z.enum([
  'criacao',
  'envio',
  'aprovacao',
  'reprovacao',
  'reabertura',
])

const textoObrigatorioSchema = z.string().trim().min(1, 'Campo obrigatório.')
const dataHoraSchema = z.iso.datetime({ offset: true })

export const respostaItemChecklistSchema = z.strictObject({
  resposta: respostaChecklistSchema,
  observacao: z.string(),
})

// As três chaves são obrigatórias, mesmo quando a resposta ainda é null.
export const checklistSchema = z.strictObject({
  identificacao: respostaItemChecklistSchema,
  avarias: respostaItemChecklistSchema,
  protecoes: respostaItemChecklistSchema,
})

const eventoBaseSchema = z.strictObject({
  id: textoObrigatorioSchema,
  dataHora: dataHoraSchema,
})

export const eventoHistoricoSchema = z.discriminatedUnion('tipo', [
  eventoBaseSchema.extend({ tipo: z.literal('criacao') }),
  eventoBaseSchema.extend({ tipo: z.literal('envio') }),
  eventoBaseSchema.extend({ tipo: z.literal('aprovacao') }),
  eventoBaseSchema.extend({ tipo: z.literal('reabertura') }),
  eventoBaseSchema.extend({
    tipo: z.literal('reprovacao'),
    motivo: z.string().trim().min(10).max(300),
  }),
])

export const inspecaoSchema = z.strictObject({
  id: textoObrigatorioSchema,
  protocolo: textoObrigatorioSchema,
  titulo: z.string().trim().min(3).max(80),
  setor: setorSchema,
  responsavel: responsavelSchema,
  dataInspecao: z.iso.date(),
  status: statusInspecaoSchema,
  checklist: checklistSchema,
  historico: z.array(eventoHistoricoSchema),
  criadoEm: dataHoraSchema,
  atualizadoEm: dataHoraSchema,
})
