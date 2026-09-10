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
    list-inspections/           # Cards, filtros, contadores, exemplos e testes
    recover-data/               # Controles de simulação e recuperação confirmada
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

`InspectionRepository` define `list`, `findById`, `create`, `saveDraft`, `submit`, `approve`, `reject` e `reopen`. As mutações retornam `Promise<Inspecao>`; `findById` retorna `null` quando não encontra. A implementação concreta em `app/inspection-repository.ts` disponibiliza `create`, `findById`, `saveDraft`, `submit`, `approve`, `reject`, `reopen` e `list`, implementando todo o contrato `InspectionRepository`. A UI de criação recebe apenas a operação `create`, sem acesso a escrita de snapshots ou localStorage.

`createInspectionStorage(window.localStorage)` fornece `read()` e `write(inspections)`, ambos assíncronos. O repositório aplica a simulação antes de executar cada operação. A dependência é recebida por parâmetro para facilitar testes e evitar acesso ao navegador durante a importação do módulo.

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

Na página inicial, use **Nova inspeção**. Preencha título, setor, responsável e data; clique em **Salvar rascunho**. O título é validado após trim (3 a 80 caracteres). Setores e responsáveis vêm dos enums de domínio. A data deve existir no calendário, sem restrição de passado ou futuro. O formulário mantém strings potencialmente incompletas e valida com um schema derivado do domínio; não usa `Inspecao` como estado.

A função de criação valida novamente os dados recebidos e o objeto final antes de gravar. O formulário inicia o checklist com respostas `null` e observações vazias e permite respondê-lo parcialmente, incluindo Não com observação ainda inválida. A criação persiste esse checklist, gera status `em_preenchimento`, um único evento `criacao` e timestamps iguais para criação, atualização e evento. O relógio utilizado é o do navegador.

IDs seguem `inspecao-N` e protocolos `INS-N`, com pelo menos seis dígitos no protocolo. A sequência começa na quantidade armazenada mais um e avança enquanto qualquer um dos identificadores colidir. A garantia de unicidade é relativa aos dados armazenados; não depende de aleatoriedade. Chamadas de criação na mesma instância do repositório são serializadas para evitar perda de dados e colisões. Essa instância é criada uma única vez na composição da aplicação. Não há sincronização entre abas ou instâncias independentes.

Durante a gravação, o formulário e o botão ficam desabilitados e uma trava síncrona impede submits repetidos. Em falha, todos os valores permanecem no formulário, sem navegação ou anúncio de sucesso; o usuário pode tentar salvar novamente. Em sucesso, a rota de destino consulta a inspeção persistida por id e mostra protocolo, título, status e acesso à edição quando em preenchimento. Essa consulta também funciona ao recarregar a página, e possui estados de carregamento, não encontrado e erro com nova tentativa.

