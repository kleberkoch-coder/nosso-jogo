# Nosso Jogo — Design System (resumo)

**Status:** versão 2 aprovada em 7 out. 2026 (direção pastel "Equilíbrio" e seletor de tema) e **aplicada no app na `pelada-v12`**.
**Página completa:** https://claude.ai/artifact/1kwHVaqubL8kbgSTSUZg8W. Lá estão:
- cores, tipografia, espaçamentos, raios e tamanhos de toque;
- 16 componentes com prévia nos dois temas;
- as seções Acessibilidade e Como evolui.

**No app:** os tokens são variáveis CSS com o mesmo nome no começo de `src/estilos/app.css` (no app montado, ficam no `<style>` do `index.html`) (`--primary`, `--field-border`, `--in-fill`…). O tema escuro vale para `prefers-color-scheme: dark` (sem `data-theme="light"`) e para `[data-theme="dark"]`. `--pitch-2` continua só na página de apresentação (faixa de esportes e marca).

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
- **Página de apresentação no celular** (pelada-v27, KAN-136): Entrar, Criar conta e o tema ficam sempre no topo. Até 440px os botões ficam compactos; até 360px o nome ao lado do logo some.

## Regras rápidas
- **Botões:**
  - um `primary` por área;
  - `bib` só para a ação que o organizador veio fazer (Sortear, pontuar, Criar conta);
  - texto com verbo no infinitivo e maiúscula só no começo.
- **Estados nunca só pela cor:** "✓ Vou" e "✕ Não vou" com borda, sinais + e −, status com palavra.
- **Bordas:** `field-border` em campos e botões; `line` só em divisórias.
- **Tamanhos de toque:**
  - 44px (`touch-min`, classe `mk lg`) para Vou e Não vou no link público, opções do seletor de tema, opções do seletor segmentado (`seg`), pontuação, linhas da lista de jogadores do sorteio e opções das janelas (`opt`);
  - 36px (`touch-compact`) para botões pequenos, de altura **e** de largura (⇄, ✕), e para os chips do cabeçalho.
- **Loading** em todo botão que grava, cria, exclui, abre ou faz login. Cursor no primeiro campo; **Enter envia em toda janela** (pelada-v29, KAN-74): Enter num campo de texto aciona o botão principal do rodapé (`primary` ou `bib`), e o teclado do celular mostra "Concluir". Ficam de fora a área de texto, as listas de escolha e as caixas de marcar.

## Componentes (pelada-v31 a v52)
Registrados na pelada-v43 (KAN-152); os da v44 a v47 entraram na versão de cada um. Desde a v43, os componentes reaproveitáveis ficam em `src/ui/componentes.tsx` (TypeScript + Preact); tela nova ou migrada usa estes, não HTML montado à mão.

