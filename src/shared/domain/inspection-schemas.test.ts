import { describe, expect, it } from 'vitest'
import { createInspectionFixture } from '@/test/fixtures/inspection'
import { CHECKLIST_PERGUNTAS, criarChecklistVazio } from './checklist'
import {
  checklistSchema,
  eventoHistoricoSchema,
  inspecaoSchema,
  statusInspecaoSchema,
} from './inspection-schemas'

describe('schemas de inspeção', () => {
  it('aceita uma inspeção em preenchimento com respostas pendentes', () => {
    const inspection = createInspectionFixture()
    expect(inspecaoSchema.parse(inspection)).toEqual(inspection)
  })

  it.each(statusInspecaoSchema.options)('aceita o status estrutural %s', (status) => {
    expect(inspecaoSchema.safeParse({ ...createInspectionFixture(), status }).success).toBe(true)
  })

  it.each([
    { status: 'cancelada' },
    { setor: 'Financeiro' },
    { responsavel: 'Equipe D' },
    { titulo: '   ' },
    { id: '' },
    { protocolo: '' },
    { dataInspecao: '2026-02-30' },
    { dataInspecao: '09/09/2026' },
    { criadoEm: 'ontem' },
    { atualizadoEm: '2026-09-09T12:00:00' },
    { historico: [{ id: 'e1', tipo: 'edicao', dataHora: '2026-09-09T12:00:00Z' }] },
    { historico: [{ id: 'e1', tipo: 'reprovacao', dataHora: 'inválida', motivo: 'Proteção solta.' }] },
    { historico: [{ id: 'e1', tipo: 'reprovacao', dataHora: '2026-09-09T12:00:00Z' }] },
    { historico: [{ id: 'e1', tipo: 'criacao', dataHora: '2026-09-09T12:00:00Z', motivo: 'Proteção solta.' }] },
  ])('rejeita dados inválidos: %j', (fields) => {
    expect(inspecaoSchema.safeParse({ ...createInspectionFixture(), ...fields }).success).toBe(false)
  })

  it.each([3, 80])('aceita título de %i caracteres após trim', (length) => {
    const titulo = 'a'.repeat(length)
    const parsed = inspecaoSchema.parse({ ...createInspectionFixture(), titulo: `  ${titulo}  ` })
    expect(parsed.titulo).toBe(titulo)
  })

  it.each(['', '  ab  ', 'a'.repeat(81)])('rejeita título fora dos limites: %j', (titulo) => {
    expect(inspecaoSchema.safeParse({ ...createInspectionFixture(), titulo }).success).toBe(false)
  })

  it('aceita motivo de histórico e timestamp com fuso explícito', () => {
    const inspection = createInspectionFixture()
    inspection.historico.push({
      id: 'evento-2',
      tipo: 'reprovacao',
      dataHora: '2026-09-09T09:00:00-04:00',
      motivo: 'Proteção solta.',
    })
    expect(inspecaoSchema.safeParse(inspection).success).toBe(true)
  })
})

describe('eventos de histórico', () => {
  const event = { id: 'evento-1', dataHora: '2026-09-09T12:00:00Z' }

  it.each(['criacao', 'envio', 'aprovacao', 'reabertura'])(
    'aceita %s sem motivo e rejeita a presença desse campo',
    (tipo) => {
      expect(eventoHistoricoSchema.parse({ ...event, tipo })).toEqual({ ...event, tipo })
      expect(eventoHistoricoSchema.safeParse({ ...event, tipo, motivo: 'Proteção solta.' }).success).toBe(false)
      expect(eventoHistoricoSchema.safeParse({ ...event, tipo, motivo: undefined }).success).toBe(false)
    },
  )

  it('exige motivo na reprovação', () => {
    expect(eventoHistoricoSchema.safeParse({ ...event, tipo: 'reprovacao' }).success).toBe(false)
  })

  it.each([undefined, null, 10, '', '   ', '  123456789  ', 'a'.repeat(301)])(
    'rejeita motivo inválido: %j',
    (motivo) => {
      expect(eventoHistoricoSchema.safeParse({ ...event, tipo: 'reprovacao', motivo }).success).toBe(false)
    },
  )

  it.each([10, 300])('aceita motivo de %i caracteres após trim', (length) => {
    const motivo = 'a'.repeat(length)
    const parsed = eventoHistoricoSchema.parse({
      ...event,
      tipo: 'reprovacao',
      motivo: `  ${motivo}  `,
    })
    expect(parsed).toEqual({ ...event, tipo: 'reprovacao', motivo })
  })
})

describe('checklist fixo', () => {
  it('exige exatamente as três perguntas definidas pela aplicação', () => {
    const checklist = criarChecklistVazio()
    expect(Object.keys(CHECKLIST_PERGUNTAS)).toEqual(Object.keys(checklist))
    expect(Object.values(CHECKLIST_PERGUNTAS)).toEqual([
      'Identificação legível?',
      'Equipamento sem avarias aparentes?',
      'Proteções fixadas?',
    ])
    expect(checklistSchema.safeParse({ identificacao: checklist.identificacao }).success).toBe(false)
    expect(checklistSchema.safeParse({ ...checklist, extra: checklist.avarias }).success).toBe(false)
  })

  it.each(['sim', 'nao', null])('aceita a resposta %s', (resposta) => {
    expect(checklistSchema.safeParse({
      ...criarChecklistVazio(),
      avarias: { resposta, observacao: '' },
    }).success).toBe(true)
  })

  it.each([
    { resposta: 'talvez', observacao: '' },
    { resposta: null },
    { resposta: 'sim', observacao: 10 },
    { resposta: 'sim', observacao: '', pergunta: 'Identificação legível?' },
  ])('rejeita resposta inválida ou definição persistida: %j', (item) => {
    expect(checklistSchema.safeParse({ ...criarChecklistVazio(), identificacao: item }).success).toBe(false)
  })

  it('cria respostas independentes entre itens e entre inspeções', () => {
    const first = criarChecklistVazio()
    const second = criarChecklistVazio()
    first.identificacao.resposta = 'sim'
    first.avarias.observacao = 'Risco na lateral'

    expect(first.avarias.resposta).toBeNull()
    expect(second.identificacao.resposta).toBeNull()
    expect(second.avarias.observacao).toBe('')
  })
})
