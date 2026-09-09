# Sistema de inspeções

Desafio técnico de Frontend Pleno, implementado por capacidades. Além da fundação, está disponível a criação de inspeções em `/inspecoes/nova`, com persistência local e um placeholder de consulta em `/inspecoes/:id`.

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
  shared/
    domain/                    # Tipos, schemas e perguntas fixas
    contracts/                 # InspectionRepository
    storage/                   # Envelope v1 e acesso assíncrono ao storage
    ui/                        # Componentes locais do shadcn/ui
    lib/                       # cn, utilitário compartilhado pelos componentes
  test/                        # Setup e fixtures reutilizáveis
```

As pastas de capacidades são criadas somente quando implementadas, mantendo juntos componentes, funções de negócio, validações específicas e testes. Não criar camadas globais de controllers/services/use-cases. Extrair para `shared` apenas o que for de fato compartilhado. `shared` não importa de `features` nem de `app`; `app` faz a composição. Não há contêiner de injeção, repositório genérico, gerenciador de estado global ou biblioteca de formulários.

## Tipos e validação

`shared/domain/inspection-schemas.ts` é a fonte dos formatos; `inspection.ts` exporta os tipos inferidos com `z.infer`. TypeScript usa `strict: true`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`, herdados pela aplicação e pela configuração Vite. O lint proíbe `any`, comentários que desabilitam a checagem e type assertions, exceto `as const`.

Os schemas validam enums, campos obrigatórios, datas ISO (`YYYY-MM-DD`) e timestamps ISO com fuso. Objetos são estritos: campos extras são rejeitados. O checklist exige exatamente `identificacao`, `avarias` e `protecoes`; cada resposta aceita `sim`, `nao` ou `null` e uma observação textual. As perguntas vivem apenas em `CHECKLIST_PERGUNTAS`, fora das inspeções persistidas. `criarChecklistVazio()` retorna objetos independentes para cada inspeção.

Esses schemas validam a estrutura dos dados. As regras de transição e a consistência entre ações e histórico serão implementadas nas próximas etapas, fora da UI. A existência de um status válido no schema não autoriza uma transição.

## Persistência

`InspectionRepository` define `list`, `findById`, `create`, `saveDraft`, `submit`, `approve`, `reject` e `reopen`. As mutações retornam `Promise<Inspecao>`; `findById` retorna `null` quando não encontra. A implementação concreta em `app/inspection-repository.ts` disponibiliza somente `create` e `findById`, tipadas com `Pick<InspectionRepository, 'create' | 'findById'>`. As outras operações não possuem implementação ou stubs. A UI de criação recebe apenas a operação `create`, sem acesso a escrita de snapshots ou localStorage.

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

A função de criação valida novamente os dados recebidos e o objeto final antes de gravar. Ela gera status `em_preenchimento`, checklist com respostas `null` e observações vazias, um único evento `criacao` e timestamps iguais para criação, atualização e evento. O relógio utilizado é o do navegador.

IDs seguem `inspecao-N` e protocolos `INS-N`, com pelo menos seis dígitos no protocolo. A sequência começa na quantidade armazenada mais um e avança enquanto qualquer um dos identificadores colidir. A garantia de unicidade é relativa aos dados armazenados; não depende de aleatoriedade. Chamadas de criação na mesma instância do repositório são serializadas para evitar perda de dados e colisões. Essa instância é criada uma única vez na composição da aplicação. Não há sincronização entre abas ou instâncias independentes.

Durante a gravação, o formulário e o botão ficam desabilitados e uma trava síncrona impede submits repetidos. Em falha, todos os valores permanecem no formulário, sem navegação ou anúncio de sucesso; o usuário pode tentar salvar novamente. Em sucesso, a rota de destino consulta a inspeção persistida por id e mostra somente protocolo e título. Essa consulta também funciona ao recarregar a página, e possui estados de carregamento, não encontrado e erro com nova tentativa.

A saída com dados não salvos exige confirmação. O React Router usa `createBrowserRouter` para suportar [bloqueio de navegação](https://reactrouter.com/api/hooks/useBlocker); recarga e fechamento da aba usam `beforeunload`. Durante a gravação, a navegação interna é bloqueada. O formulário usa o `Button` local do shadcn/ui e controles nativos com labels, mensagens associadas, foco visível e ordem de teclado. A largura foi conferida em 390 px e desktop.

## Próximas etapas

Implementar as demais capacidades com funções testáveis que validem a ação antes de persistir alterações ou acrescentar eventos. O fluxo definido é:

```text
em_preenchimento → enviar → em_aprovacao
em_aprovacao → aprovar → aprovada (somente leitura)
em_aprovacao → reprovar → reprovada
reprovada → reabrir → em_preenchimento
```

Permanecem fora deste slice: salvar rascunho, preencher checklist, transições, listagem/filtros/contadores, detalhe completo e os seis exemplos iniciais. O armazenamento corrompido já é rejeitado sem perder dados e a UI mostra erro, mas ainda falta a recuperação explícita com reset confirmado, exigida pelo PDF. Também permanecem pendentes o simulador reproduzível de atraso/falha, a configuração e aferição da cobertura mínima de 80% de linhas e branches das regras/dados, e os entregáveis finais de publicação. As falhas e atrasos deste slice são controlados nos testes, por mocks e Promises, sem simulador na aplicação.

## UI e testes

Tailwind usa o plugin de Vite. O shadcn/ui foi configurado manualmente com `components.json`, aliases `@/*`, tokens CSS e um `Button` local baseado no padrão new-york. Radix Slot permite compor o botão com links; `class-variance-authority`, `clsx` e `tailwind-merge` suportam variantes e classes. Novos componentes podem ser adicionados conforme forem necessários:

```sh
npx shadcn@latest add input
```

Referências da configuração: [shadcn/ui com Vite](https://ui.shadcn.com/docs/installation/vite), [Tailwind com Vite](https://tailwindcss.com/docs/installation/using-vite) e [Vitest](https://vitest.dev/guide/).

Os testes ficam próximos ao código. A suíte cobre schemas, checklist, leitura e escrita no localStorage do jsdom, corrupção, versões incompatíveis, falhas de acesso e quota, preservação de dados e histórico em escrita inválida e navegação com React Testing Library + user-event. Os testes do slice também cobrem cadastro válido, entradas inválidas, estado inicial, histórico único, persistência após recarga, colisões e chamadas concorrentes, envio repetido, erros associados aos campos, ordem de foco, descarte confirmado e nova tentativa após falha. Ainda não testa transições de status, pois essas ações pertencem às próximas etapas. Não há percentual de cobertura aferido nesta etapa.
