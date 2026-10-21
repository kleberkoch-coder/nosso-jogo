# Roteiro de testes do Nosso Jogo

Usado pelo agente de Qualidade e por quem construir uma versão nova. O script `testes/testes_app.py` faz tudo automaticamente.

## Como rodar
1. Monte o site: `npm install` e `npm run build` (e `npm run checar` para conferir os tipos do TypeScript). O resultado fica na pasta `dist/` (a pasta `app/` do projeto no Claude já é uma cópia montada).
2. Copie o conteúdo de `dist/` para uma pasta de teste. No `index.html`, troque `window.FIREBASE_CONFIG = {...}` por `window.FIREBASE_CONFIG = {}` (modo demonstração: os dados ficam só no navegador de teste e nada vai para o Firebase de verdade).
3. Na pasta, rode `python3 -m http.server 8765`.
4. Rode `python3 testes_app.py http://127.0.0.1:8765/index.html fotos`.

5. Rode também o roteiro de gravação (KAN-170): `python3 persistencia_app.py http://127.0.0.1:8765/index.html`. Ele grava cada tipo de dado, recarrega e confere; no fim, entra de novo e confere tudo.

Precisa do Playwright com o Chromium (`pip install playwright` e `python3 -m playwright install chromium`). O GitHub faz tudo isso sozinho em toda proposta de mudança (automação "Testes do app"). Lá, o roteiro de gravação roda contra o **emulador do Firebase** (tarefa "persistencia"), com o Firestore e o login de verdade.

## O que é verificado (61 itens na pelada-v14)
- **Página de apresentação:** abre em até 1,5 segundo; sem rolagem lateral no celular; botão de tema.
- **Seletor de tema:**
  - o menu abre com o foco na opção atual e opções de 44px;
  - Escuro aplica o tema e muda a cor do navegador;
  - a escolha continua depois de recarregar;
  - Esc e tocar fora fecham o menu, e tocar fora não aciona o que está embaixo;
  - Automático volta a seguir o celular;
  - a mesma opção funciona em Grupo > Aparência.
- **Cadastro:** cursor no e-mail, Enter cria a conta e abre "Novo grupo".
- **Futebol:**
  - criar grupo e carregar o elenco de exemplo;
  - marcar 10 presenças, com abas usando `role=tablist` e botões pequenos de 36px ou mais;
  - sortear times;
  - placar com gol, aviso "Tempo esgotado" e salvar a partida;
  - ranking, lançamento no caixa e votação (o link para o WhatsApp continua aberto).
- **Link público (jogador sem conta):**
  - chip de tema;
  - Vou e Não vou com 44px, mostrando ✓ e ✕ quando marcados;
  - sem notas;
  - avulso se adiciona pelo link.
- **Contraste do texto na tela** (WCAG 2.2 AA): Rodada clara e escura, Partida escura, link público claro e escuro.
- **Beach tennis:** sem siglas de posição, sorteio em duplas, placar com "Game" e nenhuma palavra de futebol na Rodada e na Partida.
- **Basquete:** botões +1, +2 e +3; cesta de 3 soma 3 pontos; nenhuma palavra de futebol.
- **Desempenho e Histórico (v14, casos CT-KAN-82 a CT-KAN-85):**
  - o link do jogador não carrega rodadas antigas e continua mostrando a próxima;
  - a aba Rodada mostra as próximas e só as últimas 4, sem carregar as antigas, e tem o atalho para o Histórico;
  - com uma cópia desatualizada da rodada, fechar a lista não apaga uma partida salva antes (gravação por campo);
  - a aba Histórico abre com a busca por mês, a busca por período encontra as rodadas antigas, a rodada aberta mostra lista, times, partidas e votação, período vazio mostra mensagem clara, contraste e sem rolagem lateral.
- **Lista e sorteio (v15, casos CT-KAN-90 a CT-KAN-92):**
  - com a lista fechada o administrador não marca presença nem adiciona avulso; reabrir volta a permitir;
  - sortear fecha a lista, e o link mostra a lista fechada com os times;
  - "+ Pôr no time" põe a pessoa no time e na lista de confirmados, sem aviso;
  - com times sorteados, mudar presença pede confirmação (Cancelar não muda);
  - o aviso mostra quem saiu e quem entrou, continua depois de recarregar e some com "Tirar do time", "Pôr no time", "Manter os times assim" ou "Sortear de novo";
  - contraste do aviso.
