# Plano de Implementação — Responsividade Total (Aurum)

**Data:** 2026-08-23
**Escopo:** todas as páginas, componentes e fluxos da aplicação
**Stack:** Next.js 16.2.6 (App Router) · React 19.2 · Tailwind CSS 4.1.17 · framer-motion 12 · lucide-react
**Status:** aprovado o padrão de navegação mobile (bottom nav + drawer). Aguardando comando para executar.

---

## 1. Mapa da aplicação

A aplicação é um SPA com **uma única rota** (`/`) e três views internas trocadas por estado.

```
src/app/layout.tsx          → <html>/<body>, fontes, metadata
src/app/page.tsx            → server component: carrega dados, decide Auth vs App
  ├── components/auth-screen.tsx      (não autenticado / erro de banco)
  └── components/finance-app.tsx      (shell: sidebar + header + main + modal)
        ├── components/overview.tsx          view "Visão geral"
        ├── components/transactions-view.tsx view "Transações"
        ├── components/manage-view.tsx       view "Cadastros"
        ├── components/transaction-modal.tsx modal global
        ├── components/charts.tsx            FlowChart, Donut, ProgressRing, Sparkline, Money, Percent
        ├── components/logo.tsx              AurumEmblem, AurumLogo
        └── lib/icons.tsx                    CategoryIcon, BareIcon
src/app/globals.css         → @theme (tokens), reset, .card, .eyebrow, .field
```

Não há tabelas HTML (`<table>`) em lugar nenhum — as listas são construídas com flex/grid, o que
simplifica a adaptação para cards.

---

## 2. Diagnóstico — problemas encontrados

Cada item abaixo foi verificado diretamente no código-fonte.

### 2.1 Estruturais / globais

| ID | Arquivo | Problema | Impacto |
|----|---------|----------|---------|
| G1 | `src/app/layout.tsx` | Não há `export const viewport`. Sem `viewportFit: "cover"` a app não usa a área sob o notch e `env(safe-area-inset-*)` retorna `0`. | Notch/ilha dinâmica |
| G2 | `src/app/globals.css:29` | `body { overflow-x: clip }` **mascara** overflow em vez de corrigi-lo: o conteúdo é cortado silenciosamente e o bug fica invisível. | Perda de conteúdo |
| G3 | `src/app/globals.css` `@theme` | Nenhum breakpoint declarado — só os defaults do Tailwind 4 (`sm`640 `md`768 `lg`1024 `xl`1280 `2xl`1536). Faltam os degraus de 480px e de ultrawide pedidos no brief. | Sem cobertura 320–480 e >1536 |
| G4 | `src/app/globals.css:100` `.field` | `font-size: 0.875rem` (14px). **Safari iOS dá zoom automático em qualquer input com fonte < 16px ao receber foco** — o viewport escala e a página passa a ter scroll horizontal. Causa raiz mais comum de "quebra" em iPhone. | Todos os formulários |
| G5 | `src/app/globals.css:100` `.field` | Sem `min-height`. Com `padding: .7rem` a altura fica ≈ 40px, abaixo do mínimo de 44px de alvo de toque. | Todos os formulários |
| G6 | `.card` | `border-radius: 22px` e paddings `p-5`/`p-6` fixos em todos os cards. Em 320px, `p-6` consome 48px dos 288px úteis (17%). | Todas as views |
| G7 | Global | Ações reveladas por `opacity-0 group-hover:opacity-100` **nunca aparecem em dispositivos de toque** (não existe hover). | Funcionalidade perdida |
| G8 | Global | Sem `@media (prefers-reduced-motion)`. A app usa framer-motion intensamente. | Acessibilidade |

### 2.2 Shell de navegação — `finance-app.tsx`