- **Botão** (`Botao`): classes `btn`, `primary`, `bib`, `ghost`, `perigo`, `sm`. Todo botão que grava mostra carregando (`busy`: texto some, girador no centro, largura mantida) e não aceita segundo toque. Desabilitado com motivo: o texto diz o que falta ("Faltam 2 para sortear"), nunca só cinza.
- **Pergunta de descarte** (KAN-140): janela de formulário com algo preenchido não fecha ao tocar fora nem com Esc; pergunta "Descartar o que você preencheu?" com "Continuar editando" (`btn`, com foco) e "Descartar" (`btn perigo`). Formulário vazio ou sem mudança fecha direto.
- **Texto cortado** (`TextoCortado`, atributo `data-corta`; KAN-144, KAN-146): texto longo (local, subtítulo) numa linha só com "…". Quando corta, ganha sublinhado pontilhado; passar o mouse mostra o texto inteiro (`title`) e tocar abre ou fecha (`role="button"`, `aria-expanded`, Enter e espaço funcionam). Nunca cria rolagem lateral.
- **Como chegar** (`ComoChegar`, classe `chip-mapa`; KAN-141): rótulo "Como chegar:" em `muted` e dois chips de 36px, "Google Maps" e "Waze", borda `field-border`, fundo `surface`. Abrem em nova aba a busca pelo texto do local (sem custo de API). Só aparecem quando há local.
- **Campo de horário** (KAN-151): hora (00–23) e minutos (00–59) em dois campos de 52px com 44px de altura, números tabulares, separados por ":" em `muted`. Setas ▲▼ (`hseta`, 44 × 36px, cor `brand`) acima e abaixo de cada campo; segurar repete. Aceita digitar qualquer minuto (10:03). Término é opcional ("—" até escolher) e começa no horário de início. Nunca o relógio do celular. Nos dias fixos do grupo, cada horário tem o rótulo em cima (classe `hrot`, 12px, `muted`, negrito): "Início" e "Término (opcional)" (KAN-166).
- **Seletor segmentado com contagem** (`Segmentado`, classe `seg seg-filtro`; KAN-71): opções de 44px com o rótulo e a contagem embaixo; a escolhida usa `primary` e `aria-pressed`.
- **Barra de ação fixa** (classe `acao-fixa`): ver pelada-v29.
- **Ficha de dados** (classe `ficha`; KAN-150): lista de rótulo e valor (`dl`). Rótulo em `muted`, negrito. No computador, duas colunas; até 520px, o rótulo fica inteiro em cima do valor.
- **Painel do link permanente** (KAN-150): título "Link permanente", uma linha de ajuda em `muted` e os botões "Mandar no WhatsApp" (`primary sm`) e "Copiar link" (`sm`). Não repete dia, hora nem local, que ficam no cartão da rodada.
- **Login com Google** (KAN-142): botão "Continuar com o Google" em `btn` na largura toda, com o "G" colorido oficial, acima do divisor "ou com e-mail e senha". Se a aba não bater (criar conta com Google que já existe, ou o contrário), entra mesmo assim e avisa num aviso flutuante.
- **Regras da senha** (KAN-10, classe `pwr`): lista em duas colunas, 13px, em `muted`, com "○" para o que falta e "✓" em `in` para o que já foi cumprido: 8 caracteres, maiúscula, minúscula, número e caractere especial.
- **Campo de telefone** (KAN-156; com país desde a KAN-162, classes `campo-tel` e `tel-linha`):
  - O rótulo é "Telefone / WhatsApp". Na mesma linha ficam o combo do país, com 118px e 44px de altura, e o campo do número, que ocupa o resto.
  - O combo mostra a bandeira e o código primeiro ("🇧🇷 +55 Brasil"), porque o nome do país corta em telas estreitas. No Windows, a bandeira aparece como as duas letras (BR).
  - A última opção é "Outro país (digite + e o código)". O combo já vem com o país do grupo; ao editar, volta com o país do número.
  - Exemplo dentro do campo: "(11) 98765-4321" no Brasil; nos outros países, quantos dígitos tem o número ("10 dígitos").
  - Dica embaixo, em `muted` e peso normal (classe `dica`): "Número de outro país? Troque o país ao lado."
  - O número brasileiro aparece como (11) 98765-4321. Nos outros países, o campo mostra só o número e as listas mostram "+351 912345678".
  - Erro: aviso flutuante com o motivo. Fora do Brasil, ele diz quantos dígitos tem o número no país escolhido. O cursor volta ao campo. O e-mail segue a mesma regra, com o exemplo "nome@exemplo.com".
- **País, moeda e fuso do grupo** (KAN-162, classe `reg-campos`): no Novo grupo e no Editar grupo, depois do esporte, vem o título "País, moeda e fuso horário" com três combos em grade. A grade tem uma coluna no celular e até três no computador.
  - O combo "País" mostra "🇧🇷 Brasil", com os nomes vindos do navegador. "Moeda" mostra "Real brasileiro (BRL)". "Fuso horário" mostra a cidade e a diferença ("Manaus (GMT-4)") e só aparece quando o país tem mais de um fuso.
  - Trocar o país troca a moeda e o fuso. Embaixo, uma linha de ajuda em `muted`.
  - Trocar a moeda de um grupo existente abre a confirmação do app: "Trocar a moeda do grupo?".
