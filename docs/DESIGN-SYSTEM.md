# Nosso Jogo — Design System (resumo)

**Status:** versão 2 aprovada em 7 out. 2026 (direção pastel "Equilíbrio" e seletor de tema) e **aplicada no app na `pelada-v12`**.
**Página completa:** https://claude.ai/artifact/1kwHVaqubL8kbgSTSUZg8W. Lá estão:
- cores, tipografia, espaçamentos, raios e tamanhos de toque;
- os componentes com prévia nos dois temas (todos os que existem no app; conferido na pelada-v75, KAN-196);
- as seções Acessibilidade e Como evolui.

**No app:** os tokens são variáveis CSS com o mesmo nome no começo de `src/estilos/app.css` (no app montado, ficam no `<style>` do `index.html`; desde a pelada-v82, o estilo que só uma parte sob demanda usa fica em `src/estilos/<parte>.css` e chega com ela, KAN-217) (`--primary`, `--field-border`, `--in-fill`…). O tema escuro vale para `prefers-color-scheme: dark` (sem `data-theme="light"`) e para `[data-theme="dark"]`. `--pitch-2` continua só na página de apresentação (faixa de esportes e marca).

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

Coletes em pastel (`team-*`): laranja #F4B183, azul #9DBBF0, amarelo #F5DC7E, vermelho #EFA3A3, roxo #C3A8EE, branco #E3E6E1 (com borda), verde #9ED3B1, preto #4A4A4A. Desde a v60, o time se chama "Time 1", "Time 2" (em duplas, "Dupla 1") e a cor aparece como o colete, sempre com o texto ("colete laranja"). Os emojis dos textos de WhatsApp (🟧 🟦…) não mudam.

## Seletor de tema (como ficou no app)
- **Opções:** 🌓 Automático (padrão, segue o celular), ☀️ Claro e 🌙 Escuro.
- **Onde aparece:**
  - sem conta (link público, votação, login, cadastro e convite): chip 🌓 no cabeçalho (`#themeBtn`);
  - com conta (desde a v50, KAN-169): no menu da conta, item "🌓 Tema · Automático"; o chip sai do cabeçalho;
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

## Componentes (pelada-v81)
- **Rateio → pessoa de fora do elenco** (KAN-216; `telas/Rateios.tsx`, classes `rat-fora`, `rat-fora-nome`, `rat-tirar`, `rat-add-fora`; os estilos ficam no componente):
  - Na janela, depois do elenco: o subtítulo "De fora do elenco" (`rat-sub`), uma linha de 44px por pessoa com o nome e a `tag` "de fora" (que desce para baixo do nome quando não cabe), o campo do valor (108px) e "✕" (`btn sm ghost danger`, só enquanto não pagou).
  - Embaixo, o campo "Nome (ex.: Primo do Bruno)" (44px, ocupa a linha) e "Adicionar" (`btn sm`); Enter também adiciona, sem fechar a janela.
  - No cartão, na cobrança e nas pendências, o nome com a `tag` "de fora".

## Componentes (pelada-v80)
- **Avaliação de notas** (KAN-214; `telas/PublicoAvaliacao.tsx`, `ui/NotasAvaliacao.tsx`, `ui/AvaliacaoJanela.tsx`; classes `aval-nota`, `aval-aplicar`, `aval-nova`; a tabela do resultado usa a do Quadro do ano, `quadro-rolar`/`quadro-tab`/`q-nome`; os botões em linha usam `rat-acoes`):
  - **Na aba Jogadores** (só com Notas): "Avaliação por link" (`btn sm`) e, ao lado, `small muted` "O time dá nota pelo link; só vocês veem o resultado.".
  - **Link** (sem conta): cartão com o título, a regra em `small muted` ("…Ninguém vê as notas dos outros. Dá para mudar até 05/11.") e "Quem é você?" (combo de 44px). Depois de escolher, um cartão com a escala ("1 · iniciante … 10 · craque…"), a Lista de jogadores com a Posição, o nome e o combo da nota (92px, 44px, "—" e 1 a 10 de meio em meio), o contador "2 de 11 com nota" (`aria-live`) e "Enviar notas"/"Atualizar notas" (`primary`, 44px); enviado, a linha `role="status"` "Notas enviadas. Dá para mudar até 05/11.". Encerrada: Estado vazio com "Esta avaliação terminou em 05/11.".
  - **Janela "Avaliação por link"** (administrador): ajuda, "Nova avaliação" (`primary`), e a lista com o título, `tag` "até 05/11" (ou `tag alt` "encerrada"), "11 avaliados" e os botões `btn sm` Compartilhar link, Minhas notas, Resultado, Encerrar (`ghost`) / Apagar (`ghost danger`).
  - **Nova avaliação:** Título (cursor nele), "Recebe notas até" (data) e "Quem é avaliado (n)" (Caixas de marcar em lista, mensalistas marcados); "Voltar" e "Criar e compartilhar" (`primary`), que já abre o compartilhar.
  - **Resultado:** "4 responderam (1 pelo app): nomes", ajuda, "Usar a mediana" e "Usar a média" (`btn sm`), e a Tabela com rolagem lateral (nome fixo): Atual, Média, Mediana, Notas e "Nova nota" (Caixa de marcar + campo de 76px); rodapé "Voltar" e "Atualizar notas (n)" (`primary`).

