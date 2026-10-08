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
- **Regras de negócio com teste próprio** (`npm run regras`, roda no GitHub antes da montagem): lista × times (9 casos) e jogadores por time e reservas (7 casos).
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