- **País da conta** (KAN-162):
  - **No cadastro:** campo "Seu país", logo depois da explicação e antes do botão do Google, já preenchido pelo fuso do aparelho. Embaixo, uma dica em `muted`. O cursor continua no e-mail.
  - **No menu da conta** (desde a v48, KAN-166): o item "País e formatos" mostra o país atual à direita e abre uma janela com o combo (cursor nele) e "Salvar". Na v47 era uma linha no fim de Meus grupos, que saiu.
- **Menu da conta** (KAN-166, `ui/menu-conta.ts`, classe `conta-chip`): no canto do cabeçalho, para quem tem conta, um botão redondo de 38px com a inicial do e-mail, no estilo dos chips do topo.
  - Ele abre o mesmo menu flutuante do tema (`theme-menu`): o e-mail em `muted`, cortado com "…" se for longo; "🌐 País e formatos" com o país à direita; uma linha divisória (`menu-sep`); e "↪ Sair".
  - Abre com o foco no primeiro item. Setas, Esc e tocar fora funcionam, e o foco volta ao botão. Escolher um item fecha o menu.
  - O "Sair" não fica mais solto no cabeçalho.
  - Desde a v50 (KAN-169), o menu tem também "Tema", com o ícone e o nome do tema atual à direita ("🌓 Tema · Automático"). Ele abre as opções Automático, Claro e Escuro no mesmo lugar. Com conta, o botão 🌓 sai do cabeçalho; sem conta (link do jogador, login, apresentação), ele continua.
- **Ordenar por** (KAN-168, classe `ordem-jog`): no topo da lista da aba Jogadores, o rótulo "Ordenar por" em `muted`, 13px, ao lado de um combo de 44px de altura (Nome (A–Z), Posição, Nota (maior primeiro), Tipo (mensalistas primeiro), Mais recentes). Só aparece com 2 ou mais jogadores. "Posição" some em esporte sem posição.
- **Seletor de rodada** (`SeletorRodada`, classe `rsel`; KAN-160): lista das próximas rodadas e das últimas 4 (data, hora, "fixo" ou "(cancelada)"). Na aba Rodada vem com "Nova rodada" e "Histórico"; na aba Partida, só a lista, e aparece também quando a rodada escolhida ainda não tem times.
- **Importar jogadores** (`ImportarJogadores`, classes `imp-*`; KAN-159): janela com o campo "Colar da planilha" (cursor nele ao abrir), o botão "Escolher arquivo" (Excel .xlsx ou .csv) e a prévia.
  - **Prévia:** primeiro um resumo ("12 jogadores novos · 1 já está no elenco ou repetido · 2 com aviso"), depois uma linha por jogador. A linha começa com um sinal: "✓" em `in` (entra), "⚠" em `out` (entra, com aviso) ou "↺" em `muted` (fica de fora, com 60% de opacidade). Embaixo vêm os dados reconhecidos (posição · nota · tipo · telefone · e-mail) e o motivo de cada aviso em `out`.
  - A prévia rola dentro da janela (até 45% da altura da tela).
  - O botão principal diz quantos entram ("Importar 12 jogadores") e fica desligado sem nenhum novo. Arquivo que não é planilha mostra o erro em `out`, embaixo do botão de arquivo.
- **A pagar por jogo** (KAN-172; reaproveita `panel`, `plist`, `tag`, `kpis`, `chk` e `money neg`, sem classe nova):
  - **Na ficha do jogador:** o combo "Tipo" ganha "Isento de pagamento". Abaixo, a caixa de marcar "Recebe por jogo" (`chk`). Ao marcar, aparece "Valor por jogo (R$)" com o cursor nele. Embaixo, uma dica em `muted`.
  - **No Caixa:** quando alguém tem jogos a pagar, os números do topo ganham "A pagar" em `out` (`money neg`). Entre os números e as Pendências entra o painel "A pagar", com uma linha de ajuda em `muted` e uma linha por pessoa: nome, "3 jogos" em `tag`, o total em negrito e o botão "Pagar" (`btn sm`, que diz o nome e o valor para o leitor de tela). Sem nada a pagar, o painel e o número somem.
  - **Janela "Pagar Fulano":** texto em `muted` com o valor por jogo, os jogos em `chk` (data de cada um, todos marcados) e "Total pago (R$)", que acompanha as marcas e pode ser editado. Botões "Cancelar" e "Paguei" (`primary`). Paguei grava com Desfazer por 6 s, como o "Recebi".