## Componentes (pelada-v79)
- **Rateios** (KAN-213; `telas/Rateios.tsx`; classes `rateio`, `rat-nome`, `rat-resumo`, `rat-falta`, `rat-sub`, `rat-pagaram`, `rat-acoes`, `rat-fechados`, `rat-part`, `rat-atalhos`, `rat-linha`, `rat-valor`):
  - **Seção no Caixa**, depois de Pendentes e Do mês: título "Rateios" com "Novo rateio" (`btn sm`) e, sem nenhum aberto, uma linha `small muted` de exemplo. Encerrados numa Seção recolhível "Encerrados (n)" (resumo de 44px).
  - **Cartão** (`panel`): nome (h3) e, se encerrado, `tag` "encerrado"; linha `small` "Entrou R$ 144,28 de R$ 505,00 · **falta R$ 360,72**" (falta em `out`, 700, sem quebrar) "· despesas R$ 505,00"; subtítulo "Falta pagar (5)" (`display` 700 15px; encerrado: "Não pagaram (5)") e a Lista de jogadores com o valor e "Recebi" (`btn sm`); "n pagaram" como Seção recolhível `small`; botões `btn sm` em linha que quebra (8px): "Cobrar no WhatsApp", "Editar" (`ghost`), "Encerrar"/"Reabrir" (`ghost`), "Apagar" (`ghost danger`, só sem pagamentos).
  - **Janela "Novo rateio"/"Editar rateio"**: "Nome" (cursor nele), "Como dividir" (Caixas de marcar em lista com opção única), "Valor total"/"Valor por pessoa", "Quem participa (n)" com os atalhos "Todos os mensalistas" (`btn sm`) e "Limpar" (`btn sm ghost`), e o elenco em linhas de 44px com divisória: Caixa de marcar e, quando marcado, o campo do valor (108px, 44px) à direita. Embaixo, em `muted` e `aria-live`, "7 participantes · soma R$ 505,00" (e "diferente do total de R$ X" se os ajustes mudarem a soma); a Caixa de marcar "Mostrar nas pendências do Caixa" (marcada); rodapé "Cancelar" e "Criar rateio"/"Salvar" (`primary`).
  - **No Lançar**, com Entrada ou Despesa e algum rateio aberto: o combo "Rateio (opcional)".

## Componentes (pelada-v86)
- **Quem votou** (KAN-222; `telas/QuemVotou.tsx`; classes `aud-painel`, `aud-lista`, `aud-linha`, `aud-topo`, `aud-hora`, `aud-votos`, `aud-trocas`, `aud-ver`, `aud-repetido`): auditoria da votação, só para administradores.
  - **Seção recolhível** (`details.panel`, fechada) na aba Votação, abaixo do resultado: "Quem votou (n)" e, ao lado, "Só administradores veem" em `small muted`; resumo de 44px. Dentro, uma ajuda em `small muted`.
  - **Linha por aparelho** (a mais recente primeiro): nome em 700; `tag alt` "votou em 2 aparelhos" (sem quebrar) quando o mesmo nome votou de mais de um aparelho; à direita, data e hora em `small muted`, com "(hora do aparelho)" nas votações antigas; as escolhas por categoria em `small`; "Ver trocas (n)" / "Esconder trocas" (`btn sm ghost`, 44px) com a lista numerada "21:02 · Melhor jogador: Caio" em `small muted`.
  - O que está aberto continua aberto quando chega um voto novo ou o tema muda.

## Componentes (pelada-v84)
- **Sugestões "Já jogou aqui?"** (KAN-218; `ui/SugestoesAvulso.tsx`): o mesmo visual de antes, agora componente. Na janela "Adicionar meu nome" do link, ao digitar 2 letras ou mais: a linha `small muted` "Já jogou aqui? Toque no seu nome:" e até 5 avulsos em `vgrid` de `opt` (sigla da posição em `pos` + nome). Nenhuma classe nova.
- **Cabeçalho, abas, menu do tema e avisos de grupo** (KAN-218): montados como elementos, sem HTML em texto, com as mesmas classes (`chip`, `tab`, `tab-trava`, `theme-menu`, `tm-t`, `hint`, `inbar`, `panel empty auth`). Nada muda no visual.
- **Janelas como componentes** (KAN-218): todas as janelas (`ui/JanelasGestao.tsx`, `ui/JanelasGrupo.tsx`, `ui/JanelasLink.tsx`, `ui/JanelaPonto.tsx`, `ui/JanelaNavegador.tsx`) seguem o mesmo padrão de sempre: título `h3`, ajuda `small muted` logo abaixo (margem -6px), campos `f`, grade de opções `vgrid`/`opt` e rodapé `dlg-f` com Cancelar à esquerda do botão principal. Nenhuma classe nova.
- **Campos das janelas** (`ui/Campos.tsx`, `CampoPosicao` em `ui/componentes.tsx`): Posição (combo), Nota de 1 a 10 (barra `lvlin` com o número ao lado e a escala `lvlscale`), Telefone (`campo-tel`: combo do país + número + dica), Tipo do jogador com "Recebe por jogo" e a linha de afastamento (`afast-linha`). O mesmo visual de antes, agora componentes.
- **Negrito vindo do dicionário** (`ComNegrito`, `ui/componentes.tsx`): o texto marca o nome de um botão com `<b>…</b>` (ex.: "Toque em <b>Instalar app</b>") e ele aparece em negrito, sem montar HTML.