| ID | Linha | Problema |
|----|-------|----------|
| N1 | 304 | `<aside className="... hidden ... lg:flex">` — a sidebar só existe a partir de 1024px. Entre 641px e 1023px (iPad retrato, tablets Android) a app perde: painel de resumo do mês, atalhos "Painéis" (Fluxo/Categorias/Orçamentos/Metas), botão de logout e o CTA "Nova transação" grande. |
| N2 | 405–414 | O único CTA de nova transação em mobile é um botão `h-9 w-9` (36px) — abaixo dos 44px mínimos. |
| N3 | 471–486 | Tabs mobile (`lg:hidden`) sem `overflow-x` nem scroll; três tabs com ícone + label em 320px estouram a largura. |
| N4 | 447 | `min-w-[8.5rem]` (136px) no rótulo do mês. Somado às duas setas de 32px e ao padding, o seletor de mês pede ~208px — em 320px sobra quase nada para o resto do header. |
| N5 | 429 | `text-[clamp(1.8rem,3.4vw,2.7rem)]`: em 375px o `3.4vw` = 12.75px, então o clamp trava no piso de 1.8rem (28.8px) — grande demais para a frase de duas linhas em mobile. Em 2560px trava no teto e o header fica desproporcional. |
| N6 | 302 | `max-w-[1500px]` fixo — em telas 2560px+ sobram 500px de vazio de cada lado sem aproveitamento. |
| N7 | 451, 458 | Setas de mês `h-8 w-8` (32px) — abaixo de 44px. |
| N8 | 490 | `main` tem `pb-24`; com bottom nav fixa o conteúdo final ficaria sob a barra. |
| N9 | 439–444 | Links CSV/PDF são `hidden sm:flex` — indisponíveis em celular. |

### 2.3 `overview.tsx`

| ID | Linha | Problema |
|----|-------|----------|
| O1 | 347 | `grid-cols-2 ... xl:grid-cols-4` — salto direto de 2 para 4 colunas. Entre 640px e 1280px os KPIs ficam em 2 colunas apertadas em vez de aproveitar a largura. Em 320px, 2 colunas dão ~140px por card para um valor monetário de até `R$ 999.999,99`. |
| O2 | 349 | `rounded-[22px]` e `p-5` fixos no card de saldo. |
| O3 | 359 | `text-[clamp(1.8rem,2.5vw,2.3rem)]` no saldo: piso de 28.8px dentro de um card de ~140px em mobile → `Money` (valor animado) transborda. |
| O4 | 555 | `w-[74px]` fixo na coluna de valor da legenda do donut. Com `R$ 12.345,67` o texto é cortado. |
| O5 | 538 | `Donut size={196}` com `shrink-0` — em 320px o card tem 288 − 48 (p-6) = 240px úteis; cabe, mas sem folga, e o valor central (`text-[26px]`) transborda com valores de 6 dígitos. |
| O6 | 648 | Botão de editar orçamento: `opacity-0 group-hover:opacity-100` → **inacessível em touch**. |
| O7 | 706 | `pl-[76px]` fixo na gaveta de aporte da meta. Em 360px sobram ~200px para 3 botões de valor + input + botão de confirmar. Estoura. |
| O8 | 579 | `max-h-[408px]` fixo na lista de orçamentos, com máscara de gradiente — em telas baixas (paisagem em celular) ocupa a tela inteira. |
| O9 | 513, 567 | `xl:grid-cols-[1.6fr_1fr]` e `xl:grid-cols-3` — sem degraus intermediários; em 1024px (laptop pequeno / iPad paisagem) tudo empilha em coluna única. |
| O10 | 729 | Botão de confirmar aporte `h-[30px] w-[30px]` — 30px, bem abaixo de 44px. |
| O11 | 313 | Banner de importação: `flex-wrap` + `justify-between`; em mobile o botão salta para a linha de baixo alinhado à esquerda, sem largura total. |

### 2.4 `transactions-view.tsx`

| ID | Linha | Problema |
|----|-------|----------|
| T1 | 433–457 | **Editar e Excluir em `opacity-0 group-hover:opacity-100`.** Em celular é impossível excluir uma transação. Bug funcional, não só visual. |
| T2 | 191–231 | Strip de resumo: `flex-wrap` com divisores `<div className="h-8 w-px bg-line" />`. Ao quebrar linha os divisores ficam órfãos no início/fim das linhas. 5 blocos de dados sem grid. |
| T3 | 269–315 | Filtros: `.field` tem `width: 100%`; dentro de um `flex-wrap` cada `<select>` reivindica a linha inteira — inclusive no desktop. Layout não intencional em **todas** as larguras. |
| T4 | 273 | `min-w-[200px]` na busca combinado com o item anterior. |
| T5 | 236 | Tabs de status em `flex-wrap` sem scroll horizontal; 4 tabs com badge em 320px quebram em duas linhas desalinhadas. |
| T6 | 362, 380 | Cabeçalho de dia e linhas com `px-6` fixo — 48px de 288px úteis em 320px. |
| T7 | 380–470 | A linha da transação tem 5 colunas flex (checkbox, ícone 37px, texto, ações, valor) numa só linha. Em 320px o texto útil fica com ~90px. |
| T8 | 391 | Checkbox de pago `h-6 w-6` (24px) — muito abaixo de 44px, e é o controle mais usado da tela. |
| T9 | 436, 447 | Ações `h-7 w-7` (28px). |
| T10 | 349 | `max-w-[260px]` no texto do estado vazio. |
| T11 | 480–497 | Paginação: botões `py-2` ≈ 33px de altura. |