- **Partida: fim por placar e fila** (KAN-175; sem classe nova):
  - Ao lado de "Minutos" (com a opção "Sem tempo"), o combo "Fim por placar": "Sem limite", depois de 1 a 25. No celular de 360px, os quatro combos ficam em duas linhas.
  - Ao chegar no limite, aparece a faixa "Fim por placar: chegou a 2" no placar, no mesmo estilo do "Tempo esgotado" (`clock-msg`).
  - Abaixo dos combos, a linha "Na espera:" em `muted`, seguida dos times na ordem da fila, cada um com a bolinha da cor (`dot`), separados por "·".
  - Ao lado de "Encerrar e salvar partida", a dica em `muted`: "Sugestão: quem ganha fica e entra quem espera há mais tempo. Troque os times acima se precisar."
- **Editar partida** (KAN-176; sem classe nova): na lista "Partidas desta rodada", cada linha ganha "Editar" (`btn sm`) antes de "Apagar".
  - A janela "Editar partida" tem uma linha de ajuda em `muted` e um painel por time, com a bolinha da cor, o nome e o placar ("Laranja · 1").
  - Cada gol aparece como uma linha com o combo do autor ("Sem autor", os jogadores do time e, no futebol, "(contra)" com os do adversário) e um ✕ (`ghost danger`) para tirar o gol. Valor maior que 1 aparece como `tag` ("+3").
  - Embaixo de cada painel, os botões de ponto do esporte ("+ Gol"; no basquete "+1", "+2", "+3").
  - Rodapé: "Cancelar" e o principal "Salvar 1 × 0", que mostra o placar novo.
- **Escalação da partida** (KAN-177; sem classe nova):
  - **No placar:** embaixo dos botões de ponto de cada lado, o botão "Escalação" (`btn sm`). Quando alguém entrou ou saiu, aparece embaixo a linha "Entrou: Neto · Saiu: Rafa", no estilo dos gols.
  - **Na janela:** título com a bolinha da cor ("Escalação · Laranja"), uma linha de ajuda em `muted` e a lista de quem está na partida. Quem veio de fora tem a `tag` "entrou"; quem saiu, a `tag alt` "saiu". Nos dois casos há um "Desfazer" (`btn sm ghost`).
  - **Para entrar alguém:** um painel com "Quem entra" (agrupado pelo time de origem e "Sem time"), "No lugar de" ("Ninguém (só completar o time)" ou quem está em quadra) e o botão "Confirmar". O rodapé tem "Pronto" (`primary`).
- **Artilharia da rodada** (KAN-178; sem classe nova):
  - Na aba Partida, depois de "Partidas desta rodada", fica o painel "Artilharia da rodada", com "Lançar" (ou "Editar") em `btn sm`. Embaixo, uma linha em `muted`: a ajuda, ou o lançamento já feito ("Marcão 3 · Bruno 1").
  - A janela tem uma ajuda em `muted`; se a rodada já tem partidas com placar, um aviso em `out`. Depois vem uma linha por jogador dos times, com "−" (`btn sm`, desligado no zero), o número em negrito e "+". Para o leitor de tela, os botões dizem "Somar 1 para Marcão" e "Tirar 1 de Marcão". Rodapé: "Cancelar" e "Salvar artilharia" (`primary`).
- **Ainda não responderam** (KAN-64; sem classe nova):
  - Na aba Rodada, logo depois do quadro da rodada, há um `panel` com o título "Ainda não responderam (12)" e o botão "Cobrar no grupo" (`btn sm primary`). Embaixo vêm os nomes em `muted`, separados por vírgula, e um `details` "Cobrar um por um".
  - Aberto, ele mostra uma lista (`plist`): cada nome com "WhatsApp" (`btn sm`, link de 36px, que para o leitor de tela diz "Cobrar Rafa no WhatsApp") ou "sem telefone" em `muted`.