- **Jogadores por time e posições fora do sorteio (v16, casos CT-KAN-94 e CT-KAN-95):**
  - novo grupo vem com o padrão do esporte, trocar o esporte troca o padrão, número inválido não salva;
  - 14 confirmados com time de 4: sugere 3 times, prévia "3 times de 4 + 2 reservas", 4 times divide por igual; reserva é quem confirmou por último; reservas no time, no link e no WhatsApp;
  - "Marcar como titular" e pôr num time completo (entra como reserva);
  - tirar e devolver a posição GOL; sorteio sem goleiros; a escolha fica salva; contraste e sem rolagem lateral.
- **Login e aba Grupo (v17, casos CT-KAN-97 a CT-KAN-100):**
  - botão do Google com o G colorido oficial e "Continuar com o Google";
  - Mostrar/Ocultar senha (mantém o cursor no campo), também em "Confirme a senha", com contraste;
  - administrador mostra "E-mail e senha" e o campo fica gravado; ficha do grupo mostra jogadores por time.
- **Partidas e totais por mês (v18, casos CT-KAN-86 e CT-KAN-87):**
  - partida gravada na subpasta da rodada (ficha só com a contagem) e listada na aba Partida; jogador vê o placar pelo link, sem apagar;
  - grupo com partidas no formato antigo é migrado na abertura, e os totais somam antigas e novas;
  - ranking lê só as fichas do ano; partida salva já conta; apagar desconta; ficha estragada é corrigida com Recalcular; contraste;
  - caixa: saldo, entradas e saídas batem com os lançamentos e a ficha do mês guarda as entradas em centavos;
  - fechar a lista com cópia desatualizada não mexe na contagem de partidas (CT-KAN-83 adaptado).
  - **Não coberto pelo modo demonstração:** as regras do Firebase (criar só se não existe, apagar só se existe, resumos só para administradores). Revisadas por um agente independente; teste no emulador fica como cartão.
- **Versão do app (v19, CT-KAN-107):** apresentação, cadastro, Entrar, Meus grupos e aba Grupo mostram a mesma versão do service worker; contraste da versão no tema escuro (apresentação e Entrar).
- **Ícones (KAN-59, decisão de 09/10/2026: manter os atuais):** os 5 ícones guardados pelo service worker (favicon-32, apple-touch-icon, icon-192, icon-512, maskable-512) existem e carregam como imagem.
- **Correções da Qualidade (v22):** identificador com código no link é ignorado (KAN-76, rodada, jogadores e link do jogador); trocar a cor com a tela desatualizada não desfaz o sorteio (KAN-108); presença carregando mostra "Carregando…" (KAN-109); aviso de lista fechada em duplas sem "+ Pôr no time" (KAN-110); texto "Continuar com o Google" em todo o app (KAN-112). Jogo fixo que passa da meia-noite (KAN-111) está no teste de regra `rodadas-fixas`. As regras novas (identificador válido em presença e voto) estão nos testes do emulador.
- **Caixa e confirmações (v30, KAN-128, 129 e 135):**
  - Caixa como componente: saldo, entradas, saídas e pendências; nome com `<b>` ou `<script>` aparece como texto;
  - "Recebi": aviso "Recebido de …" com Desfazer (44 × 44px, contraste AA nos dois temas, `role=status`), o rótulo do botão diz nome e valor; Desfazer devolve a pendência e o saldo; sem toque, some em 6 segundos e o pagamento fica;
  - ✕ do lançamento abre a janela do app (Cancelar e Apagar lançamento), com o foco em Cancelar; botão da ação em coral com contraste AA e 44px nos dois temas; Esc e tocar fora não apagam, e o foco volta ao ✕; apagar oferece Desfazer;
  - Excluir jogador por cima da janela do jogador: Cancelar volta ao formulário com o que foi digitado; Sair com alterações sem enviar pergunta na janela do app;
  - em todo o roteiro, nenhuma caixa do navegador (`confirm` ou `alert`) aparece (CT-KAN-128-05).
