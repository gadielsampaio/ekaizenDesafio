# Sistema de Inspeções

Aplicação desenvolvida para o desafio técnico de **Frontend Pleno da eKaizen**.

O sistema permite cadastrar, preencher, revisar, aprovar, reprovar, corrigir e reenviar inspeções de equipamentos, com persistência local, histórico de eventos, filtros, simulação de operações assíncronas e recuperação de dados.

## Demo

**Aplicação:** <https://ekaizen-desafio.vercel.app>

## Stack

- React
- TypeScript strict
- Vite
- Tailwind CSS
- shadcn/ui
- React Router DOM
- Zod
- Vitest
- React Testing Library
- localStorage

## Executar localmente

Requer **Node.js 24.13+**.

```bash
npm ci
npm run dev
```

A aplicação estará disponível no endereço informado pelo Vite.

### Comandos

```bash
npm run dev            # Ambiente de desenvolvimento
npm run build          # TypeScript + build de produção
npm test               # Executa a suíte de testes
npm run test:watch     # Vitest em modo interativo
npm run test:coverage  # Testes com relatório de cobertura
npm run lint           # Análise estática
npm run typecheck      # Verificação de tipos
npm run preview        # Preview do build de produção
```

O `package-lock.json` é versionado para manter instalações reproduzíveis.

## Arquitetura

A aplicação foi organizada com uma abordagem pragmática de **Vertical Slice**.

Cada capacidade principal mantém próxima a sua UI, comportamento específico e testes:

```text
src/
├── app/
│   ├── composição do repository
│   ├── rotas
│   └── estilos globais
│
├── features/
│   ├── create-inspection/
│   ├── edit-inspection/
│   ├── review-inspection/
│   ├── reopen-inspection/
│   ├── list-inspections/
│   └── recover-data/
│
└── shared/
    ├── domain/
    ├── contracts/
    ├── storage/
    ├── lib/
    └── ui/
```

Código realmente compartilhado permanece em `shared`, incluindo domínio, contratos, persistência e componentes reutilizáveis.

A intenção foi manter os fluxos independentes sem introduzir camadas, estado global ou abstrações desnecessárias para o tamanho do projeto.

## Fluxo das inspeções

```text
Em preenchimento
      │
      └── Enviar ──────→ Em aprovação
                              │
                     ┌────────┴────────┐
                     │                 │
                  Aprovar           Reprovar
                     │                 │
                     ↓                 ↓
                  Aprovada         Reprovada
                                       │
                                    Reabrir
                                       │
                                       ↓
                                Em preenchimento
```

Enquanto está **Em preenchimento**, uma inspeção pode ser salva com o checklist incompleto.

Para enviar à aprovação, todas as perguntas precisam estar respondidas e cada resposta **Não** deve possuir uma observação válida.

Uma inspeção completa também pode ser criada e enviada diretamente para aprovação. Essa operação é atômica: criação, histórico e mudança de status são persistidos em uma única operação, sem deixar um rascunho parcial caso ocorra uma falha.

O checklist não aprova ou reprova automaticamente uma inspeção. A decisão pertence à pessoa revisora.

## Persistência

Os dados são armazenados em `localStorage` sob a chave:

```text
ekaizen:inspections
```

O armazenamento usa um envelope versionado:

```json
{
  "version": 1,
  "inspections": []
}
```

Dados recuperados do navegador são tratados como entrada não confiável e validados com **Zod** antes de serem utilizados.

JSON inválido, schema incompatível ou versão desconhecida não são sobrescritos silenciosamente. A aplicação apresenta uma opção explícita de recuperação.

O repository expõe operações assíncronas para:

- listar;
- consultar;
- criar;
- criar e enviar;
- salvar rascunho;
- enviar para aprovação;
- aprovar;
- reprovar;
- reabrir.

As regras de transição também são verificadas na camada de dados. Esconder um botão na interface não é a única proteção contra uma transição inválida.

## Simulação de operações

A aplicação possui controles para testar estados assíncronos sem depender de um backend real.

É possível configurar:

- sem atraso;
- 1 segundo;
- 3 segundos;
- 5 segundos;
- falha determinística da próxima operação.

A falha programada ocorre **uma única vez** e não depende de `Math.random()`.

Isso permite testar visualmente:

- skeletons de carregamento;
- estados de processamento;
- bloqueio de ações repetidas;
- erros;
- nova tentativa;
- preservação dos dados preenchidos após falhas.

