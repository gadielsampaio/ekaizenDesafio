# Sistema de inspeções

Desafio técnico de Frontend Pleno, implementado por capacidades. Estão disponíveis criação em `/inspecoes/nova`, edição e envio em `/inspecoes/:id/editar`, com persistência local e um placeholder de consulta em `/inspecoes/:id`.

## Executar

Use Node.js 24 (a partir de 24.13), conforme `.nvmrc` e `engines`.

```sh
npm ci
npm run dev
```

```sh
npm run build       # Verifica TypeScript e gera dist/
npm test            # Executa a suíte uma vez
npm run test:watch  # Modo interativo do Vitest
npm run lint       # Verifica as regras do projeto
npm run typecheck  # Verifica os tipos, incluindo testes e configuração
npm run preview    # Serve o build localmente
```

O `package-lock.json` fixa as versões para instalações reproduzíveis. A stack inclui Vite, React, TypeScript, Tailwind CSS, shadcn/ui, React Router DOM, Zod, Vitest, React Testing Library e user-event. Oxlint foi mantido do template Vite para verificar as restrições de código.

## Organização

```text
src/
  app/                         # Composição do repositório, rotas, placeholder e CSS
  features/
    create-inspection/         # Formulário, schema de entrada, criação e testes
    edit-inspection/           # Rascunho, validação de envio, transição e testes
    review-inspection/         # Consulta somente leitura, decisões e testes
    reopen-inspection/         # Reabertura, ação na consulta e testes
  shared/
    domain/                    # Tipos, schemas e perguntas fixas
    contracts/                 # InspectionRepository
    storage/                   # Envelope v1 e acesso assíncrono ao storage
    ui/                        # shadcn/ui e campos usados por criação e edição
    lib/                       # cn, tipos do formulário e mensagens de validação
  test/                        # Setup e fixtures reutilizáveis
```

As pastas de capacidades são criadas somente quando implementadas, mantendo juntos componentes, funções de negócio, validações específicas e testes. Não criar camadas globais de controllers/services/use-cases. Extrair para `shared` apenas o que for de fato compartilhado. `shared` não importa de `features` nem de `app`; `app` faz a composição. Não há contêiner de injeção, repositório genérico, gerenciador de estado global ou biblioteca de formulários.

## Tipos e validação