- **Uso no celular (v29, KAN-71, 72, 73, 74, 127 e 130):**
  - aba Rodada: "Sortear times (10)" fixo no rodapé e visível sem rolar; sem confirmados, desabilitado com "Faltam 4 para sortear"; uma lista só de presença, cada nome uma vez; filtros Todos, Vão (numerado na ordem de chegada), Não vão e Sem resposta somam certo, com 44px; explicação dos jogos fixos recolhida; depois de sortear, a tela vai até os times com o foco em "Times" e a barra sai;
  - abas: sombra à direita no começo e à esquerda depois de rolar; Caixa, Grupo e Ranking abertas ficam inteiras na barra; espaço lateral de 12px;
  - janela Sortear: botões de 36px ou mais, linhas de jogador de 44px tocáveis inteiras, "Sortear" a no máximo 1 rolagem; ⇄ com 36 × 36px e nome do jogador para leitor de tela; chips do cabeçalho com 36px;
  - placar: +1, +2 e +3 do basquete com 44px; futebol americano em grade de 2 colunas, 44px e sem rolagem lateral; tempo esgotado pisca só 3 vezes e não volta a piscar ao redesenhar;
  - link público: busca "Procure seu nome" e primeiro Vou sem rolar; busca sem diferenciar maiúsculas e acentos; apagar volta a lista; sem resultado orienta e leva o texto para "Adicionar meu nome"; "Você vai?" antes dos times recolhidos; cada nome uma vez; campo com rótulo e 44px;
  - Enter: avulso pelo link entra apertando Enter, e o campo mostra "Concluir" no teclado do celular.
- **Casos da Qualidade (v28):** caixa só em `privado/caixa` e migração de grupo antigo (CT-KAN-79-03 a 05); tocar Vou de novo mantém a posição, desmarcar e confirmar vai para o fim, nome/avulso/posição enviados iguais (CT-KAN-78-03 a 06); link só com a próxima rodada (CT-KAN-77-05); portal: sem plano = Grátis (CT-KAN-115-03), último acesso de hoje, filtro de 30 dias, sem caixa nem Pix, loading do Atualizar com a lista na tela, 390px com Sair de 36px e tema escuro (CT-KAN-116-07 a 12); link público e lista completa no portal (CT-KAN-133-01 e 03).
- **Portal e planos (v26, KAN-115 e KAN-116):** o portal é um site separado (`portal.html` no teste, `dist-portal/` na montagem): só "Entrar com o Google", sem criação de conta, e Sair volta para essa tela (CT-KAN-116-07); o app dos clientes não tem nenhum botão nem tela do portal, nem para o e-mail da administração (CT-KAN-116-02). O último acesso, o e-mail e a data de registro são gravados ao entrar (CT-KAN-116-03); no portal, a lista mostra plano, grupos, último acesso e última rodada (CT-KAN-116-01); os planos do catálogo aparecem no resumo (CT-KAN-115-01); nada de notas, caixa, Pix ou contatos (CT-KAN-116-05); contraste (CT-KAN-116-06); busca por e-mail e filtros "vence em 7 dias" e por plano (CT-KAN-116-04); plano vencido aparece como Grátis (CT-KAN-115-05). As regras (quem grava plano, último acesso, lista de clientes) estão no emulador; o catálogo e os filtros, em `testes/regras/planos.test.mjs`.
- **Testes sugeridos pela Qualidade (v25):** 39 verificações novas, de KAN-89 (03, 04, 05 no Duplicar, 07 e 09 em beach tennis), KAN-110 (02 e 03, em vôlei de praia, futebol com 2 por time, futebol e basquete), KAN-109 (02 e 03), KAN-108 (02, 05 e 06), KAN-80 (04 a 06), KAN-76 (06 e 12) e KAN-111 (01 a 06, com relógio simulado e fuso de São Paulo, num navegador separado no fim). O CT-KAN-111-04 achou um defeito, corrigido na v25: a aba Rodada às vezes abria numa data fixa cancelada.
- **Segurança do link (v25, KAN-77, 78, 79):** só nos testes do emulador (o modo demonstração não aplica as regras): hora da confirmação validada, ordem que não volta, nome/posição/avulso que não mudam pelo link, jogo fixo só em datas próximas, mensalidade e diária barradas no documento público.
- **Limites contra abuso (v23, KAN-89):** avulso novo pelo link soma 1 no contador da rodada e jogador cadastrado não conta (CT-KAN-89-01); no limite, o link avisa, esconde "Adicionar meu nome" e quem já está na lista continua respondendo (CT-KAN-89-02); a aba Rodada mostra o aviso ao organizador, que ainda adiciona avulso (CT-KAN-89-03); cada grupo criado soma no contador da conta (CT-KAN-89-04); no limite de grupos aparece a mensagem e nenhum grupo é criado (CT-KAN-89-05). As recusas de verdade (passar do limite, contador mexido à mão, nome com mais de 40 letras, configuração mudada valendo na hora) estão nos testes do emulador; os padrões iguais no app e nas regras, em `testes/regras/limites.test.mjs`.
- **App Check (v21, KAN-88):** no modo demonstração o App Check fica desligado e o roteiro inteiro passa (critério 4). O GitHub confere que a prévia sai em modo demonstração. A medição real (critério 2) é vista no console do App Check.
- **Sair limpa o aparelho (v20, CT-KAN-80):** com alteração sem enviar, Sair pergunta e Cancelar mantém conectado; Sair desconecta e volta à apresentação sem dados do grupo na tela. A limpeza da cópia offline do Firebase (`terminate` + `clearPersistence`) não roda no modo demonstração.
- **Sugestões da Qualidade (09/10/2026):** votação pública (chip de tema, voto registrado, contraste nos dois temas), tela de convite (chip de tema, cursor no e-mail, contraste no escuro) e apresentação no tema escuro. Desde a v19 o roteiro roda sobre o site **compactado** (o mesmo publicado).
- **Regras do Firebase no emulador (v19, KAN-104):** tarefa `regras-firebase` no GitHub, 21 casos em `testes/regras-firebase/regras.test.mjs` (partidas criar/apagar só uma vez, lote repetido recusado inteiro, resumos só para administradores, caixa, Pix, presença com lista aberta/fechada, campo `via` dos administradores). Toda mudança nas regras entra com casos novos ali.
- **Regras de negócio com teste próprio** (`npm run regras`, roda no GitHub antes da montagem): lista × times (9 casos), jogadores por time e reservas (7 casos), rodadas fixas: próxima data (8 casos) e ranking e totais por mês (10 casos, compara com o cálculo antigo) — 2 das 5 da D12.
- **Idiomas:** nenhum texto da tela sem tradução no dicionário.
- **Erros de JavaScript:** nenhum. Erros de fontes e ícones são ignorados, porque o ambiente de teste pode bloquear a internet.