### 2.5 `manage-view.tsx`

| ID | Linha | Problema |
|----|-------|----------|
| M1 | 498 | `grid gap-2 md:grid-cols-[1fr_140px_70px_auto]` — só divide a partir de 768px. Entre 640 e 767px tudo empilha desnecessariamente; e a coluna de `70px` para o seletor de cor é frágil. |
| M2 | 516 | `className="field h-[45px] !p-1.5"` — altura fixa em px no `input[type=color]`. |
| M3 | 555, 589 | `sm:grid-cols-[1fr_150px_auto]` — em 640px exato, três colunas com `150px` no meio deixam ~200px para o primeiro campo. Falta degrau `sm:grid-cols-2 lg:grid-cols-[...]`. |
| M4 | 366–372 | Código de pareamento `/conectar XXXXXX` em `font-mono text-base` dentro de `flex-wrap` sem `break-all`. |
| M5 | 417 | `sm:grid-cols-3` para os 3 cards de recursos do Telegram — em 640px cada card fica com ~190px para 3 linhas de texto. |
| M6 | 550 | `xl:grid-cols-2` para Orçamentos + Metas — sem degrau em `lg`. |
| M7 | 574, 610 | Linhas de orçamento/meta: `flex` com `ml-auto mr-3`; nomes longos + valor + lixeira estouram em 320px (o `span` do nome não tem `truncate` no caso de orçamentos). |
| M8 | 255, 492, 549… | `p-6` fixo em todas as `section.card`. |

### 2.6 `transaction-modal.tsx`

| ID | Linha | Problema |
|----|-------|----------|
| D1 | 114 | `max-h-[92dvh]` sem `padding-bottom` de safe-area; com teclado virtual aberto no iOS o botão de submit fica sob o teclado. |
| D2 | 98 | `p-4` no wrapper e `items-end sm:items-center` — o bottom-sheet mobile fica com margem lateral e cantos arredondados embaixo, desperdiçando largura. |
| D3 | 193 | `grid max-h-[188px] grid-cols-3` — altura fixa em px na grade de categorias; em telas baixas em paisagem consome a tela toda, e em telas grandes desperdiça espaço com só 3 colunas. |
| D4 | 168 | Input de valor `text-[34px]` fixo — com `R$ 1.234.567,89` transborda em 320px. |
| D5 | 229 | `grid-cols-1 sm:grid-cols-2` para os toggles — correto, mas os cards têm `p-3.5` fixo. |
| D6 | 286 | `grid-cols-2` fixo para Recorrência + Parcelas; em 320px cada `<select>` fica com ~120px para "Mensal por 12 meses". |
| D7 | 302–330 | Botão de submit rola junto com o conteúdo — em modal longo o usuário precisa rolar até o fim. |
| D8 | todos os inputs | Herdam `.field` com 14px → zoom do iOS (ver G4). |

### 2.7 `charts.tsx`

| ID | Linha | Problema |
|----|-------|----------|
| C1 | 530 (`overview`) | `FlowChart height={292}` fixo — em 320px de largura o gráfico fica com proporção quase quadrada e os rótulos se sobrepõem. |
| C2 | 105 | `pad = { l: 46, r: 14, t: 20, b: 30 }` — 60px de padding horizontal fixo. Em 260px de largura útil sobram 200px para 6 pontos. |
| C3 | 129–136, 260–261 | Tooltip acionado **só** por `onMouseMove`/`onMouseLeave`. **Sem qualquer interação em touch** — o gráfico é inerte no celular. |
| C4 | 269–277 | Tooltip com `width: 160` posicionado por `left` calculado, sem clamp ao container. Em larguras pequenas vaza para fora do card (mascarado pelo `overflow-x: clip` do body). |
| C5 | 238–253 | 6 rótulos de mês em `fontSize 10.5` — colidem abaixo de ~360px de largura de gráfico. |
| C6 | 322–346 | `Donut` recebe `size` em px e usa `shrink-0` com `width/height` inline — não é fluido. |
| C7 | 401–419 | `ProgressRing size={84}` / `size={62}` fixos. |
| C8 | 143, 344, 418, 474 | `<svg>` com `width`/`height` em atributo — funciona, mas impede escala por CSS. |