## Componentes (pelada-v78)
- **Quadro do ano** (KAN-212; `telas/QuadroAno.tsx`; classes `quadro-painel`, `quadro-ano`, `quadro-rolar`, `quadro-tab`, `q-nome`, `q-conta`, `q-pago`, `q-btn`, `q-isento`, `q-antes`, `q-futuro`, `q-total`, `quadro-legenda`; utilitário `sr`, texto só para leitor de tela):
  - **Seção recolhível** no fim do Caixa (`details.panel`, fechada): título "Quadro do ano" e, ao lado, "Quem pagou cada mês" em `small muted`; a linha do resumo tem 44px.
  - **Troca de ano:** "‹ 2026 ›" centralizado (`btn sm ghost`; ‹ desligado no primeiro ano com mensalidade, › até o ano seguinte).
  - **Grade** (Tabela com rolagem lateral só dentro dela, borda `line`, cantos de 10px): cabeçalho com os meses curtos em `display` 700 13px maiúsculo, `muted`, e o mês atual em `ink` com sublinhado `brand` de 3px. Primeira coluna fixa à esquerda (`surface`, 112 a 140px, nome 600, cortado com reticências) com a contagem de meses em aberto numa pílula `out-soft`/`out`. Células de 44px de altura e no mínimo 60px de largura: **pago** ✓ em `in` sobre `in-soft`; **em aberto** botão "Recebi" de 44px, contorno e texto em `out`; **afast.** em `muted` 12px; **antes de entrar** "—" em `muted` sobre `surface-2`; **futuro** vazio sobre `surface-2`. Rodapé em 700: "Pagaram" (quantidade) e "Recebido" (valor sem centavos quando redondo).
  - **Legenda** em `small muted` embaixo da grade.

## Componentes (pelada-v77)
- **Ciclo da mensalidade** (KAN-209; `telas/PartidasCaixa.tsx`, `telas/Caixa.tsx`; classes `meses-grade`, `ciclo-linha`, `atraso-tit`):
  - **Partidas e caixa** (janela, agora componente): depois de Mensalidade e Diária, o combo "O mês da mensalidade começa no dia" (1 a 28, 140px) e uma linha em `muted` com a mensalidade de hoje ("Hoje vale a mensalidade de outubro de 2026: 01/10 a 31/10. O mês leva o nome de quando começa."). Ao trocar o dia, aparece "A partir de quando" como Caixas de marcar em lista com opção única: "A partir da próxima (novembro de 2026: 20/11 a 19/12); outubro de 2026 vai até 19/11" (marcada) e "Já na mensalidade atual (…)".
  - **Caixa → Pendentes:** com ciclo (ou quando a mensalidade de hoje é de outro mês), uma linha `small muted` "Mensalidade de janeiro de 2026: 20/01 a 19/02". Depois da lista do mês, o subtítulo **"Em atraso (18)"** (`display` 700, 15px, em `out`) e a lista das mensalidades em aberto das 6 competências anteriores, cada uma com o mês curto em `tag` ("dez. de 2025"), o valor e "Recebi" (que diz também o mês ao leitor de tela).
  - **Novo lançamento** (janela, agora componente): com "Mensalidade", a lista "Mensalidade de qual mês" em duas colunas (`meses-grade`: Caixas de marcar de 44px, divisória embaixo de cada uma), de 6 meses antes a 3 depois, com a atual marcada e indicada ("jan. de 2026 · atual"). O valor acompanha os meses marcados, e com 2 ou mais aparece em `muted` "Vira 2 lançamentos de R$ 85,00, um por mês."

