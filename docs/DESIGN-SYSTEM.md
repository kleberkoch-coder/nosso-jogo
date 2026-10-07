# Nosso Jogo — Design System (resumo)

**Status:** versão 2 aprovada em 7 out. 2026 (direção pastel "Equilíbrio" e seletor de tema) e **aplicada no app na `pelada-v12`**.
**Página completa:** https://claude.ai/artifact/1kwHVaqubL8kbgSTSUZg8W. Lá estão:
- cores, tipografia, espaçamentos, raios e tamanhos de toque;
- 16 componentes com prévia nos dois temas;
- as seções Acessibilidade e Como evolui.

**No app:** os tokens são variáveis CSS com o mesmo nome no começo do `index.html` (`--primary`, `--field-border`, `--in-fill`…). O tema escuro vale para `prefers-color-scheme: dark` (sem `data-theme="light"`) e para `[data-theme="dark"]`. `--pitch-2` continua só na página de apresentação (faixa de esportes e marca).

## Identidade
Campo e colete em tons suaves:
- **Verde-gramado** (`pitch`): só no cabeçalho, no placar e na página de apresentação, com `chalk` por cima.
- **Pastel com texto escuro** no resto:
  - botão principal menta (`primary` + `on-primary`);
  - botão do colete limão suave (`bib` + `bib-ink`);
  - confirmação em menta e alerta em coral.
- **Tipos:** Barlow Condensed nos títulos, números, placar, abas e siglas; Figtree no texto.
- **Borda, não sombra.**

## Cores (claro / escuro)
| Token | Claro | Escuro | Uso |
|---|---|---|---|
| bg | #F4F7F2 | #101714 | Fundo da página |
| surface | #FFFFFF | #18211C | Cartões, janelas, campos |
| surface-2 | #EEF4EC | #1E2923 | Destaque leve, selecionado |
| ink | #1E2A24 | #E6EEE9 | Texto principal |
| muted | #5D6B63 | #9AABA1 | Texto de apoio |
| line | #E1E8E2 | #2A3730 | Divisórias e bordas de cartão |
| field-border | #7B8A81 | #66786D | Borda de campos e botões (3:1) |
| brand | #3E8E66 | #A8DDBB | Foco, aba ativa, progresso, opção selecionada |
| pitch | #1F5A40 | #173A2A | Cabeçalho, placar, theme-color |
| chalk | #F4F8F2 | #E6F2EA | Texto sobre pitch |
| primary / on-primary | #CDEBD7 / #14482F | #A8DDBB / #0F2E1E | Botão principal, seletor ativo |
| bib / bib-ink | #E4F39B / #2D3A06 | #DDEFA0 / #26300A | Ação de destaque (Sortear, pontuar) |
| in | #1C6A41 | #8FD6AA | Vai, entrada, ativo (texto e borda) |
| in-soft | #DDF2E4 | #1F3A2B | Fundo do chip Ativo |
| in-fill / on-in | #BFE6CC / #0F3D26 | #A8DDBB / #0F2E1E | Vou marcado |
| out | #A8361F | #F2A08F | Não vai, despesa, excluir, erro |
| out-soft | #FCE3DD | #3D2420 | Fundo do chip Inativo e dos alertas |
| out-fill / on-out | #F8D2C9 / #6E2414 | #F4B5A7 / #3A140C | Não vou marcado |
| level-ink | #865C00 | #F2C877 | Nota de 1 a 10 |
| gold | #B07F0E | #E2B54A | Estrelas e fundo da nota |

Fixos nos dois temas: `key-bg` #FCE9C9, `key-border` #EDCB8E, `key-ink` #7A4B07 (posição-chave) e `net-bar` #7A4B07 (faixa Sem internet).

Times em pastel, sempre com o nome da cor: laranja #F4B183, azul #9DBBF0, amarelo #F5DC7E, vermelho #EFA3A3, roxo #C3A8EE, branco #E3E6E1 (com borda), verde #9ED3B1, preto #4A4A4A. Os emojis dos textos de WhatsApp (🟧 🟦…) não mudam.

## Seletor de tema (como ficou no app)
- **Opções:** 🌓 Automático (padrão, segue o celular), ☀️ Claro e 🌙 Escuro.
- **Onde aparece:**
  - chip no cabeçalho de todas as telas (`#themeBtn`), inclusive link público, votação, login e convite;
  - botão de ícone na barra da página de apresentação;
  - painel "Aparência" na aba Grupo.
- **Comportamento:**
  - salvo em `localStorage` (`nj-tema`) e aplicado antes de desenhar a página;
  - o menu abre logo abaixo do botão, com opções de 44px;
  - fecha ao escolher, com Esc ou ao tocar fora, e o toque de fechar não aciona o que está embaixo;
  - setas do teclado navegam entre as opções;
  - a cor do navegador (`theme-color`) acompanha o `pitch` do tema em uso.
- **Página de apresentação no celular:** até 440px de largura, o "Entrar" do topo some (o botão "Já tenho conta" fica logo abaixo); até 400px, o botão vira "Criar conta".

## Regras rápidas
- **Botões:**
  - um `primary` por área;
  - `bib` só para a ação que o organizador veio fazer (Sortear, pontuar, Criar conta);
  - texto com verbo no infinitivo e maiúscula só no começo.
- **Estados nunca só pela cor:** "✓ Vou" e "✕ Não vou" com borda, sinais + e −, status com palavra.
- **Bordas:** `field-border` em campos e botões; `line` só em divisórias.
- **Tamanhos de toque:**
  - 44px (`touch-min`, classe `mk lg`) para Vou e Não vou no link público, opções do seletor de tema e pontuação;
  - 36px (`touch-compact`) para botões pequenos.
- **Loading** em todo botão que grava, cria, exclui, abre ou faz login. Cursor no primeiro campo; Enter envia.
- **Valores novos** entram primeiro no Design System, com contraste medido nos dois temas.

## Testes da v12 (modo demonstração, celular de 390px)
31 verificações automáticas passaram, cobrindo:
- tema: menu, Esc, toque fora, persistência e cor do navegador;
- cadastro com cursor no e-mail e Enter;
- criar grupo;
- elenco de exemplo;
- presença e sorteio;
- placar com o aviso "Tempo esgotado";
- ranking, caixa e votação;
- aba Grupo;
- link público com 44px e ✓ / ✕;
- contraste do texto na Rodada (claro e escuro) e no link público.

## Manutenção
O agente de UX/UI (tarefa agendada às segundas, 10h52) confere o app contra este sistema e abre cartões no épico **KAN-68 "Melhorias de UX/UI"** do Jira, com a etiqueta `ux-agente`.