### 2.8 `auth-screen.tsx` / `logo.tsx`

| ID | Linha | Problema |
|----|-------|----------|
| A1 | 37 | `p-7 sm:p-9` — em 320px, `p-7` (28px de cada lado) deixa 232px úteis. |
| A2 | 43 | `text-3xl` fixo no título. |
| A3 | inputs | `.field` 14px → zoom do iOS. |
| A4 | 70 | Botão `py-3.5` ≈ 48px — ok; único alvo já conforme. |
| L1 | `logo.tsx` | `AurumEmblem` usa `stop-color`/`stroke-width` (atributos HTML) em vez de `stopColor`/`strokeWidth` (props React). React 19 ainda renderiza, mas emite warning; e o `<svg>` usa `width`/`height` em px sem `max-width:100%`. |

---

## 3. Design da solução

### 3.1 Sistema de breakpoints

Declarados explicitamente no `@theme` de `globals.css` (Tailwind 4 gera as variantes a partir dos tokens `--breakpoint-*`):

| Token | Largura | Alvo |
|-------|---------|------|
| *(base)* | 0–479 | smartphones pequenos (320, 360, 375, 390) |
| `xs` | 480px | **novo** — smartphones grandes / phablets |
| `sm` | 640px | default Tailwind — mobile landscape |
| `md` | 768px | default — tablets retrato |
| `lg` | 1024px | default — tablets paisagem / notebooks |
| `xl` | 1280px | default — desktop |
| `2xl` | 1536px | default — desktop grande |
| `3xl` | 1800px | **novo** — ultrawide |

Regra de trabalho: **mobile-first**. Toda classe sem prefixo descreve o estado em 320px; os prefixos só adicionam.

### 3.2 Fundação — `globals.css` + `layout.tsx`

**`layout.tsx`** ganha:

```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",     // habilita env(safe-area-inset-*)
  themeColor: "#060807",
};
```

O `<body>` recebe `overscroll-behavior-y: none` para evitar bounce sob a bottom nav.

**`globals.css`** ganha:

1. Tokens `--breakpoint-xs: 480px` e `--breakpoint-3xl: 1800px` no `@theme`.
2. `.field` reescrito:
   ```css
   .field {
     width: 100%;
     min-height: 44px;
     font-size: 16px;          /* impede o zoom automático do Safari iOS */
     padding: 0.65rem 0.9rem;
   }
   @media (min-width: 640px) { .field { font-size: 0.875rem; } }
   ```
3. `.card` com geometria fluida:
   ```css
   .card { border-radius: clamp(16px, 4vw, 22px); }
   ```
   e utilitário `.card-pad { padding: clamp(1rem, 3.2vw, 1.5rem); }` que substitui os `p-5`/`p-6` fixos.
4. Utilitário `.tap { min-height: 44px; min-width: 44px; }` para alvos de toque.
5. Neutralização global das ações hover-only:
   ```css
   @media (hover: none), (pointer: coarse) {
     .hover-reveal { opacity: 1 !important; }
   }
   ```
   Cada bloco hoje marcado com `opacity-0 group-hover:opacity-100` ganha a classe `hover-reveal`
   e passa a usar `(hover:hover)` como condição — em touch fica sempre visível.
6. `@media (prefers-reduced-motion: reduce)` zerando transições e durações.
7. Variáveis de safe-area (`--safe-t/-r/-b/-l`) derivadas de `env()`.
8. `overflow-x: clip` mantido no `body` **apenas como rede de segurança**; as causas raiz são
   corrigidas uma a uma (seção 4) e a ausência de overflow é verificada por script (seção 5).

### 3.3 Shell de navegação — decisão aprovada

Padrão escolhido: **bottom nav fixa + drawer lateral**.

```
< 1024px                              ≥ 1024px
┌──────────────────────────┐          ┌────────┬──────────────────┐
│ ☰   aurum.     ‹ ago ›   │  header  │ side   │ header           │
├──────────────────────────┤          │ bar    ├──────────────────┤
│                          │          │        │                  │
│      conteúdo            │          │ nav    │   conteúdo       │
│                    ╭───╮ │          │ painéis│                  │
│                    │ + │ │  FAB     │ resumo │                  │
├──────────────────────────┤          │ + CTA  │                  │
│ ▣ Visão  ⇄ Trans.  ⚙ Cad.│  bottom  └────────┴──────────────────┘
└──────────────────────────┘  nav
```