## Componentes (pelada-v76)
- **Afastamento** (KAN-208; `ui/AfastamentoJanela.tsx`, classes `afast-linha`, `afast-tag`, `afast-aviso`, `af-meses`):
  - **Na ficha do jogador**, acima do rodapé: uma linha com a situação em `small` ("Afastado set.–nov. · Lesão"; sem afastamento agora, o último em `muted`) e o botão `btn sm` "Afastar" ou "Ver afastamento".
  - **Janela "Afastar Alemão"** (ou "Afastamento de Alemão"): ajuda em `muted`, "Motivo" (combo, com o cursor nele), "Observação (opcional)", "A partir de" e "Até" (combos de mês, lado a lado; até 400px, um embaixo do outro; "Até voltar (sem data)" é a primeira opção do "Até"), "Mensalidade nesse período" como Caixas de marcar em lista com opção única ("Não cobrar nesse período", marcada, e "Cobrar normalmente"; só para quem tem Caixa no Plano A e só para mensalista), a linha "O motivo só aparece para administradores." e, se houver, a Seção recolhível "Afastamentos anteriores". Rodapé: "Apagar" (`ghost danger`, ao editar, com a Janela de confirmação), "Voltou" (ao editar um afastamento valendo), "Cancelar" e "Afastar"/"Salvar" (`primary`).
  - **Na lista do elenco:** depois do nome, a etiqueta `tag alt` "afastado até nov." (ou "afastado", sem data).
  - **Aviso na aba Rodada** (`warn-alt`, `role="status"`), dentro do cartão da rodada: "Alemão está afastado (Lesão) e confirmou presença." com "Voltou" (`btn sm`) e "Manter afastado" (`btn sm ghost`); um por pessoa, separados por 8px.

## Componentes (pelada-v75)
Registrados na pelada-v75 (KAN-196, KAN-194, KAN-195, KAN-131); todos com prévia nos dois temas na página.

- **Cabeçalho** (`top`, `top-in`, `page-title` no `#gname`, `sub` no `#gsub`, chips em `toprow`): fundo `pitch`, nome do grupo em 40px e a linha do esporte e da próxima rodada. Chips à direita: com conta, "⇄ Grupos" e o botão da conta (menu com País e formatos, Tema e Sair); sem conta, o 🌓.
  - **Compacto no celular (até 420px, KAN-194):** nome em 28px numa linha só, com "…"; os chips na mesma linha do nome; cabeçalho de cerca de 80px (meta: até 120px). Tocar no nome cortado mostra o nome inteiro (sublinhado pontilhado, `role="button"`, `aria-expanded`, Enter e espaço). No computador, igual a antes.
- **Cartão da rodada** (`hero-r`, `count`): data e hora em `h2` (24px até 420px); a faixa de horário ("20:00–22:00") nunca se separa (classe `nw`). Na aba Rodada é o primeiro cartão depois do seletor (KAN-194).
- **Tabela do ranking** (`tbl`, `pts`, linha `lead`): colunas #, Jogador, Pts, J, V, E, D, Aprov., a palavra do esporte, Destaques e Bagre. Cabeçalho em `display` 700, 14px, `muted`; nome à esquerda, números à direita; Pts em negrito; o líder com fundo `surface-2`; divisórias `line`. No celular, rola na horizontal dentro do cartão. Embaixo, a regra dos pontos em `small muted`.
- **Nota com escala** (`lvlin`, `lvlscale`; na lista, `lvl-tag`; estrelas antigas, `stars` e `starin`): controle deslizante de 1 a 10 (passo 0,5, cor `brand`, `aria-label="Nota de 1 a 10"`) com o número grande à direita (`display` 800, 28px) e a escala "1 · iniciante" / "10 · craque" em 12px `muted`. Na lista, a nota em `level-ink` sobre `gold` a 16%. Só quem tem a permissão de Notas vê.
- **Mostrar senha** (`pwbox`, `pwver`; KAN-97): botão "Mostrar"/"Ocultar" dentro do campo, à direita, 36px, 13px, 600, fundo transparente (`line` ao passar o mouse); `aria-pressed` e `aria-label` "Mostrar senha". Não tira o cursor do campo.
- **Versão do app** (`versao`; KAN-107): "Nosso Jogo · versão 75" em `small muted`, centralizado, no fim de Meus grupos e da tela de entrar; "versão 75" no rodapé da apresentação.
- **Carregando** (gestão, KAN-149, e internet ruim, KAN-184): ver as linhas da pelada-v31 a v52; agora também na página.
- **Caixas de marcar em lista** (`fieldset.chk-lista` com `chk-linha`; KAN-195): título no `legend` (estilo `lbl`), uma linha de 44px por opção (caixa de 22px em `brand`), divisória `line` entre as linhas; tocar em qualquer ponto da linha marca. Usado na janela **Nova votação** (categorias do catálogo do esporte e "Pode votar em si mesmo").
- **Janela Nova votação** (`telas/Votacao.tsx`, KAN-195): "Rodada" com o mesmo texto do Seletor de rodada (data, hora e "fixo", sem o local), "Título", "O que votar" (Caixas de marcar em lista), "Outra categoria (opcional)" com rótulo visível acima e o exemplo dentro, "Pode votar em si mesmo" e o rodapé "Cancelar" / "Abrir votação".
- **Janela de compartilhar** (`ui/Compartilhar.tsx`, KAN-131): título, a caixa de texto com o rótulo "Mensagem pronta para o WhatsApp" e os botões "Fechar", "Copiar texto" e "Abrir no WhatsApp" (`primary`).
- **Meus grupos** (`grupo-linha`, `abrir-grupo`; KAN-131): o cartão inteiro do grupo abre o grupo; o botão diz "Abrir Pelada de Quinta" ao leitor de tela.
- **Outros nomes de classe em uso** (partes dos componentes acima; sem visual próprio além do descrito):
  - **Placar e partida:** `goals` (gols de cada lado embaixo do placar, 13px), `over` (cronômetro esgotado, em `bib`), `bar` (barra de votos da Votação, em `brand`).
  - **Listas e cartões:** `note` (observação com barra `line` à esquerda, 13px, `muted`), `stack` (cartões empilhados com 14px entre eles), `grid2` (duas colunas no computador), `me-row` (a sua linha no link, em `surface-2`), `via` (na lista de administradores, como a pessoa entrou da última vez: "G Google" ou "✉️ e-mail", em `tag`), `warn-alt` (aviso de lista diferente e respostas mudadas), `linha-local` e `extra` (local cortado com "· jogo fixo" ao lado), `mapa` (linha do Como chegar), `n` (contagem do seletor segmentado), `minpos` (campo do Mínimo para o jogo), `tab-trava` (🔒 na aba), `avisos-plano` (lugar dos avisos do plano).
  - **Janelas e avisos:** `conf` e `conf-txt` (Janela de confirmação), `toast-btn` e `acao` (Aviso flutuante com ação), `bar-net` (faixa Sem internet, `net-bar`), `bar-upd` (barra Nova versão), `demo` (faixa do modo demonstração, `bib`).
  - **Formulários:** `sgrid` (grade de esportes do Novo grupo, com `opt`), `sd` e `sl` (dia e local da linha de dia fixo), `gic` (o "G" do Google), `imp-*` (Importar jogadores).
  - **Estrutura:** `toprow` (linha dos chips do cabeçalho), `chip-ic` (chip só com ícone, 36 × 36px), `auth` (cartão de entrar, até 400px), `foot` (rodapé com links em `muted`), `hero-land` (bloco de abertura centralizado, até 520px), `is-landing` (página de apresentação aberta), `mais-esq` e `mais-dir` (sombra das Abas), `ld` e `ld-*` (Página de apresentação).
