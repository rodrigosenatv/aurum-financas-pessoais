# Design system do Aurum

Guia rápido para manter a interface consistente nos temas claro e escuro e no celular.
Vale para qualquer componente novo em `src/components`.

## Temas

- Três preferências: **Claro**, **Escuro** e **Sistema** (padrão). A escolha fica em
  `localStorage["aurum-theme"]`; "Sistema" remove a chave e passa a seguir o aparelho.
- O tema ativo vive em `<html data-theme="light|dark">`. O script inline de
  `src/lib/theme-script.ts` roda antes da primeira pintura, então não há "flash" do tema errado.
- No cliente, use `useTheme()` (`src/lib/theme.ts`) para ler ou trocar o tema. A troca usa
  View Transitions quando disponível e desliga as transições de cor durante a troca.
- As variantes do Tailwind `dark:` e `light:` seguem o `data-theme` (não só a media query).
- A cor da barra do navegador (`<meta name="theme-color">`) acompanha a escolha.
- iOS com o app instalado: a barra de status é translúcida com texto branco e não muda depois da
  instalação. No tema claro, `.status-scrim` pinta uma faixa escura atrás dela para manter hora e
  bateria legíveis (fora do modo instalado a faixa tem altura zero).

## Tokens de cor

Nunca use hex, `rgba()` ou cores da paleta padrão (`amber-400`, `zinc-…`) em componentes: use os
tokens abaixo. Eles mudam sozinhos com o tema, inclusive em atributos SVG (`stroke="var(--accent)"`).

| Token (Tailwind)  | Uso                                              | Escuro    | Claro     |
| ----------------- | ------------------------------------------------ | --------- | --------- |
| `canvas`          | fundo da página                                  | `#060807` | `#f4f5ef` |
| `surface`         | cards, sheets, painéis                           | `#0b0d0a` | `#ffffff` |
| `raised`          | superfície elevada / item ativo                  | `#14170f` | `#eceee5` |
| `field`           | fundo de campos                                  | translúcido | `#f7f8f3` |
| `fg`              | texto principal                                  | `#eef2e4` | `#14180f` |
| `fg-muted`        | texto secundário                                 | `#9ba190` | `#4f5646` |
| `fg-subtle`       | texto terciário, legendas (≥ 4,5:1 de contraste) | `#7b8270` | `#666d5d` |
| `line` / `line-strong` | bordas e divisórias                         | translúcido | translúcido |
| `accent`          | verde da marca para **texto e ícones** (receitas, destaques) | `#b6f244` | `#4d7c0f` |
| `primary`         | verde-lima de **preenchimento** (botões principais) | `#b6f244` | `#b6f244` |
| `ink`             | texto sobre `primary` e sobre o card de saldo    | `#0a0c03` | `#0b1003` |
| `negative`        | despesas, erros, ações destrutivas               | `#ff6e82` | `#c8283f` |
| `warning`         | pendências, alertas de orçamento                 | `#fbbf24` | `#b45309` |
| `scrim`           | fundo atrás de sheets e diálogos                 | escuro    | escuro translúcido |

Regras práticas:

- Botão principal: `btn btn-primary` (lima com texto `ink`). Nunca `bg-accent` sólido com texto
  escuro — no tema claro o `accent` é verde-escuro.
- Tons translúcidos usam o próprio token: `bg-fg/[0.04]` (hover), `bg-accent/12`, `border-warning/35`.
- Cores de categoria são escolhidas pelo usuário: use `CategoryIcon`, ou a classe `cat-fg` com a
  variável `--cat`, que escurece a cor no tema claro para manter o contraste.
- Sombras: `shadow-glow` (botão lima), `shadow-pop` (sheets, toasts), `shadow-nav`; o `.card` já
  traz a sombra certa para cada tema.

## Componentes base

| Peça | Onde | Para quê |
| ---- | ---- | -------- |
| `.card`, `.card-pad` | `globals.css` | contêiner padrão com padding fluido |
| `.btn` + `btn-primary` / `btn-secondary` / `btn-ghost` / `btn-danger` / `btn-danger-solid` | `globals.css` | botões com 44px de altura mínima |
| `.icon-btn` | `globals.css` | botão só com ícone, 44×44 |
| `.field` | `globals.css` | inputs e selects (16px no celular para o iOS não dar zoom) |
| `.chip`, `.eyebrow` | `globals.css` | selos e rótulos em caixa alta |
| `Sheet` | `components/sheet.tsx` | diálogo: bottom sheet com arrastar no celular, janela centralizada a partir de 640px |
| `useConfirm()` | `components/confirm.tsx` | confirmação de ações destrutivas (substitui `window.confirm`) |
| `useToast()` | `components/toast.tsx` | avisos de sucesso/erro, com ação opcional ("Desfazer") |
| `PaidToggle`, `SwitchRow`, `EmptyState` | `components/ui.tsx` | status pago/pendente, interruptores, estados vazios |
| `ThemeSegmented`, `ThemeQuickToggle` | `components/theme-toggle.tsx` | seletor de aparência |

## Mobile first

- Desenhe primeiro para 320–430px; amplie com `xs` (480), `sm` (640), `md` (768), `lg` (1024,
  quando a sidebar aparece), `xl` (1280), `2xl` (1536) e `3xl` (1800).
- No celular, só a barra superior compacta é fixa. A navegação fica embaixo (Resumo, Transações,
  **+**, Cadastros, Mais), ao alcance do polegar.
- Alvos de toque com pelo menos 44px; textos com pelo menos 11px; valores monetários com
  `tabular-nums` e `whitespace-nowrap`.
- Respeite as áreas seguras do iPhone com `var(--safe-t)` e `var(--safe-b)`.
- Nada importante pode existir só no hover: use `.hover-reveal`, que mostra as ações em telas de toque.

## Padrões de UX

- **Exclusão de transação**: some da lista na hora e mostra "Desfazer" por 6 s; só então chama a API.
  Se a página for fechada antes, a exclusão é enviada com `keepalive`.
- **Erros de API** viram toast e a interface volta ao estado anterior (atualização otimista com rollback).
- **Exclusões de categoria, orçamento e meta** pedem confirmação.
- **Formulários** mostram o que falta ao tentar salvar e levam o foco ao primeiro campo inválido.
- **URL**: `?tab=transactions` ou `?tab=manage` abre a tela correspondente (usado pelos atalhos do
  PWA); `?action=new` abre "Nova transação". A URL é atualizada com `replaceState` só depois de uma
  troca de tela — alterá-la durante a hidratação faz o Next remontar a página.
- **Atalho de teclado**: `N` abre uma nova transação no desktop.