`shared/domain/inspection-schemas.ts` é a fonte dos formatos; `inspection.ts` exporta os tipos inferidos com `z.infer`. TypeScript usa `strict: true`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`, herdados pela aplicação e pela configuração Vite. O lint proíbe `any`, comentários que desabilitam a checagem e type assertions, exceto `as const`.

Os schemas validam enums, campos obrigatórios, datas ISO (`YYYY-MM-DD`) e timestamps ISO com fuso. Objetos são estritos: campos extras são rejeitados. O checklist exige exatamente `identificacao`, `avarias` e `protecoes`; cada resposta aceita `sim`, `nao` ou `null` e uma observação textual. As perguntas vivem apenas em `CHECKLIST_PERGUNTAS`, fora das inspeções persistidas. `criarChecklistVazio()` retorna objetos independentes para cada inspeção.

Esses schemas validam a estrutura dos dados. A edição e o envio possuem regras específicas no slice, fora da UI; a revisão e a reabertura também validam o estado antes de decidir. A existência de um status válido no schema não autoriza uma transição.

## Persistência

`InspectionRepository` define `list`, `findById`, `create`, `saveDraft`, `submit`, `approve`, `reject` e `reopen`. As mutações retornam `Promise<Inspecao>`; `findById` retorna `null` quando não encontra. A implementação concreta em `app/inspection-repository.ts` disponibiliza `create`, `findById`, `saveDraft`, `submit`, `approve`, `reject` e `reopen`, tipadas como um subconjunto de `InspectionRepository`. As outras operações não possuem implementação ou stubs. A UI de criação recebe apenas a operação `create`, sem acesso a escrita de snapshots ou localStorage.

`createInspectionStorage(window.localStorage)` fornece `read()` e `write(inspections)`, ambos assíncronos, sem latência artificial. A dependência é recebida por parâmetro para facilitar testes e evitar acesso ao navegador durante a importação do módulo.

Chave estável: `ekaizen:inspections`. Envelope inicial:

```json
{
  "version": 1,
  "inspections": []
}
```

- Chave ausente: retorna um envelope vazio, sem gravar dados automaticamente.
- Leitura: o resultado de `JSON.parse` é tratado como `unknown` e validado integralmente com Zod.
- Escrita: valida o novo snapshot e o conteúdo existente antes de gravar o envelope inteiro em uma única chamada a `setItem`.
- JSON inválido, schema inválido ou versão desconhecida: rejeita a operação e preserva o conteúdo original, inclusive em tentativas de sobrescrita.
- Bloqueio do navegador ou limite de armazenamento: propaga o erro pela Promise.

Não há migrações porque existe apenas a versão 1. Uma versão futura exigirá uma migração explícita antes da validação no formato corrente; dados antigos não devem ser descartados silenciosamente. O storage não coordena escritas entre abas.

## Criar uma inspeção

Na página inicial, use **Nova inspeção**. Preencha título, setor, responsável e data; clique em **Salvar inspeção**. O título é validado após trim (3 a 80 caracteres). Setores e responsáveis vêm dos enums de domínio. A data deve existir no calendário, sem restrição de passado ou futuro. O formulário mantém strings potencialmente incompletas e valida com um schema derivado do domínio; não usa `Inspecao` como estado.

A função de criação valida novamente os dados recebidos e o objeto final antes de gravar. O formulário inicia o checklist com respostas `null` e observações vazias e permite respondê-lo parcialmente, incluindo Não com observação ainda inválida. A criação persiste esse checklist, gera status `em_preenchimento`, um único evento `criacao` e timestamps iguais para criação, atualização e evento. O relógio utilizado é o do navegador.

IDs seguem `inspecao-N` e protocolos `INS-N`, com pelo menos seis dígitos no protocolo. A sequência começa na quantidade armazenada mais um e avança enquanto qualquer um dos identificadores colidir. A garantia de unicidade é relativa aos dados armazenados; não depende de aleatoriedade. Chamadas de criação na mesma instância do repositório são serializadas para evitar perda de dados e colisões. Essa instância é criada uma única vez na composição da aplicação. Não há sincronização entre abas ou instâncias independentes.

Durante a gravação, o formulário e o botão ficam desabilitados e uma trava síncrona impede submits repetidos. Em falha, todos os valores permanecem no formulário, sem navegação ou anúncio de sucesso; o usuário pode tentar salvar novamente. Em sucesso, a rota de destino consulta a inspeção persistida por id e mostra protocolo, título, status e acesso à edição quando em preenchimento. Essa consulta também funciona ao recarregar a página, e possui estados de carregamento, não encontrado e erro com nova tentativa.

A saída com dados não salvos exige confirmação. O React Router usa `createBrowserRouter` para suportar [bloqueio de navegação](https://reactrouter.com/api/hooks/useBlocker); recarga e fechamento da aba usam `beforeunload`. Durante a gravação, a navegação interna é bloqueada. O formulário usa o `Button` local do shadcn/ui e controles nativos com labels, mensagens associadas, foco visível e ordem de teclado. A largura foi conferida em 390 px e desktop.

## Editar e enviar para aprovação

Acesse **Editar inspeção** no placeholder. Somente inspeções `em_preenchimento` podem ser editadas ou enviadas, com verificação também na camada de dados. O rascunho aceita checklist incompleto e observações de Não ainda inválidas, preserva identidade e histórico, e atualiza `atualizadoEm` sem criar evento de edição.

**Enviar para aprovação** valida os campos obrigatórios, todas as respostas e cada observação de Não após trim (10–300 caracteres). Observações de respostas Sim não são ressalvas ativas: ficam ocultas, não são exigidas nem validadas para envio, e o texto anterior é preservado caso a resposta volte a Não.

`submit(id)` envia o rascunho persistido; `submit(id, input)` permite enviar os campos atuais sem precisar salvá-los antes. A UI usa a segunda forma. A operação faz uma única escrita com os dados, status `em_aprovacao`, `atualizadoEm` e um evento `envio`. Falhas de validação ou gravação não mudam o snapshot confirmado. Mutações compartilham a mesma fila para impedir que envios repetidos dupliquem eventos ou que um rascunho concorrente reverta o envio.

Durante a operação, os campos e botões ficam desabilitados. Falhas preservam todos os valores digitados e permitem tentar novamente. Salvar mantém a edição aberta; enviar navega para o placeholder, que consulta o estado persistido. Sair com alterações não salvas exige confirmação. Os campos de criação e edição são compartilhados, mantendo as regras e operações em seus slices.

## Revisar uma inspeção

Na consulta `/inspecoes/:id`, inspeções em aprovação mostram os dados, checklist e histórico somente leitura, com ações **Aprovar** e **Reprovar**. O checklist não decide automaticamente o resultado: mesmo com respostas Não, a pessoa revisora pode aprovar. Observações de respostas Sim permanecem ocultas.

Reprovar abre um formulário na própria página. O motivo é obrigatório, com trim e 10–300 caracteres, reutilizando o mesmo schema do evento de reprovação. Cancelar fecha o formulário sem chamar o repositório nem modificar a inspeção. Durante uma decisão, as ações e o motivo ficam bloqueados. Em falha, o texto digitado é preservado para nova tentativa e o status confirmado permanece igual.

A camada de dados aceita decisões apenas em `em_aprovacao`. Cada decisão grava o novo status, a atualização de data/hora e um evento de aprovação ou reprovação em uma única escrita. A fila existente serializa as decisões; uma decisão repetida ou concorrente perde a autorização pelo estado e não gera outro evento. Após sucesso, a consulta adota a inspeção retornada pelo repositório imediatamente e remove as ações de revisão. Inspeções aprovadas e reprovadas continuam somente leitura até uma transição autorizada.

## Reabrir uma inspeção

A consulta oferece **Reabrir para correção** somente para inspeções reprovadas. A camada de dados verifica esse estado, preserva os campos, checklist e histórico anterior e grava `em_preenchimento`, `atualizadoEm` e um único evento `reabertura`. A fila existente impede reaberturas repetidas. Após sucesso, a consulta reflete imediatamente o retorno persistido e oferece acesso à edição. Durante o processamento, o botão fica bloqueado; em falha, o estado confirmado permanece igual e é possível tentar novamente.

## Próximas etapas

Implementar as demais capacidades com funções testáveis que validem a ação antes de persistir alterações ou acrescentar eventos. O fluxo definido é:

```text
em_preenchimento → enviar → em_aprovacao
em_aprovacao → aprovar → aprovada (somente leitura)
em_aprovacao → reprovar → reprovada
reprovada → reabrir → em_preenchimento
```

Permanecem pendentes: listagem/filtros/contadores, detalhe completo e os seis exemplos iniciais. O armazenamento corrompido já é rejeitado sem perder dados e a UI mostra erro, mas ainda falta a recuperação explícita com reset confirmado, exigida pelo PDF. Também permanecem pendentes o simulador reproduzível de atraso/falha, a configuração e aferição da cobertura mínima de 80% de linhas e branches das regras/dados, e os entregáveis finais de publicação. As falhas e atrasos deste slice são controlados nos testes, por mocks e Promises, sem simulador na aplicação.

## UI e testes

Tailwind usa o plugin de Vite. O shadcn/ui foi configurado manualmente com `components.json`, aliases `@/*`, tokens CSS e um `Button` local baseado no padrão new-york. Radix Slot permite compor o botão com links; `class-variance-authority`, `clsx` e `tailwind-merge` suportam variantes e classes. Novos componentes podem ser adicionados conforme forem necessários:

```sh
npx shadcn@latest add input
```

Referências da configuração: [shadcn/ui com Vite](https://ui.shadcn.com/docs/installation/vite), [Tailwind com Vite](https://tailwindcss.com/docs/installation/using-vite) e [Vitest](https://vitest.dev/guide/).

Os testes ficam próximos ao código. A suíte cobre schemas, checklist, leitura e escrita no localStorage do jsdom, corrupção, versões incompatíveis, falhas de acesso e quota, preservação de dados e histórico em escrita inválida e navegação com React Testing Library + user-event. Os testes do slice também cobrem cadastro válido, entradas inválidas, estado inicial, histórico único, persistência após recarga, colisões e chamadas concorrentes, envio repetido, erros associados aos campos, ordem de foco, descarte confirmado e nova tentativa após falha. Os testes de edição cobrem rascunhos incompletos, envio atômico, limites das observações, bloqueio por estado, concorrência, falhas sem perda de dados e comportamento do formulário. Os testes de revisão cobrem decisões, motivos inválidos, cancelamento, concorrência e falhas sem perda de dados. Os testes de reabertura cobrem estados inválidos, repetição, preservação do histórico e checklist, falha com nova tentativa e retomada da edição. Não há percentual de cobertura aferido nesta etapa.