- **Valor fora do padrão** (KAN-161): é a janela de confirmação do app (KAN-128) com o título "Lançar R$ 8.000,00?", o texto "É bem mais que o normal deste grupo. Confira se não sobrou um dígito." e os botões "Corrigir valor" (volta ao campo, com o cursor nele) e "Lançar assim mesmo" (`primary`).
- **Carregando a gestão** (KAN-149): ao abrir a gestão pela primeira vez, a área principal mostra "Carregando…" em `muted`; sem internet, "Não foi possível carregar" com a orientação de recarregar.

## Componentes (pelada-v30)
- **Janela de confirmação** (KAN-128): variação da janela (`dlg`) no lugar do `confirm()` e do `alert()` do navegador.
  - Título em pergunta curta ("Excluir a rodada de seg, 19/10?"), uma linha do que acontece em `muted` e os botões "Cancelar" (`btn`) e o verbo da ação.
  - Ação que apaga: `btn perigo` (fundo `out-fill`, texto `on-out`, borda `out`); ação que não apaga: `primary`. Botões de 44px.
  - Foco em Cancelar; Esc e tocar fora fecham sem fazer nada; o foco volta ao botão que abriu. O botão da ação mostra carregando e a janela só fecha depois de gravar.
  - Por cima de outra janela, o formulário fica guardado e volta ao Cancelar. Aviso de uma linha (no lugar do `alert`) tem só "Entendi".
- **Aviso flutuante com ação** (KAN-129): "Recebido de Bruno: R$ 80,00 · Desfazer". Fica 6 segundos e o tempo para com o dedo em cima. O botão de texto tem 44 × 44px, sublinhado, na cor do texto do aviso (contraste AA nos dois temas), e o aviso tem `role="status"`.

## Componentes (pelada-v29)
- **Barra de ação fixa no rodapé** (KAN-71): só na aba Rodada, enquanto os times não foram sorteados. Fundo `surface`, borda `line` em cima, botão `bib` de 44px na largura toda.
  - Normal: "Sortear times (10)", com a quantidade de confirmados.
  - Desabilitado com motivo: "Faltam 2 para sortear", texto `muted` sobre `surface` (contraste AA).
  - Carregando: o mesmo de todo botão.
  - Depois do sorteio a barra sai e "Sortear de novo" fica no painel dos times, para ninguém sortear outra vez sem querer. A tela rola até os times e o foco vai para o título "Times".
- **Lista de presença com filtros** (KAN-71): uma lista só, com seletor segmentado de 4 opções (Todos · Vão · Não vão · Sem resposta), cada uma com a contagem embaixo. Em "Vão", a lista é numerada na ordem de chegada.
- **Abas** (KAN-72): sombra de continuação (degradê de `surface` para transparente, 24px) do lado em que há mais abas; a aba aberta fica no centro da barra; espaço lateral de 12px.
- **Placar** (KAN-73): botões de pontuação sempre com 44px. Com 4 ou mais pontuações (futebol americano, rugby), viram uma grade de 2 colunas sob cada time. Quando o tempo acaba, o número pisca só 3 vezes (nunca abaixo de 60% de opacidade) e fica parado em `bib`, com o aviso "Tempo esgotado" fixo.
- **Busca de nome no link público** (KAN-127): campo "Procure seu nome" com rótulo visível e 44px, que filtra enquanto digita, sem diferenciar acentos e maiúsculas. Sem resultado, orienta a tocar em "Adicionar meu nome" e leva o texto digitado para a janela. Com a lista aberta, os times ficam recolhidos em "Ver times"; os confirmados viram uma linha "10 confirmados · ver nomes".
- **Valores novos** entram primeiro no Design System, com contraste medido nos dois temas.

## Testes
O roteiro automático (`testes/ROTEIRO-DE-TESTES.md`) confere o Design System em toda versão: tema (menu, Esc, toque fora, persistência e cor do navegador), alvos de toque de 44px e 36px, ✓ / ✕ no link público e contraste do texto (WCAG 2.2 AA) nos dois temas. Na pelada-v13: 49 de 49 verificações passaram.

## Manutenção
O agente de UX/UI (tarefa agendada às segundas, 10h52) confere o app contra este sistema e abre cartões no épico **KAN-68 "Melhorias de UX/UI"** do Jira, com a etiqueta `ux-agente`.
