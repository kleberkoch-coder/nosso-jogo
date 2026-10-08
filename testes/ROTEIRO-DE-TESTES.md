# Roteiro de testes do Nosso Jogo

Usado pelo agente de Qualidade e por quem construir uma versão nova. O script `testes/testes_app.py` faz tudo automaticamente.

## Como rodar
1. Monte o site: `npm install` e `npm run build`. O resultado fica na pasta `dist/` (a pasta `app/` do projeto no Claude já é uma cópia montada).
2. Copie o conteúdo de `dist/` para uma pasta de teste. No `index.html`, troque `window.FIREBASE_CONFIG = {...}` por `window.FIREBASE_CONFIG = {}` (modo demonstração: os dados ficam só no navegador de teste e nada vai para o Firebase de verdade).
3. Na pasta, rode `python3 -m http.server 8765`.
4. Rode `python3 testes_app.py http://127.0.0.1:8765/index.html fotos`.

Precisa do Playwright com o Chromium (`pip install playwright` e `python3 -m playwright install chromium`). O GitHub faz tudo isso sozinho em toda proposta de mudança (automação "Testes do app").

## O que é verificado (49 itens na pelada-v13)
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