A saída com dados não salvos exige confirmação. O React Router usa `createBrowserRouter` para suportar [bloqueio de navegação](https://reactrouter.com/api/hooks/useBlocker); recarga e fechamento da aba usam `beforeunload`. Durante a gravação, a navegação interna é bloqueada. O formulário usa o `Button` local do shadcn/ui e controles nativos com labels, mensagens associadas, foco visível e ordem de teclado. A largura foi conferida em 390 px e desktop.

O botão **Enviar para aprovação** também está disponível na criação. Ele só habilita quando `submitInspectionSchema` aceita os metadados, as três respostas e as observações obrigatórias. `createAndSubmit(input)` reutiliza esse schema na camada de dados e grava a inspeção diretamente em `em_aprovacao`, com exatamente um evento `criacao` e um `envio`, em uma única escrita. Não chama `create` seguido de `submit`: falha de validação, simulação ou escrita não deixa um rascunho parcial. A operação participa da mesma fila e dos bloqueios de reset; a UI impede repetição e preserva campos em falha.

## Editar e enviar para aprovação

Acesse **Editar inspeção** no placeholder. Somente inspeções `em_preenchimento` podem ser editadas ou enviadas, com verificação também na camada de dados. O rascunho aceita checklist incompleto e observações de Não ainda inválidas, preserva identidade e histórico, e atualiza `atualizadoEm` sem criar evento de edição.

**Enviar para aprovação** permanece desativado enquanto `submitInspectionSchema` não aceitar os campos atuais. O mesmo schema valida os campos obrigatórios, todas as respostas e cada observação de Não após trim (10–300 caracteres). Observações de respostas Sim não são ressalvas ativas: ficam ocultas, não são exigidas nem validadas para envio, e o texto anterior é preservado caso a resposta volte a Não.

`submit(id)` envia o rascunho persistido; `submit(id, input)` permite enviar os campos atuais sem precisar salvá-los antes. A UI usa a segunda forma. A operação faz uma única escrita com os dados, status `em_aprovacao`, `atualizadoEm` e um evento `envio`. Falhas de validação ou gravação não mudam o snapshot confirmado. Mutações compartilham a mesma fila para impedir que envios repetidos dupliquem eventos ou que um rascunho concorrente reverta o envio.

Durante a operação, os campos e botões ficam desabilitados. Falhas preservam todos os valores digitados e permitem tentar novamente. Salvar mantém a edição aberta; enviar navega para o placeholder, que consulta o estado persistido. Sair com alterações não salvas exige confirmação. Os campos de criação e edição são compartilhados, mantendo as regras e operações em seus slices.

## Revisar uma inspeção

Na consulta `/inspecoes/:id`, inspeções em aprovação mostram os dados, checklist e histórico somente leitura, com ações **Aprovar** e **Reprovar**. O checklist não decide automaticamente o resultado: mesmo com respostas Não, a pessoa revisora pode aprovar. Observações de respostas Sim permanecem ocultas.

Reprovar abre um formulário na própria página. O motivo é obrigatório, com trim e 10–300 caracteres, reutilizando o mesmo schema do evento de reprovação. Cancelar fecha o formulário sem chamar o repositório nem modificar a inspeção. Durante uma decisão, as ações e o motivo ficam bloqueados. Em falha, o texto digitado é preservado para nova tentativa e o status confirmado permanece igual.

A camada de dados aceita decisões apenas em `em_aprovacao`. Cada decisão grava o novo status, a atualização de data/hora e um evento de aprovação ou reprovação em uma única escrita. A fila existente serializa as decisões; uma decisão repetida ou concorrente perde a autorização pelo estado e não gera outro evento. Após sucesso, a consulta adota a inspeção retornada pelo repositório imediatamente e remove as ações de revisão. Inspeções aprovadas e reprovadas continuam somente leitura até uma transição autorizada.

## Reabrir uma inspeção

A consulta oferece **Reabrir para correção** somente para inspeções reprovadas. A camada de dados verifica esse estado, preserva os campos, checklist e histórico anterior e grava `em_preenchimento`, `atualizadoEm` e um único evento `reabertura`. A fila existente impede reaberturas repetidas. Após sucesso, a consulta reflete imediatamente o retorno persistido e oferece acesso à edição. Durante o processamento, o botão fica bloqueado; em falha, o estado confirmado permanece igual e é possível tentar novamente.

## Listar inspeções

A página inicial lista cards por `criadoEm` decrescente, com desempate pelo ID. O botão de ordenação alterna entre **Mais recentes primeiro** (padrão) e **Mais antigos primeiro**, invertendo a ordem sem gravar dados ou recalcular as contagens de outra forma. `ordem=antigos` na URL preserva a escolha ao consultar e retornar; valores desconhecidos usam recentes. Limpar os filtros também restaura a ordem padrão. Busca parcial por título/protocolo ignora maiúsculas. Busca, setor e status se combinam por interseção; os contadores aplicam somente busca e setor, antes do status. Os chips com contagens controlam o filtro de status; busca e setor permanecem em controles próprios. A listagem usa linhas no desktop e cards no celular, com toda a área de cada item clicável. Os chips quebram linha conforme o espaço disponível, sem rolagem horizontal. A URL guarda os filtros durante consulta, edição e retorno; ao voltar, uma nova leitura atualiza cards e contadores. Há carregamento, erro com nova tentativa, nenhum resultado e limpeza dos filtros.

Na primeira listagem, os seis exemplos da seção 6 do PDF são acrescentados em uma única escrita validada. IDs estáveis `exemplo-1` a `exemplo-6` evitam duplicação e preservam mudanças posteriores. Bases já existentes são mantidas; apenas exemplos ausentes são adicionados, com protocolos livres. Não há exclusão nesta etapa. A inicialização compartilha a fila das mutações; falha não grava seed parcial e permite nova tentativa. Não há sincronização entre abas.

Todos os exemplos usam data da inspeção 08/09/2026. Horários fixos em UTC, nessa mesma data: criação às 08:00 (Transportador), 09:00 (Furadeira), 10:00 (Prensa), 11:00 (Paleteira), 12:00 (Esmeril) e 13:00 (Empilhadeira). Quando aplicável, envio ocorre dez minutos após a criação e decisão vinte minutos após. `atualizadoEm` corresponde ao último evento. Respostas, observações e motivo de reprovação reproduzem o PDF. Os testes verificam seed, recarga, colisões, filtros, contadores e atualização após ações.

## Próximas etapas

Implementar as demais capacidades com funções testáveis que validem a ação antes de persistir alterações ou acrescentar eventos. O fluxo definido é:

```text
em_preenchimento → enviar → em_aprovacao
em_aprovacao → aprovar → aprovada (somente leitura)
em_aprovacao → reprovar → reprovada
reprovada → reabrir → em_preenchimento
```

Permanecem pendentes: detalhe completo. A recuperação explícita e o simulador estão implementados. Permanecem pendentes os entregáveis finais de publicação.

## Simular atraso, falha e restaurar dados

Os controles de dados ficam abaixo do conteúdo principal, em todas as telas.

Abra **Simulação de operações**, disponível em todas as telas. **Atraso por operação** permite escolher 0, 1, 3 ou 5 segundos. **Falhar próxima operação** programa exatamente uma falha: a próxima chamada ao repositório (listar, consultar, criar, salvar, transicionar ou restaurar) aguarda o atraso escolhido e falha antes de acessar os dados. Chamadas subsequentes funcionam normalmente. Configure depois que a tela carregar para testar uma ação específica. Exemplo: abra a edição, escolha 3 segundos, programe a falha e salve. Durante a espera o envio fica bloqueado; após a falha os valores continuam preenchidos. Clique novamente para salvar sem falha.

Configuração e falha programada vivem somente em memória e são limpas ao recarregar. Cada chamada captura sua configuração ao entrar na fila; alterações no controle não afetam chamadas já iniciadas. A fila serializa também consultas e reset. Não há aleatoriedade. Os testes usam relógio falso para verificar atraso sem espera real. O reset fica indisponível enquanto houver operação pendente.

JSON inválido, conteúdo incompatível com o schema ou versão desconhecida produzem erro visível e uma orientação de recuperação, preservando o conteúdo original. **Restaurar dados da aplicação** solicita confirmação explícita, incluindo o descarte de alterações não salvas. Cancelar não escreve nada. Confirmar substitui somente `ekaizen:inspections` pelos seis exemplos originais, com histórico e horários fixos descritos acima; outras chaves permanecem intactas. A escrita é única e validada, sem apagar antes de gravar. Em falha, o conteúdo anterior permanece e o controle permite tentar novamente. Em sucesso, a tela é recarregada internamente para descartar estado antigo; na lista aparecem os seis exemplos, e detalhes de cadastros removidos informam que não foram encontrados.

Para testar corrupção manualmente, nas ferramentas do navegador altere apenas o valor de `ekaizen:inspections` para `{` e recarregue. A aplicação deve exibir o erro e oferecer restauração. Bloqueio de acesso ou quota do navegador também geram erros com nova tentativa, mas não são classificados como conteúdo corrompido. Nenhum reset usa `localStorage.clear()`.


## UI e testes

A fundação visual usa o container responsivo do redesign, fundo neutro e botões com altura mínima de 44 px no tamanho padrão. As classes compartilhadas `surface`, `field-control`, `notice` e `form-actions` centralizam a apresentação. O componente `BackToInspections` preserva os parâmetros da URL. Criação e edição usam `InspectionFormShell` com cabeçalho alinhado ao shell externo e ocupam a largura disponível. O checklist usa controles segmentados com radios nativos, foco visível e navegação por setas; a observação permanece junto à pergunta. Os botões preservam a ordem de teclado e compartilham a disposição responsiva. As confirmações de descarte e os anúncios de carregamento, erro e sucesso permanecem disponíveis.

Tailwind usa o plugin de Vite. O shadcn/ui foi configurado manualmente com `components.json`, aliases `@/*`, tokens CSS e um `Button` local baseado no padrão new-york. Radix Slot permite compor o botão com links; `class-variance-authority`, `clsx` e `tailwind-merge` suportam variantes e classes. Novos componentes podem ser adicionados conforme forem necessários:

```sh
npx shadcn@latest add input
```

Referências da configuração: [shadcn/ui com Vite](https://ui.shadcn.com/docs/installation/vite), [Tailwind com Vite](https://tailwindcss.com/docs/installation/using-vite) e [Vitest](https://vitest.dev/guide/).

Os testes ficam próximos ao código. A suíte cobre schemas, checklist, leitura e escrita no localStorage do jsdom, corrupção, versões incompatíveis, falhas de acesso e quota, preservação de dados e histórico em escrita inválida e navegação com React Testing Library + user-event. Os testes do slice também cobrem cadastro válido, entradas inválidas, estado inicial, histórico único, persistência após recarga, colisões e chamadas concorrentes, envio repetido, erros associados aos campos, ordem de foco, descarte confirmado e nova tentativa após falha. Os testes de edição cobrem rascunhos incompletos, envio atômico, limites das observações, bloqueio por estado, concorrência, falhas sem perda de dados e comportamento do formulário. Os testes de revisão cobrem decisões, motivos inválidos, cancelamento, concorrência e falhas sem perda de dados. Os testes de reabertura cobrem estados inválidos, repetição, preservação do histórico e checklist, falha com nova tentativa e retomada da edição. A cobertura é aferida conforme o escopo abaixo.


## Cobertura das regras e dados

Execute `npm run test:coverage`. O Vitest usa `@vitest/coverage-v8` na mesma versão do runner e reprova o comando se o conjunto medido ficar abaixo de **80% de linhas ou 80% de branches**. Os limites são globais, não por arquivo. O relatório aparece no terminal; abra `coverage/index.html` para detalhes por arquivo e branches não executados. `coverage/coverage-summary.json` contém os números para processamento automático. Relatórios gerados não são versionados.

Baseline antes do envio direto (211 testes), após o redesign da listagem e a ordenação: **98,12% de linhas (418/426)** e **87,74% de branches (272/310)**. A baseline anterior tinha 206 testes, 97,87% de linhas e 86,36% de branches. A primeira medição já passou os limites; nenhum teste foi acrescentado apenas para aumentar o percentual. Restam caminhos alternativos de UI, como saída da página/aba e alguns estados de erro. Os componentes de criação, edição e revisão têm branches abaixo de 80% individualmente; o requisito é aplicado ao conjunto declarado. Repositório, storage e simulador têm 100% de linhas e branches nesta medição.

Após o envio direto e o bloqueio de envio inválido na edição, a suíte tem **226 testes**, **98,15% de linhas (426/434)** e **88,44% de branches (291/329)**, mantendo o escopo e os limites anteriores.

O `coverage.include` em `vite.config.ts` inclui arquivos correspondentes mesmo quando não importados por nenhum teste. O escopo é:

| Caminho | Conteúdo incluído |
| --- | --- |
| `src/app/inspection-repository.ts` | Composição das operações, fila e bloqueio de reset |
| `src/features/**/*.{ts,tsx}` | Todos os slices: criação, edição/envio, revisão, reabertura, listagem/seed e recuperação; inclui schemas e componentes com validações/bloqueios |
| `src/shared/domain/**/*.ts` | Schemas de domínio, checklist e tipos |
| `src/shared/contracts/**/*.ts` | Contratos de persistência |
| `src/shared/storage/**/*.ts` | Envelope, validação, leitura, escrita, reset e simulação |
| `src/shared/lib/inspection-form.ts` | Tradução de erros de validação do formulário |

A única exclusão dentro desses padrões é `**/*.test.{ts,tsx}`. Arquivos que contêm somente tipos/interfaces não geram instruções executáveis; podem aparecer com totais zero e não alteram o denominador. Ficam fora do escopo entrada/rotas de composição, CSS, componentes compartilhados de apresentação, utilitário de classes, fixtures e setup de testes. Nenhuma regra de negócio ou operação de persistência foi excluída. Os componentes dos slices foram mantidos no escopo para também medir suas validações e proteções de interação.