Novo arquivo **`src/components/mobile-nav.tsx`** exportando dois componentes:

- **`BottomNav`** — `fixed inset-x-0 bottom-0 z-40 lg:hidden`, fundo `bg-ink/92 backdrop-blur-xl`,
  `border-t border-line`, `padding-bottom: env(safe-area-inset-bottom)`. Três alvos de 56px de
  altura (ícone + label) + FAB de 56px sobreposto acima da barra, alinhado à direita.
- **`NavDrawer`** — painel deslizante da esquerda (framer-motion `x: -100% → 0`), backdrop com
  blur, `lg:hidden`. Conteúdo: atalhos "Painéis" (Fluxo/Categorias/Orçamentos/Metas), o painel
  de resumo do mês (hoje exclusivo do desktop), export CSV/PDF, identificação do usuário e sair.
  Fecha com Esc, clique no backdrop e ao navegar. Trava o scroll do body enquanto aberto e
  devolve o foco ao botão hamburger ao fechar.

Alterações em `finance-app.tsx`:

- Estado novo `drawerOpen`.
- Header mobile passa a ser: hamburger (44px) · `AurumLogo` compacto · seletor de mês compacto.
  As tabs `lg:hidden` são **removidas** (substituídas pela bottom nav) e o botão `h-9 w-9` some
  (substituído pelo FAB).
- Seletor de mês: `min-w-[8.5rem]` → `min-w-0 flex-1 xs:flex-none xs:min-w-[8.5rem]`, com rótulo
  abreviado (`shortMonthLabel`) abaixo de `xs` e completo acima. Setas passam a `h-11 w-11`.
- `h1`: `clamp(1.8rem,3.4vw,2.7rem)` → `clamp(1.5rem, 5.2vw, 2.7rem)`.
- Container: `max-w-[1500px]` → `max-w-[1500px] 3xl:max-w-[1760px]`.
- `main`: `pb-24` → `pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-24`.
- Padding horizontal: `px-4 sm:px-7` → `px-3 xs:px-4 sm:px-6 lg:px-7`.
- Sidebar: `w-60` → `lg:w-56 xl:w-60 2xl:w-64`.

### 3.4 Estratégia por componente

Resumo das transformações (detalhamento executável na seção 4):

- **Listas densas → cards em mobile.** A linha de transação (`transactions-view`) passa a um
  layout de duas linhas abaixo de `sm`: linha 1 = checkbox + ícone + descrição + valor;
  linha 2 = categoria/badges + ações. Acima de `sm` mantém a linha única atual (design base preservado).
- **Ações sempre alcançáveis.** Todo `group-hover:opacity-100` recebe `hover-reveal` e a
  condição vira `(hover:hover)`.
- **Strips de métricas → grid.** Divisores `w-px` soltos são substituídos por bordas do próprio
  grid (`divide-x` em `sm+`, `border-t` entre linhas em mobile).
- **Gráficos fluidos.** Altura e paddings do `FlowChart` derivados da largura já medida pelo
  `useMeasure`; `Donut` com `aspect-ratio: 1` e `max-width`; `ProgressRing` com tamanho por breakpoint.
- **Modal → bottom-sheet.** Colado ao rodapé, largura total, cantos superiores arredondados,
  submit sticky, `padding-bottom` de safe-area.
- **Ultrawide.** `3xl:` amplia o container e adiciona uma coluna aos grids de cards, evitando
  linhas de card excessivamente largas.

---

## 4. Plano de execução — fases

Cada fase é independente e verificável. Ordem escolhida para que a fundação (F1) resolva de uma
vez os problemas globais antes das correções pontuais.

### Fase 1 — Fundação (resolve G1–G8, D8, A3)

| Arquivo | Mudanças |
|---------|----------|
| `src/app/layout.tsx` | Adicionar `export const viewport` com `viewportFit: "cover"` e `themeColor`. `overscroll-behavior-y: none` no body. |
| `src/app/globals.css` | Tokens `--breakpoint-xs`/`--breakpoint-3xl`; `.field` com `min-height:44px` + `font-size:16px` (<640px); `.card` com `border-radius: clamp()`; novos utilitários `.card-pad`, `.tap`, `.no-scrollbar`, `.hover-reveal`; bloco `@media (hover:none),(pointer:coarse)`; bloco `prefers-reduced-motion`; variáveis de safe-area. |

**Verificação:** `npm run build`; foco em input no iPhone (emulado) não altera a escala do viewport.