- **Página de apresentação** (`ld-*`): barra do topo (`ld-nav`, marca `ld-mark`), topo em `pitch` (`ld-hero`, `ld-eyebrow`, título `hero`, `ld-lead`, `ld-ctas`, `ld-note`, celular ilustrativo `ld-phone`), faixa de esportes (`ld-sports`, `ld-chips`), seções alternadas (`ld-sec`, `ld-h2`): dores (`ld-pains`, `ld-q`), recursos (`ld-feat`, `ld-card`, `ld-ic`), sorteio (`ld-split`, `ld-list`, `ld-demo`), grupos (`ld-groups`, `ld-g`), passos em `bib` (`ld-steps`), perguntas (`ld-faq`), final (`ld-final`) e rodapé (`ld-foot`). Usa os tokens do app; `pitch-2` só aqui.

## Componentes (pelada-v31 a v52)
Registrados na pelada-v43 (KAN-152); os da v44 a v47 entraram na versão de cada um. Desde a v43, os componentes reaproveitáveis ficam em `src/ui/componentes.tsx` (TypeScript + Preact); tela nova ou migrada usa estes, não HTML montado à mão.

- **Botão** (`Botao`): classes `btn`, `primary`, `bib`, `ghost`, `perigo`, `sm`. Todo botão que grava mostra carregando (`busy`: texto some, girador no centro, largura mantida) e não aceita segundo toque. Desabilitado com motivo: o texto diz o que falta ("Faltam 2 para sortear"), nunca só cinza.
- **Pergunta de descarte** (KAN-140): janela de formulário com algo preenchido não fecha ao tocar fora nem com Esc; pergunta "Descartar o que você preencheu?" com "Continuar editando" (`btn`, com foco) e "Descartar" (`btn perigo`). Formulário vazio ou sem mudança fecha direto.
- **Texto cortado** (`TextoCortado`, atributo `data-corta`; KAN-144, KAN-146): texto longo (local, subtítulo) numa linha só com "…". Quando corta, ganha sublinhado pontilhado; passar o mouse mostra o texto inteiro (`title`) e tocar abre ou fecha (`role="button"`, `aria-expanded`, Enter e espaço funcionam). Nunca cria rolagem lateral.
- **Como chegar** (`ComoChegar`, classe `chip-mapa`; KAN-141): rótulo "Como chegar:" em `muted` e dois chips de 36px, "Google Maps" e "Waze", borda `field-border`, fundo `surface`. Abrem em nova aba a busca pelo texto do local (sem custo de API). Só aparecem quando há local.
- **Campo de horário** (KAN-151): hora (00–23) e minutos (00–59) em dois campos de 52px com 44px de altura, números tabulares, separados por ":" em `muted`. Setas ▲▼ (`hseta`, 44 × 36px, cor `brand`) acima e abaixo de cada campo; segurar repete. Aceita digitar qualquer minuto (10:03). Término é opcional ("—" até escolher) e começa no horário de início. Nunca o relógio do celular. Nos dias fixos do grupo, cada horário tem o rótulo em cima (classe `hrot`, 12px, `muted`, negrito): "Início" e "Término (opcional)" (KAN-166).
  - **Relógio de 12h** (`HoraCampo`, botão `hap`; KAN-163, v65): no grupo de país que usa 12h, a hora vai de 1 a 12, sem o zero na frente, e depois dos minutos vem o botão AM/PM (44 × 44px, borda `line`, fundo `surface`, texto `ink` em negrito, 15px). Tocar troca o período; Enter e espaço também. ▲ na hora anda em 24h (11 PM → 12 AM). O valor gravado continua em 24h.
  - **Dia fixo com AM/PM** (`srow doze`): dia da semana e remover na 1ª linha, Início e Término embaixo, lado a lado; até 420px de largura, um em cima do outro. Sem rolagem lateral em 360px.
  - Na exibição: "8:00 PM"; faixa no mesmo período, "7:00–9:00 PM"; passando da meia-noite, "11:00 PM–1:00 AM".
