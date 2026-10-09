# Roteiro de testes do Nosso Jogo

Usado pelo agente de Qualidade e por quem construir uma versão nova. O script `testes/testes_app.py` faz tudo automaticamente.

## Como rodar
1. Monte o site: `npm install` e `npm run build` (e `npm run checar` para conferir os tipos do TypeScript). O resultado fica na pasta `dist/` (a pasta `app/` do projeto no Claude já é uma cópia montada).
2. Copie o conteúdo de `dist/` para uma pasta de teste. No `index.html`, troque `window.FIREBASE_CONFIG = {...}` por `window.FIREBASE_CONFIG = {}` (modo demonstração: os dados ficam só no navegador de teste e nada vai para o Firebase de verdade).
3. Na pasta, rode `python3 -m http.server 8765`.
4. Rode `python3 testes_app.py http://127.0.0.1:8765/index.html fotos`.

Precisa do Playwright com o Chromium (`pip install playwright` e `python3 -m playwright install chromium`). O GitHub faz tudo isso sozinho em toda proposta de mudança (automação "Testes do app").

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
- **Correções da Qualidade (v22):** identificador com código no link é ignorado (KAN-76, rodada, jogadores e link do jogador); trocar a cor com a tela desatualizada não desfaz o sorteio (KAN-108); presença carregando mostra "Carregando…" (KAN-109); aviso de lista fechada em duplas sem "+ Pôr no time" (KAN-110); texto "Continuar com o Google" em todo o app (KAN-112). Jogo fixo que passa da meia-noite (KAN-111) está no teste de regra `rodadas-fixas`. As regras novas (identificador válido em presença e voto) estão nos testes do emulador.
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