### Fase 2 — Shell de navegação (resolve N1–N9)

| Arquivo | Mudanças |
|---------|----------|
| `src/components/mobile-nav.tsx` **(novo)** | `BottomNav` + `NavDrawer` conforme 3.3. |
| `src/components/finance-app.tsx` | Estado `drawerOpen`; header mobile reconstruído; remoção das tabs `lg:hidden`; montagem de `<BottomNav>` e `<NavDrawer>`; seletor de mês responsivo; `h1` com clamp corrigido; container `3xl`; paddings escalonados; `pb` da bottom nav; sidebar com larguras por breakpoint; CSV/PDF movidos para dentro do drawer (além de continuarem no header em `sm+`). |

**Verificação:** navegar entre as 3 views em 320/768/1024/1440; abrir e fechar o drawer; conferir
que nenhum conteúdo fica sob a bottom nav ao rolar até o fim.

### Fase 3 — Overview (resolve O1–O11)

| Alvo | Mudança |
|------|---------|
| KPI grid (l. 347) | `grid-cols-1 xs:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 3xl:grid-cols-4`; card de saldo `col-span-full xs:col-span-2 xl:col-span-1`; taxa de poupança idem. |
| Card de saldo (l. 349) | `rounded-[22px]`→`rounded-[clamp(16px,4vw,22px)]`; `p-5`→`card-pad`; valor `clamp(1.4rem,6vw,2.3rem)`. |
| Banner de importação (l. 313) | Botão `w-full sm:w-auto`; texto com `min-w-0` + `break-words`. |
| Checklist de contas (l. 437) | `p-5 sm:p-6`→`card-pad`; cabeçalho `flex-col gap-3 sm:flex-row`; grid `grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4`. |
| Fluxo + donut (l. 513) | `grid-cols-1 lg:grid-cols-[1.5fr_1fr] xl:grid-cols-[1.6fr_1fr]`. |
| Legenda do donut (l. 555) | `w-[74px]`→`min-w-[64px] shrink-0`; coluna de `%` com `hidden xs:inline`. |
| Lista de orçamentos (l. 579) | `max-h-[408px]`→`max-h-[min(408px,60dvh)]`. |
| Editar orçamento (l. 648) | `opacity-0 group-hover:opacity-100` → `hover-reveal` + `[@media(hover:hover)]:opacity-0`; alvo para `h-11 w-11`. |
| Gaveta de aporte (l. 706) | `pl-[76px]` → `pl-0 sm:pl-[76px]`; botões de valor `flex-1 xs:flex-none`; confirmar `h-[30px] w-[30px]` → `h-11 w-11`. |
| Grid final (l. 567) | `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`; o card "Transações recentes" recebe `md:col-span-2 xl:col-span-1`. |
| Todos os `card p-6` | → `card card-pad`. |

### Fase 4 — Transações (resolve T1–T11)

| Alvo | Mudança |
|------|---------|
| Strip de resumo (l. 191) | `flex-wrap` + `w-px` → `grid grid-cols-2 xs:grid-cols-3 lg:grid-cols-5` com `divide-x divide-line` em `lg+` e `gap`/`border-t` em mobile. Remoção dos 3 divisores órfãos. |
| Tabs de status (l. 236) | `flex-wrap` → `flex overflow-x-auto no-scrollbar snap-x` com `shrink-0` nos itens; altura mínima 44px. |
| Filtros (l. 269) | Wrapper `flex flex-wrap gap-2.5`; cada campo em `<div className="basis-[min(100%,220px)] flex-1">`; `select` com `w-full`; botão "Limpar" `w-full xs:w-auto` e altura 44px; contador "mostrando X de Y" movido para baixo em mobile. |
| Linha da transação (l. 380) | Reestruturada: `flex-wrap` com `w-full sm:w-auto` no bloco de meta+ações abaixo de `sm`, formando duas linhas; `px-6`→`px-3 xs:px-4 sm:px-6`. |
| Checkbox de pago (l. 391) | `h-6 w-6` → `h-6 w-6` visual dentro de um alvo `h-11 w-11` (`grid place-items-center`), preservando o desenho atual. |
| Ações editar/excluir (l. 433) | `opacity-0 group-hover:opacity-100` → `hover-reveal`; alvos `h-9 w-9 sm:h-8 sm:w-8` com área de toque de 44px via `.tap`. |
| Cabeçalho de dia (l. 362) | `px-6` → `px-3 xs:px-4 sm:px-6`. |
| Estado vazio (l. 349) | `max-w-[260px]` → `max-w-[28ch]`. |
| Paginação (l. 480) | Botões com `min-h-11`; wrapper `flex-wrap`. |