- **Seletor segmentado com contagem** (`Segmentado`, classe `seg seg-filtro`; KAN-71): opções de 44px com o rótulo e a contagem embaixo; a escolhida usa `primary` e `aria-pressed`.
- **Barra de ação fixa** (classe `acao-fixa`): ver pelada-v29.
- **Ficha de dados** (classe `ficha`; KAN-150): lista de rótulo e valor (`dl`). Rótulo em `muted`, negrito. No computador, duas colunas; até 520px, o rótulo fica inteiro em cima do valor.
- **Painel do link permanente** (KAN-150; recolhido na v75, KAN-194; classes `fixos` e `fixos-linha`): fica **depois** do cartão da rodada. Recolhido numa linha: "Link permanente" (16px) e "Mandar no WhatsApp" (`btn sm primary`). Em "Como funciona" (Seção recolhível) ficam a explicação em `muted`, "Copiar link" e "Editar dias" (`btn sm`). Não repete dia, hora nem local, que ficam no cartão da rodada.
- **Login com Google** (KAN-142): botão "Continuar com o Google" em `btn` na largura toda, com o "G" colorido oficial, acima do divisor "ou com e-mail e senha". Se a aba não bater (criar conta com Google que já existe, ou o contrário), entra mesmo assim e avisa num aviso flutuante.
- **Criar conta com o botão desligado** (KAN-187, v66): o motivo aparece na linha de erro (`err`, avisada ao leitor de tela) acima do botão: "Confira o e-mail: falta a terminação (.com, .com.br…).", "Digite seu e-mail.", o que falta na senha ou "As senhas não conferem.". Enter com o botão desligado mostra o motivo. Segue a regra "desabilitado com motivo, nunca só cinza".
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
- **Seletor de rodada** (`SeletorRodada`, classe `rsel`; KAN-160): lista das próximas rodadas e das últimas 4 (data, hora, "fixo" ou "(cancelada)"). Na aba Rodada vem com "Nova rodada" (desde a v75, sem o botão "Histórico": o caminho é a aba, KAN-194); na aba Partida, só a lista, e aparece também quando a rodada escolhida ainda não tem times.
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
- **Quem mais joga junto** (KAN-200, v68; classe `juntos-n`): lista numerada (`plist` com `num`), "Fernandinho + Rafa" e, à direita, o número de vezes em negrito com números tabulares ("3 vezes", "1 vez"). Sem barra. Os 6 primeiros aparecem direto; o resto fica numa Seção recolhível "Ver todos (N pares)".
- **Permissões do administrador** (KAN-201, v69; classes `perm-lista`, `perm-item`, `perm-resumo`): janela com uma linha por permissão, caixa de marcar de 22 px à esquerda, nome em negrito e, embaixo, o que ela libera em texto pequeno; área de toque de 44 px. Na lista de administradores, embaixo do e-mail, o resumo em texto pequeno ("Só o dia a dia", "Dia a dia, caixa e notas", "Pode tudo") e o botão "Permissões" (`btn sm`), só para o organizador. O que a pessoa não pode some da tela (não fica cinza).
- **Planos** (KAN-119, v70; `ui/Plano.tsx`, `ui/PlanosJanela.tsx`):
  - **Cadeado** (`trava`): aba de recurso fora do plano (Caixa, Votação, Histórico). A aba continua na barra com 🔒; o conteúdo é um painel com "🔒 Votação", "Faz parte do Plano A.", o que o recurso faz, "Nada do que já foi feito é apagado" e o convite: "Testar o Plano A grátis por 14 dias" (`btn primary sm`, só o organizador que ainda não testou), ou "Contratação em breve" / "fale com o organizador" em texto, e "Ver os planos" (link).
  - **Trava** (`trava-linha`): faixa pequena âmbar (`--key-bg`, `--key-border`, `--key-ink`) dentro de uma tela, para um pedaço travado (ranking do ano, cobrar, controle de vagas): "🔒 Cobrar quem não respondeu faz parte do Plano A. Ver os planos".
  - **Aviso do plano** (`inbar info`, verde claro): novidade da transição e fim próximo do plano, com "Ver os planos" e "Entendi". Grupos acima do limite usam o `inbar` de alerta com "Escolher grupos" e não somem até a escolha.
  - **Só vê** (KAN-204, v71): convidado além do limite do plano vê o aviso no topo (`inbar info`, "Você só pode ver este grupo…") e nenhum botão que grave (classe `so-ver` no corpo). Na lista de administradores, o organizador vê a etiqueta "só vê" (`tag alt so-ve`) e a explicação do plano. O convite com o plano cheio mostra um painel no lugar do "Aceitar convite".
  - **Janela Planos**: plano de agora em negrito com a data, tabela Grátis/A/B (o de agora em verde), "✓" e "—" com rótulo para leitores de tela, e a frase de que o jogador nunca paga. **Escolher grupos**: mesma lista de caixas de marcar das Permissões.