## Regras
- Toda versão nova (mudança de `VERSION` no `sw.js`) só é entregue com todas as verificações passando.
- Funcionalidade nova entra com verificações novas neste roteiro e no script, na mesma entrega.
- Os casos de teste marcados "(automatizável)" no comentário `[Casos de teste]` de cada cartão entregue viram verificações no script, com o código do caso (`CT-KAN-XX-NN`) no nome da verificação.
- Cada cartão entregue recebe o comentário `[Entrega] pelada-vXX` e vai para **Em análise**. O agente de Qualidade valida e move para **Concluído** (passou) ou devolve para **A fazer** (falhou, com defeitos).
- O agente de Qualidade não altera este arquivo nem o script: quando sentir falta de um teste, ele sugere no relatório.

## Histórico
| Versão | Data | Resultado |
|---|---|---|
| pelada-v12 | 07/10/2026 | 47 de 47 passaram |
| pelada-v13 | 08/10/2026 | 49 de 49 passaram |
| pelada-v14 | 08/10/2026 | 61 de 61 passaram |
| pelada-v15 | 08/10/2026 | 80 de 80 passaram, mais 9 de 9 na regra lista × times |
| pelada-v16 | 08/10/2026 | 101 de 101 passaram, mais 16 de 16 nas regras |
| pelada-v17 | 08/10/2026 | 109 de 109 passaram, mais 24 de 24 nas regras |
| pelada-v18 | 08/10/2026 | 122 de 122 passaram, mais 34 de 34 nas regras |
| pelada-v19 | 08/10/2026 | 125 de 125 passaram, 34 de 34 nas regras de negócio e 21 de 21 nas regras do Firebase |
| pelada-v19 + testes sugeridos | 09/10/2026 | 138 de 138 passaram (13 verificações novas, sem mudar o app) |
| pelada-v20 | 09/10/2026 | 140 de 140 passaram |
| pelada-v21 | 09/10/2026 | 140 de 140 passaram |
| pelada-v22 | 09/10/2026 | 147 de 147 passaram, 35 de 35 nas regras de negócio |
| pelada-v23 | 09/10/2026 | 155 de 155 passaram, 41 de 41 nas regras de negócio |
| pelada-v24 | 13/10/2026 | 156 de 156 passaram, 41 de 41 nas regras de negócio (mudança para o Firebase Hosting; mensagem do limite de grupos no singular) |
| pelada-v46 | 15/10/2026 | 353 de 353 passaram (KAN-159: importar da planilha, colando, .xlsx e .csv; KAN-160: seletor na Partida; 11 novas), 72 de 72 nas regras de negócio (9 novas, de dominio/planilha.ts) |
| pelada-v47 | 16/10/2026 | 375 de 375 passaram (KAN-162: país no cadastro pelo fuso do aparelho em São Paulo, Chicago e Manaus; país da conta; grupo nos EUA com dólar e fuso; telefone com país ao lado; aviso ao trocar a moeda; grupo antigo continua Brasil; 22 novas), 80 de 80 nas regras de negócio (8 novas, de dominio/paises.ts, e o fuso do grupo em formatos.js) |
| pelada-v48 | 16/10/2026 | 379 de 379 passaram (KAN-166: menu da conta no cabeçalho com e-mail, País e formatos e Sair; Esc e foco; rótulos Início e Término nos dias fixos; 4 novas, e o Sair dos testes passou a usar o menu), 80 de 80 nas regras de negócio |
| pelada-v49 | 16/10/2026 | 382 de 382 passaram (KAN-167: posição criada e par separado continuam depois de recarregar; o modo demonstração recusa lista dentro de lista, como o Firestore; 3 novas), 83 de 83 nas regras de negócio (3 novas, de nucleo/dados-banco.ts) |
| pelada-v57 | 17/10/2026 | 457 de 457 passaram (KAN-64: cobrar quem não respondeu; KAN-161: valor fora do padrão no Caixa, no valor por jogo e no Pagar; 15 novas) · roteiro de gravação: 26 de 26 em modo demonstração · 124 de 124 nas regras de negócio (8 novas: fora-do-padrao, cobrar) |
| pelada-v58 | 21/10/2026 | 470 de 470 passaram (KAN-179: confirmados por posição e mínimo para o jogo na Rodada e no link, em futebol, vôlei e beach tennis; rodapé das janelas com 44px; 13 novas) · roteiro de gravação: 27 de 27 em modo demonstração (P21 nova) · 129 de 129 nas regras de negócio (5 novas: minimo-posicao) |
| pelada-v59 | 21/10/2026 | 486 de 486 passaram (KAN-63: vagas para diaristas e avulsos, com o link escondendo quem precisa de vaga, contador que sobe e devolve, fechar e desligar; 16 novas) · roteiro de gravação: 29 de 29 em modo demonstração (P22 nova) · 136 de 136 nas regras de negócio (7 novas: vagas) · regras do Firebase no emulador: 72 de 72 (10 novas) |
| pelada-v60 | 21/10/2026 | 494 de 494 passaram (KAN-181: Time 1 e Time 2, colete escolhido à vontade e trocado entre times, partida salva com a posição dos times; cronômetro com qualquer minuto, 9 minutos mostra 09:00; 8 novas, e os testes do KAN-108 passam pela escolha do colete) · roteiro de gravação: 29 de 29 · 136 de 136 nas regras de negócio |
| pelada-v56 | 17/10/2026 | 442 de 442 passaram (KAN-178: artilharia da rodada; 6 novas) · roteiro de gravação: 26 de 26 em modo demonstração (caso P13c novo) · 116 de 116 nas regras de negócio (3 novas, camposArtilharia) |
| pelada-v55 | 17/10/2026 | 436 de 436 passaram (KAN-177: escalação com empréstimo e troca; 8 novas) · roteiro de gravação: 25 de 25 em modo demonstração · 113 de 113 nas regras de negócio (5 novas, dominio/escalacao.ts) |
| pelada-v54 | 17/10/2026 | 428 de 428 passaram (KAN-176: editar partida salva; 6 novas) · roteiro de gravação: 25 de 25 em modo demonstração (caso P13b novo) · 108 de 108 nas regras de negócio (5 novas, camposEdicao) · regras do Firebase: 3 casos novos (edição com versão) |
| pelada-v53 | 17/10/2026 | 422 de 422 passaram (KAN-175: fim por placar, Sem tempo e sugestão do próximo jogo; 11 novas, com fotos em 390 e 360 px) · roteiro de gravação: 24 de 24 em modo demonstração · 103 de 103 nas regras de negócio (7 novas, de dominio/fila.ts) |
| pelada-v52 | 16/10/2026 | 411 de 411 passaram (KAN-172: isento de pagamento, Recebe por jogo e A pagar no Caixa; 16 novas, com fotos em 390 e 360 px) · roteiro de gravação: 24 de 24 em modo demonstração (caso P20 novo) · 96 de 96 nas regras de negócio (7 novas: dominio/caixa-regras.ts aPagar, ordem e planilha) |
| pelada-v51 | 16/10/2026 | 395 de 395 passaram (KAN-171: app instalado do organizador não volta mais sozinho ao link do jogador; 3 novas) · roteiro de gravação: 22 de 22 em modo demonstração · 89 de 89 nas regras de negócio |
| pelada-v50 | 16/10/2026 | 392 de 392 passaram (KAN-168: ordenar jogadores; KAN-169: tema no menu da conta; 10 novas) · roteiro de gravação (KAN-170): 22 de 22 em modo demonstração e 21 de 21 no emulador do Firebase (o caso de gravação recusada só roda no modo demonstração) · 89 de 89 nas regras de negócio (6 novas, de dominio/ordem-jogadores.ts) |
| pelada-v45 | 15/10/2026 | 342 de 342 passaram, 63 de 63 nas regras de negócio (KAN-155: código formatado com o Prettier; a conferência da formatação comparou o código compactado de 76 arquivos, e só o build.mjs mudou, de propósito) |
| pelada-v44 | 15/10/2026 | 342 de 342 passaram (KAN-156: telefone internacional e e-mail; 8 novas), 63 de 63 nas regras de negócio (6 novas, de dominio/contato.ts); conferência da entrega no GitHub (KAN-157) |
| pelada-v43 | 15/10/2026 | 334 de 334 passaram (KAN-153: aba Rodada como componente), 57 de 57 nas regras de negócio (KAN-154: trava da dívida) |
| pelada-v42 | 15/10/2026 | chave nova do App Check (KAN-88); roteiro completo no GitHub |
| pelada-v41 | 15/10/2026 | 333 de 333 passaram (KAN-75: emoji, votação e nome do ponto pelo esporte; KAN-149: o link do jogador não baixa a gestão), 55 de 55 nas regras de negócio |
| pelada-v40 | 15/10/2026 | 327 de 327 passaram (KAN-150: ficha do grupo no celular e painel do link permanente; KAN-151: campo de horário com hora e minutos, setas e digitação) |
| pelada-v39 | 15/10/2026 | 318 de 318 passaram (KAN-146: local numa linha com "ver tudo"; seletor e cabeçalho sem o local) |
| pelada-v38 | 15/10/2026 | 317 de 317 passaram (inclui a v37; KAN-145: subtítulo cortado mostra o texto inteiro ao passar o mouse e ao tocar) |
| pelada-v37 | 15/10/2026 | 314 de 314 passaram (KAN-144: local de 200 letras sem espaço não estoura a aba Rodada nem o link) |
| pelada-v36 | 15/10/2026 | 312 de 312 passaram (KAN-143: local aceita o endereço completo, até 200 letras) |
| pelada-v35 | 15/10/2026 | 309 de 309 passaram (KAN-140 janela preenchida pergunta antes de descartar; KAN-141 Como chegar; KAN-142 aviso do Google na aba errada) |
| pelada-v34 | 15/10/2026 | 300 de 300 passaram (KAN-10: senha com minúscula e especiais da lista do Firebase; textos do login no dicionário) |
| pelada-v33 | 15/10/2026 | 295 de 295 passaram (KAN-138: rodada com votação não sorteia de novo; com partida salva, pergunta antes) |
| pelada-v32 | 14/10/2026 | 290 de 290 passaram (KAN-137: sem o aviso "A lista mudou" enquanto a presença carrega) |
| pelada-v31 | 14/10/2026 | 289 de 289 passaram (KAN-137: abas Rodada e Partida esperam as rodadas chegarem, sem piscar) |
| pelada-v30 | 14/10/2026 | 287 de 287 passaram (21 novas, de KAN-128, 129 e 135; os testes que aceitavam o confirm do navegador agora usam a janela do app), 55 de 55 nas regras de negócio |
| pelada-v29 | 14/10/2026 | 266 de 266 passaram (37 novas, dos critérios de aceite de KAN-71, 72, 73, 74, 127 e 130), 49 de 49 nas regras de negócio |
| pelada-v28 | 14/10/2026 | 229 de 229 passaram (18 novas, dos casos da Qualidade para KAN-77, 78, 79, 115, 116 e 133), 49 de 49 nas regras de negócio |
| pelada-v27 | 14/10/2026 | 211 de 211 passaram (Entrar no topo da apresentação em 390, 360 e 320 px, KAN-136) |
| pelada-v26 | 14/10/2026 | 208 de 208 passaram, 49 de 49 nas regras de negócio (portal em site separado) |
| pelada-v25 | 13/10/2026 | 195 de 195 passaram, 41 de 41 nas regras de negócio, 50 de 50 nas regras do Firebase (2 casos temporariamente pulados) |
