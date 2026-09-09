import { criarChecklistVazio } from '@/shared/domain/checklist'
import type { Inspecao } from '@/shared/domain/inspection'
import { inspecaoSchema } from '@/shared/domain/inspection-schemas'

const examples = [
  ['Transportador 01', 'Produção', 'Equipe A', 'em_preenchimento'],
  ['Furadeira 02', 'Manutenção', 'Equipe B', 'em_aprovacao'],
  ['Prensa 03', 'Produção', 'Equipe A', 'aprovada'],
  ['Paleteira 04', 'Almoxarifado', 'Equipe C', 'reprovada'],
  ['Esmeril 05', 'Manutenção', 'Equipe B', 'em_preenchimento'],
  ['Empilhadeira 06', 'Almoxarifado', 'Equipe C', 'em_aprovacao'],
] as const

// IDs estáveis identificam os exemplos mesmo após edição ou mudança de status.
export function addMissingExamples(stored: readonly Inspecao[]): Inspecao[] {
  const inspections = [...stored]
  examples.forEach(([titulo, setor, responsavel, status], index) => {
    const id = `exemplo-${index + 1}`
    if (inspections.some((inspection) => inspection.id === id)) return
    let sequence = index + 1
    while (inspections.some((inspection) => inspection.protocolo === `INS-${String(sequence).padStart(6, '0')}`)) sequence += 1
    const checklist = criarChecklistVazio()
    if (index !== 4) checklist.identificacao.resposta = 'sim'
    if (status !== 'em_preenchimento') {
      checklist.avarias.resposta = status === 'aprovada' || index === 5 ? 'sim' : 'nao'
      checklist.protecoes.resposta = 'sim'
      if (checklist.avarias.resposta === 'nao') checklist.avarias.observacao = 'Avaria aparente na carenagem.'
    }
    const criadoEm = `2026-09-08T${String(8 + index).padStart(2, '0')}:00:00Z`
    const historico: Inspecao['historico'] = [{ id: `${id}:criacao`, tipo: 'criacao', dataHora: criadoEm }]
    if (status !== 'em_preenchimento') historico.push({ id: `${id}:envio`, tipo: 'envio', dataHora: criadoEm.replace(':00:00Z', ':10:00Z') })
    if (status === 'aprovada') historico.push({ id: `${id}:aprovacao`, tipo: 'aprovacao', dataHora: criadoEm.replace(':00:00Z', ':20:00Z') })
    if (status === 'reprovada') historico.push({ id: `${id}:reprovacao`, tipo: 'reprovacao', dataHora: criadoEm.replace(':00:00Z', ':20:00Z'), motivo: 'Pendência de integridade do equipamento não resolvida.' })
    inspections.push(inspecaoSchema.parse({ id, protocolo: `INS-${String(sequence).padStart(6, '0')}`, titulo, setor, responsavel, status, dataInspecao: '2026-09-08', checklist, historico, criadoEm, atualizadoEm: historico.at(-1)?.dataHora ?? criadoEm }))
  })
  return inspections
}