- **Seção recolhível** (KAN-193, v67; `details`/`summary`): o título tem 44px de altura (`touch-min`), com o sinal + / – à esquerda. No cartão (`details.panel`), o título ocupa o cartão inteiro, inclusive as margens, então tocar em qualquer ponto abre e fecha. Foco visível em `brand` em volta da linha. Vale para "Ver times", "ver nomes", "Lista fechada", "Como funciona", "Cobrar um por um", "Quem entra no sorteio" e as perguntas da apresentação.
- **Áreas de toque pequenas** (KAN-193): "Entrar" e "Criar conta grátis" na tela de entrar ganham 44px de área de toque sem mudar o visual; o chip "← Início" tem 36px; na apresentação, o botão de tema tem 36 × 36px no celular.
- **Artilharia da rodada** (KAN-178; sem classe nova; nome pelo catálogo do esporte desde a v67, KAN-192: "Artilharia", "Cestinhas" ou "Pontos da rodada"; em duplas, sem "Escalação" e com "Dupla A" e "Dupla B" nos combos):
  - Na aba Partida, depois de "Partidas desta rodada", fica o painel "Artilharia da rodada", com "Lançar" (ou "Editar") em `btn sm`. Embaixo, uma linha em `muted`: a ajuda, ou o lançamento já feito ("Marcão 3 · Bruno 1").
  - A janela tem uma ajuda em `muted`; se a rodada já tem partidas com placar, um aviso em `out`. Depois vem uma linha por jogador dos times, com "−" (`btn sm`, desligado no zero), o número em negrito e "+". Para o leitor de tela, os botões dizem "Somar 1 para Marcão" e "Tirar 1 de Marcão". Rodapé: "Cancelar" e "Salvar artilharia" (`primary`).
- **Time e colete** (v60, classes `colete-btn` e `dot branco`):
  - O cartão do time tem o nome "Time 1" em negrito. À direita fica o botão do colete (`btn sm ghost`, 36px): uma bolinha da cor e "colete laranja". Duplas não têm colete.
  - Tocar abre a janela "Colete do Time 1", com uma ajuda em `muted` e as 8 cores em `opt` (bolinha + nome). A cor atual fica marcada (`aria-pressed`) e com o foco. A cor de outro time mostra "Time 2" à direita, em `tag`.
  - O branco ganha um contorno (`dot branco`) para aparecer no fundo claro.
  - No link e no Histórico, o selo do time é "colete laranja · 5".
- **Vagas para diaristas e avulsos** (`PainelVagas`, classes `chk-linha` e `aviso-vagas`; KAN-63):
  - Na aba Rodada, só com o controle ligado, um `panel` logo antes de "Ainda não responderam". Tem o título "Vagas para diaristas e avulsos" e o estado em `small`: "Fechadas. Pelo link, só mensalistas e isentos confirmam." (`muted`), "Abertas · 1 de 3 preenchidas" ou "Esgotadas · 3 de 3 preenchidas" (`muted`).
  - Botões: "Abrir vagas" (`btn sm primary` quando fechadas ou esgotadas), "Mudar vagas" e "Fechar vagas" (`btn sm`).
  - Janela "Abrir vagas": ajuda em `muted` e o campo "Quantas vagas?" (140px, exemplo "Sem limite"), com o cursor nele. Enter abre.
  - Ligar o controle: na janela "Mínimo e vagas", a caixa de marcar em linha (`chk-linha`: 44px de altura, caixa de 22px na cor `brand`) "Diaristas e avulsos só entram quando eu abrir vagas na rodada".
  - No link: aviso `aviso-vagas` no fim de "Você vai?", no lugar de "Adicionar meu nome". Fechadas ou esgotadas: em `out`, negrito. Abertas com limite: "Restam 2 vagas para diaristas e avulsos." em `muted`.