### Fase 5 — Cadastros (resolve M1–M8)

| Alvo | Mudança |
|------|---------|
| Form de categoria (l. 498) | `md:grid-cols-[1fr_140px_70px_auto]` → `grid-cols-1 xs:grid-cols-2 lg:grid-cols-[1fr_140px_72px_auto]`; botão `xs:col-span-2 lg:col-span-1`. |
| Input de cor (l. 516) | `h-[45px]` → `h-11 w-full`. |
| Forms de orçamento/meta (l. 555, 589) | `sm:grid-cols-[1fr_150px_auto]` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_150px_auto]`; botão `sm:col-span-2 lg:col-span-1`. |
| Bloco Telegram (l. 366) | Código de pareamento com `break-all` e o contêiner `w-full sm:w-auto`; botões `w-full xs:w-auto`. |
| Cards de recursos (l. 417) | `sm:grid-cols-3` → `grid-cols-1 xs:grid-cols-2 lg:grid-cols-3`. |
| Recorrentes (l. 470) | `sm:grid-cols-2 xl:grid-cols-3` → `grid-cols-1 xs:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4`. |
| Orçamentos + Metas (l. 550) | `xl:grid-cols-2` → `lg:grid-cols-2`. |
| Linhas de lista (l. 574, 610) | `min-w-0 truncate` no nome; valor com `shrink-0`; lixeira com alvo de 44px. |
| Cabeçalho de recorrentes (l. 450) | `flex-wrap` com o bloco de total em `w-full sm:w-auto sm:text-right`. |
| Todas as `section.card p-6` | → `card card-pad`. |

### Fase 6 — Modal (resolve D1–D7)

| Alvo | Mudança |
|------|---------|
| Wrapper (l. 98) | `p-4 sm:items-center` → `p-0 sm:p-4`. |
| Painel (l. 114) | `rounded-t-[26px] sm:rounded-[26px]`; `max-h-[92dvh] sm:max-h-[90dvh]`; `pb-[env(safe-area-inset-bottom)]`; `overscroll-contain`. |
| Valor (l. 168) | `text-[34px]` → `text-[clamp(1.6rem,8vw,2.125rem)]`. |
| Grade de categorias (l. 193) | `max-h-[188px] grid-cols-3` → `max-h-[min(188px,32dvh)] grid-cols-3 xs:grid-cols-4`. |
| Parcelamento (l. 286) | `grid-cols-2` → `grid-cols-1 xs:grid-cols-2`. |
| Submit (l. 302) | `sticky bottom-0` com fundo `bg-panel` e `pt` de fade, em mobile. |
| Toggles (l. 229) | `p-3.5` mantido; alvos já ≥ 44px. |

### Fase 7 — Gráficos (resolve C1–C8)

| Alvo | Mudança |
|------|---------|
| `FlowChart` | Altura derivada da largura medida: `h = width < 420 ? 200 : width < 768 ? 240 : height`. `pad.l = width < 420 ? 32 : 46`. Rótulos do eixo X com `fontSize` reduzido e, abaixo de 360px de largura útil, exibição alternada (1 a cada 2). |
| `FlowChart` tooltip | Adicionar `onTouchStart`/`onTouchMove`/`onTouchEnd` no `<rect>` de captura (extraindo a coordenada de `touches[0].clientX`); posição `left` clampada a `[8, w - tooltipW - 8]`; largura `min(160px, 60%)`. |
| `Donut` | Contêiner `w-full max-w-[var(--donut)] aspect-square` em vez de `width/height` inline; `<svg>` com `width="100%" height="100%"` e `viewBox="0 0 200 200"` (já existe); valor central `text-[clamp(1.05rem,4.6vw,1.625rem)]`. |
| `ProgressRing` | `size` passa a aceitar valor por breakpoint via prop já existente — chamadas em `overview` usam tamanhos menores abaixo de `xs`. |
| `Sparkline` | Já fluido (usa `useMeasure`); apenas garantir `height` responsivo no card de saldo. |

### Fase 8 — Auth e Logo (resolve A1–A4, L1)

| Alvo | Mudança |
|------|---------|
| `auth-screen.tsx` l. 36 | `px-4 py-12` → `px-4 py-8 sm:py-12`. |
| `auth-screen.tsx` l. 37 | `p-7 sm:p-9` → `card-pad sm:p-9`. |
| `auth-screen.tsx` l. 43 | `text-3xl` → `text-[clamp(1.5rem,6vw,1.875rem)]`. |
| `logo.tsx` | Corrigir `stop-color`→`stopColor`, `stroke-width`→`strokeWidth`, `flood-color`→`floodColor`, `flood-opacity`→`floodOpacity`; adicionar `max-width:100%` ao `<svg>`; `AurumLogo` com `min-w-0` e texto `truncate`. |

---

## 5. Validação

### 5.1 Verificações automáticas

```
npm run lint
npm run typecheck
npm run build
```

Todas devem passar sem erro novo. `build` é o portão obrigatório antes de declarar qualquer fase concluída.

### 5.2 Matriz de viewports

Varredura via Playwright com o dev server local, nas 3 views + modal aberto + drawer aberto + tela de auth:

| Categoria | Larguras testadas |
|-----------|-------------------|
| Mobile pequeno | 320, 360, 375, 390 |
| Mobile grande | 414, 430, 480 |
| Tablet | 640, 768, 834 |
| Notebook | 1024, 1280 |
| Desktop | 1440, 1536 |
| Ultrawide | 1920, 2560 |

Alturas: 640 (retrato baixo) e 900. Inclui uma passagem em paisagem (`812×375`) para checar as
`max-h` em `dvh`.

### 5.3 Critérios de aceite (verificados por script no browser)

1. **Zero overflow horizontal:** `document.documentElement.scrollWidth <= window.innerWidth + 1`
   em todas as combinações — medido com `overflow-x: clip` temporariamente desativado, para que a
   rede de segurança não esconda um problema real.
2. **Nenhum elemento vazando:** varredura de `document.querySelectorAll('*')` reportando qualquer
   elemento com `getBoundingClientRect().right > window.innerWidth + 1`.
3. **Alvos de toque:** em viewports ≤ 768px, todo `button`/`a`/`input[type=checkbox]` visível deve
   ter `rect.width >= 44 && rect.height >= 44` (ou área de toque equivalente via `.tap`).
   Lista de exceções conscientes documentada no PR, se houver.
4. **Legibilidade:** nenhum texto renderizado abaixo de 11px computados em ≤ 480px; inputs a 16px
   em ≤ 640px.
5. **Sem regressão funcional:** criar / editar / excluir transação, marcar como paga, importar
   fixos, criar e excluir categoria/orçamento/meta, aporte em meta, trocar de mês, exportar
   CSV/PDF, login e logout — todos exercitados em 375px e em 1440px.
6. **Consistência visual:** capturas comparadas antes/depois em 1440px para confirmar que o
   design de desktop não mudou (o brief pede adaptação, não redesenho).

### 5.4 Registro

Ao final, gravar em `docs/RELATORIO-RESPONSIVIDADE.md` a matriz preenchida, com o resultado de
cada critério por viewport e as capturas de tela relevantes.

---

## 6. Restrições assumidas

- **Nenhuma funcionalidade removida.** Todos os elementos hoje exclusivos do desktop (resumo do
  mês, atalhos de Painéis, CSV/PDF, logout) ganham um lugar no drawer mobile.
- **O design base de desktop permanece.** Paleta, tipografia, cantos, sombras e a composição em
  ≥1280px não mudam; o que muda são os degraus abaixo disso e o comportamento em touch.
- **Sem novas dependências.** Tudo com Tailwind 4, framer-motion e lucide-react já presentes.
- **Sem alteração de API, banco ou lógica de negócio.** As mudanças são de camada de apresentação.
  A única exceção é `charts.tsx`, onde os handlers de toque adicionam interação nova (não a alteram).
- **Performance:** nenhum novo listener de `resize` — o `useMeasure` (ResizeObserver) já existente
  é reaproveitado; a bottom nav e o drawer são estáticos, sem custo por frame.

---

## 7. Ordem sugerida de commits

1. `feat(ui): fundacao responsiva — viewport, breakpoints, tokens de toque e safe-area`
2. `feat(ui): navegacao mobile com bottom nav e drawer lateral`
3. `fix(ui): responsividade da visao geral`
4. `fix(ui): responsividade da lista de transacoes e acoes em touch`
5. `fix(ui): responsividade da tela de cadastros`
6. `fix(ui): modal como bottom-sheet em mobile`
7. `fix(charts): graficos fluidos e interacao por toque`
8. `fix(ui): responsividade da tela de login e correcoes do logo`
9. `docs: relatorio de validacao de responsividade`
