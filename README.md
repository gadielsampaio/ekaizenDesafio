# Sistema de inspeções

Base do desafio técnico de Frontend Pleno. Esta primeira etapa entrega configuração, tipos, validação, contrato de repositório e storage versionado. A aplicação exibe somente um placeholder e uma rota de página não encontrada.

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
  app/                         # Composição, rotas e CSS global
  features/
    list-inspections/          # Listar inspeções
    create-inspection/         # Criar inspeção
    fill-inspection/           # Preencher checklist e enviar
    review-inspection/         # Aprovar ou reprovar
    reopen-inspection/         # Reabrir uma inspeção reprovada
    view-inspection/           # Consultar detalhes e histórico
  shared/
    domain/                    # Tipos, schemas e perguntas fixas
    contracts/                 # InspectionRepository
    storage/                   # Envelope v1 e acesso assíncrono ao storage
    ui/                        # Componentes locais do shadcn/ui
    lib/                       # cn, utilitário compartilhado pelos componentes
  test/                        # Setup e fixtures reutilizáveis
```

As pastas de capacidades estão reservadas com `.gitkeep`. Quando implementadas, cada uma manterá juntos seus componentes, funções de negócio, validações específicas e testes. Não criar camadas globais de controllers/services/use-cases. Extrair para `shared` apenas o que for de fato compartilhado. `shared` não importa de `features` nem de `app`; `app` faz a composição. Não há contêiner de injeção, repositório genérico, gerenciador de estado global ou biblioteca de formulários.

## Tipos e validação

`shared/domain/inspection-schemas.ts` é a fonte dos formatos; `inspection.ts` exporta os tipos inferidos com `z.infer`. TypeScript usa `strict: true`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`, herdados pela aplicação e pela configuração Vite. O lint proíbe `any`, comentários que desabilitam a checagem e type assertions, exceto `as const`.

Os schemas validam enums, campos obrigatórios, datas ISO (`YYYY-MM-DD`) e timestamps ISO com fuso. Objetos são estritos: campos extras são rejeitados. O checklist exige exatamente `identificacao`, `avarias` e `protecoes`; cada resposta aceita `sim`, `nao` ou `null` e uma observação textual. As perguntas vivem apenas em `CHECKLIST_PERGUNTAS`, fora das inspeções persistidas. `criarChecklistVazio()` retorna objetos independentes para cada inspeção.

Esses schemas validam a estrutura dos dados. As regras de transição e a consistência entre ações e histórico serão implementadas nas próximas etapas, fora da UI. A existência de um status válido no schema não autoriza uma transição.

## Persistência

`InspectionRepository` define `list`, `findById` e `save`, todos retornando `Promise`. `findById` retorna `null` quando não encontra; `save` insere ou substitui uma inspeção por id, incluindo seu histórico. Nesta etapa existe somente o contrato, sem implementação concreta do repositório ou integração de dados com a UI.

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

## Próximas etapas

Implementar o repositório concreto e as capacidades com funções testáveis que validem a ação antes de persistir alterações ou acrescentar eventos. O fluxo definido é:

```text
em_preenchimento → enviar → em_aprovacao
em_aprovacao → aprovar → aprovada (somente leitura)
em_aprovacao → reprovar → reprovada
reprovada → reabrir → em_preenchimento
```

Nenhuma ação de negócio ou tela completa foi implementada nesta etapa. O storage é uma infraestrutura de snapshots; a autorização das transições deve ficar nas funções de negócio, antes de chamar o repositório.

## UI e testes

Tailwind usa o plugin de Vite. O shadcn/ui foi configurado manualmente com `components.json`, aliases `@/*`, tokens CSS e um `Button` local baseado no padrão new-york. Radix Slot permite compor o botão com links; `class-variance-authority`, `clsx` e `tailwind-merge` suportam variantes e classes. Novos componentes podem ser adicionados conforme forem necessários:

```sh
npx shadcn@latest add input
```

Referências da configuração: [shadcn/ui com Vite](https://ui.shadcn.com/docs/installation/vite), [Tailwind com Vite](https://tailwindcss.com/docs/installation/using-vite) e [Vitest](https://vitest.dev/guide/).

Os testes ficam próximos ao código. A suíte cobre schemas, checklist, leitura e escrita no localStorage do jsdom, corrupção, versões incompatíveis, falhas de acesso e quota, preservação de dados e histórico em escrita inválida e navegação com React Testing Library + user-event. Ainda não testa transições de status, pois essas ações pertencem às próximas etapas.