- **Mínimo para o jogo** (`PorPosicao`, classes `porpos`, `porpos-falta` e `minpos-grade`; KAN-179):
  - Dentro do quadro da rodada (aba Rodada e link), depois do resumo: rótulo "Confirmados por posição" em `small muted` (ou "Mínimo para o jogo" no esporte sem posição) e, na gestão, o botão "Definir mínimo" (`btn sm ghost`) na mesma linha.
  - Contagem em chips `poschips` (os mesmos das Posições do grupo): sigla em negrito e o número ("GOL 1", ou "GOL 1 de 2" com mínimo). "Total 3 de 5" vem primeiro quando há mínimo total. A sigla tem o nome da posição no `title`.
  - Chip abaixo do mínimo usa `out-soft` com borda `out-fill` e texto `out` (contraste AA nos dois temas; KAN-185, v64). Embaixo, "Faltam 2 jogadores · Falta 1 GOL" em `out`, 14px, negrito.
  - Janela "Mínimo para o jogo": ajuda em `muted`, campo "Total de jogadores" (cursor já nele) e, se houver posições, "Por posição" com um campo numérico de 44px por sigla em grade (`minpos-grade`, colunas de 84px). Enter salva.
- **Rodapé das janelas**: desde a pelada-v58, os botões de toda janela (`.dlg-f .btn`) têm 44px de altura, como já tinham as confirmações.
- **Ainda não responderam** (KAN-64; sem classe nova):
  - Na aba Rodada, logo depois do quadro da rodada, há um `panel` com o título "Ainda não responderam (12)" e o botão "Cobrar no grupo" (`btn sm primary`). Embaixo vêm os nomes em `muted`, separados por vírgula, e um `details` "Cobrar um por um".
  - Aberto, ele mostra uma lista (`plist`): cada nome com "WhatsApp" (`btn sm`, link de 36px, que para o leitor de tela diz "Cobrar Rafa no WhatsApp") ou "sem telefone" em `muted`.
- **Valor fora do padrão** (KAN-161): é a janela de confirmação do app (KAN-128) com o título "Lançar R$ 8.000,00?", o texto "É bem mais que o normal deste grupo. Confira se não sobrou um dígito." e os botões "Corrigir valor" (volta ao campo, com o cursor nele) e "Lançar assim mesmo" (`primary`).
- **Carregando a gestão** (KAN-149): ao abrir a gestão pela primeira vez, a área principal mostra "Carregando…" em `muted`; sem internet, "Não foi possível carregar" com a orientação de recarregar.
- **Carregando com internet ruim** (KAN-184; sem classe nova): no link e na votação, "Carregando…" em `muted`. Depois de 12 s, vira um `panel empty` com "Está demorando mais que o normal. A internet pode estar fraca." e o botão "Tentar de novo" (`btn primary`). Se as tentativas acabarem, o painel tem o título "Não foi possível carregar", o texto de orientação e o mesmo botão. Nunca "não encontrado" por falha de rede.

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
- **Abas** (KAN-72): 8 abas, nesta ordem: Rodada, Histórico, Jogadores, Partida, Ranking, Caixa (só com a permissão de Caixa), Votação e Grupo; aba fora do plano com 🔒. Sombra de continuação (degradê de `surface` para transparente, 24px) do lado em que há mais abas; a aba aberta fica no centro da barra; espaço lateral de 12px.
- **Placar** (KAN-73): botões de pontuação sempre com 44px. Com 4 ou mais pontuações (futebol americano, rugby), viram uma grade de 2 colunas sob cada time. Quando o tempo acaba, o número pisca só 3 vezes (nunca abaixo de 60% de opacidade) e fica parado em `bib`, com o aviso "Tempo esgotado" fixo.
- **Busca de nome no link público** (KAN-127, classe `busca-nome`): campo "Procure seu nome" com rótulo visível e 44px, que filtra enquanto digita, sem diferenciar acentos e maiúsculas. Sem resultado, orienta a tocar em "Adicionar meu nome" e leva o texto digitado para a janela. Com a lista aberta, os times ficam recolhidos em "Ver times"; os confirmados viram uma linha "10 confirmados · ver nomes".
- **Valores novos** entram primeiro no Design System, com contraste medido nos dois temas.

## Testes
O roteiro automático (`testes/ROTEIRO-DE-TESTES.md`) confere o Design System em toda versão: tema (menu, Esc, toque fora, persistência e cor do navegador), alvos de toque de 44px e 36px, ✓ / ✕ no link público e contraste do texto (WCAG 2.2 AA) nos dois temas. Na pelada-v13: 49 de 49 verificações passaram. Desde a pelada-v75, o roteiro também procura campos sem rótulo nas abas Caixa e Votação e mede as caixas de marcar da Nova votação (44px).

## Manutenção
O agente de UX/UI (tarefa agendada às segundas, 10h52) confere o app contra este sistema e abre cartões no épico **KAN-68 "Melhorias de UX/UI"** do Jira, com a etiqueta `ux-agente`.