A configuração da simulação existe apenas em memória e é reiniciada ao recarregar a página.

## Recuperação de dados

Para testar manualmente um armazenamento corrompido, abra o DevTools e altere somente o valor de:

```text
ekaizen:inspections
```

para um JSON inválido, por exemplo:

```text
{
```

Depois recarregue a aplicação.

O sistema detectará o conteúdo inválido e oferecerá a opção de restaurar os dados iniciais.

A restauração:

- exige confirmação;
- substitui somente os dados desta aplicação;
- não utiliza `localStorage.clear()`;
- restaura os seis exemplos iniciais;
- mantém outras chaves do `localStorage` intactas.

## Dados iniciais

Na primeira execução são disponibilizadas seis inspeções de exemplo, cobrindo os principais estados do fluxo:

- Em preenchimento
- Em aprovação
- Aprovada
- Reprovada

Os exemplos possuem IDs estáveis e não são duplicados após recarregar a aplicação.

## UX e acessibilidade

A interface foi construída para funcionar em desktop e em viewport de **390 px**.

Entre os cuidados adotados:

- navegação completa por teclado;
- foco visível;
- radios reais nos controles segmentados do checklist;
- status identificados por texto além da cor;
- dialogs acessíveis para confirmações;
- proteção contra descarte acidental de alterações;
- retorno de foco após dialogs;
- skeletons durante consultas;
- estados explícitos de loading, erro e vazio;
- bloqueio de cliques repetidos durante operações;
- preservação dos dados digitados após falhas;
- rotas navegáveis e recarregáveis diretamente.

## Testes e cobertura

A suíte final possui **232 testes**.

```bash
npm test
```

Para gerar o relatório de cobertura:

```bash
npm run test:coverage
```

Cobertura final:

| Métrica | Cobertura |
| --- | ---: |
| Lines | **99.36%** |
| Branches | **92.10%** |
| Functions | **98.23%** |
| Statements | **96.89%** |

O projeto exige no mínimo **80% de linhas e 80% de branches** no escopo configurado.

O relatório inclui regras de negócio, slices, repository, domínio e camada de persistência. Arquivos não exercitados também entram nos padrões de cobertura, e nenhuma regra é excluída apenas para elevar artificialmente o percentual.

## Decisões técnicas

### Vertical Slice

Os fluxos foram organizados por capacidade em vez de separar toda a aplicação por tipos técnicos de arquivo. Isso mantém UI, comportamento e testes relacionados próximos uns dos outros.

### Zod como fronteira de dados

Além da tipagem estática do TypeScript, os dados persistidos são validados em runtime antes de entrar na aplicação.

### TypeScript strict

O projeto utiliza `strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`.

Não são utilizados:

- `any`;
- `@ts-ignore`;
- `@ts-nocheck`;
- type assertions, exceto `as const`.

### Regras fora da interface

Transições como aprovação, reprovação, envio e reabertura são validadas também na camada de dados.

Uma chamada inválida ou repetida não altera o estado persistido nem duplica eventos de histórico.

### Operações atômicas

Alterações de dados, status e histórico relacionadas à mesma ação são confirmadas juntas.

A criação com envio direto, por exemplo, não executa uma criação seguida de outro salvamento independente.

### Sem estado global

Redux, Zustand e soluções semelhantes não foram adicionadas porque os fluxos e o tamanho da aplicação não justificaram essa complexidade.

### localStorage em vez de IndexedDB

O volume e a estrutura dos dados são pequenos. `localStorage` atende ao exercício com menor complexidade, mantendo a camada de persistência isolada da interface.

## Limitações

- Os dados existem somente no navegador.
- Não há sincronização entre abas, dispositivos ou usuários.
- Não há autenticação real, conforme o escopo do desafio.
- A configuração de simulação é perdida ao recarregar a página.
- Não existe backend ou API remota.

## Tempo de desenvolvimento

O projeto foi desenvolvido ao longo de **dois dias**, incluindo:

- modelagem do domínio e arquitetura;
- implementação dos fluxos;
- persistência e simulação;
- testes automatizados;
- auditoria funcional;
- acessibilidade;
- refinamento de UX/UI;
- validação responsiva;
- deploy.

**Tempo total aproximado: 14 horas.**

## Deploy

A versão de produção está publicada na Vercel:

**<https://ekaizen-desafio.vercel.app>**

O deploy possui fallback para SPA, permitindo acesso direto e recarregamento das rotas da aplicação.
