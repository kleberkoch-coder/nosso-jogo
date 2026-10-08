# Nosso Jogo: arquitetura e decisões técnicas

Este documento registra **como o app é construído e por quê**. Cada decisão tem data, contexto e o que a faria mudar. O agente arquiteto usa este documento para revisar as versões novas. Decisão nova entra aqui antes de entrar no código.

## Objetivos que guiam as decisões (out. 2026)
O produto vai ganhar muitas funcionalidades e passará a **cobrar por partes do serviço**. Por isso, em ordem de prioridade:
1. **Segurança e privacidade:** nenhum vazamento de dados, nenhuma invasão. A proteção fica nas regras do servidor (Firebase), nunca só na tela.
2. **Desempenho:** rápido no celular, inclusive com sinal fraco.
3. **Facilidade de mudar:** cada parte do app em seu lugar, testada, para crescer sem medo de quebrar o resto.
4. **Custo baixo:** só pagar por infraestrutura quando ela resolver um problema real.

## Como o app é hoje
- **Front-end:** JavaScript, HTML e CSS. O código-fonte fica em `src/`, dividido em módulos por assunto (ver "Mapa do código").
- **Montagem:** o **esbuild** junta os módulos num único `index.html` (com o CSS e o código embutidos, sem minificar, para continuar legível). O Netlify roda `npm run build` a cada Merge e publica a pasta `dist/`. Arquivos fixos (service worker, manifesto, ícones) e o modelo da página ficam em `site/`.
- **Banco e login:** Firebase (Firestore e Authentication), sem servidor próprio.
- **Regras de acesso:** `firestore.rules`, publicadas pela automação do GitHub no Merge.
- **Testes:** `testes/testes_app.py` (Python + Playwright), simulando um usuário no celular. Rodam em toda proposta de mudança.

## Decisões

### D1. Sem microsserviços e sem filas próprias, por enquanto (8 out. 2026)
- **Contexto:** a dúvida era se o app deveria ser dividido em microsserviços e usar filas por causa de ações simultâneas.
- **Decisão:** não. O Firebase já cresce sozinho (sem servidor para administrar), e as gravações simultâneas mais comuns já são separadas por documento: cada presença, cada voto e cada lançamento do caixa é um registro próprio, sem disputa.
- **Por quê:** microsserviços resolvem o problema de muitas equipes publicando partes separadas. Para este produto, multiplicariam custo, pontos de falha e manutenção, sem ganho para o organizador ou o jogador.
- **O que faria mudar:** necessidade de lógica no servidor (cobrança, Pix, notificações, limites contra abuso) → **Cloud Functions do Firebase**, com filas (Cloud Tasks) se preciso. Exige o plano pago (Blaze, cobra por uso, com franquia gratuita). Ainda é a mesma estrutura, sem servidores próprios.

### D2. Front-end em módulos, migrando para componentes (8 out. 2026)
- **Contexto:** o app inteiro estava num único `index.html` com cerca de 500 funções. Cada mudança ficava mais arriscada.
- **Decisão:** dividir em etapas, sempre com o app idêntico por fora e os testes passando:
  - **Etapa 1 (pelada-v13, feita):** código dividido em 33 módulos por assunto, CSS em arquivo próprio, montagem pelo esbuild, base de idiomas e de formatos (moeda, datas).
  - **Etapa 2 em diante:** cada tela vira componente com **TypeScript** e **Preact** (versão leve do React, boa para celular), uma tela por entrega, começando pelo link público do jogador (a tela mais acessada).
- **Por quê:** fazer em etapas mantém o risco baixo. Os testes automáticos simulam o usuário, então valem durante toda a migração.

### D3. Vários idiomas desde a reorganização (8 out. 2026)
- **Decisão:** todo texto da tela sai do código para um dicionário por idioma (`src/i18n/pt-BR.js`), com `pt-BR` como idioma base. Moeda, datas e números usam uma configuração única de local (`src/i18n/formatos.js`).
- **Como usar no código:** `tx('publico.vou')` devolve o texto; `tx('publico.cancelado', {data})` troca `{data}`; `tp('voto.votos', n)` escolhe singular ou plural. Texto sem tradução gera aviso, e os testes falham.
- **Como migra:** na etapa 1 entraram a base, os formatos, os avisos de conexão e as duas telas públicas (link da rodada e da votação), que são o que o jogador vê. As demais telas migram junto com a componentização de cada uma. Texto novo já nasce no dicionário.
- **Por quê:** a visão é "qualquer pessoa no mundo". Fazer agora custa pouco; depois custaria refazer telas inteiras.

### D4. Rodada gravada com transações (planejado)
- **Contexto:** sorteio e placar ficam no mesmo registro da rodada. Dois administradores mexendo ao mesmo tempo podem sobrescrever um ao outro (vale a última gravação).
- **Decisão:** usar transações do Firestore (gravação que confere a versão antes de salvar) nesse registro.
- **Quando:** no próximo pacote, junto com D10, com teste automático de duas gravações simultâneas.

### D5. Recursos pagos controlados no servidor (planejado)
- **Decisão:** quando houver cobrança, o que cada grupo pode usar (o "plano") fica num registro que **só o servidor grava** (Cloud Function ligada ao meio de pagamento). As regras do Firebase conferem o plano antes de liberar cada recurso pago. A tela só esconde ou mostra; quem garante é a regra.
- **Por quê:** se a liberação ficasse só na tela, qualquer pessoa com conhecimento técnico usaria o recurso sem pagar.

### D6. Segurança como requisito de cada entrega (8 out. 2026)
- Toda mudança nas regras do Firebase passa pela revisão do agente de Segurança e do arquiteto antes do Merge.
- Todo texto vindo do banco passa pela função de escape antes de ir para a tela.
- Chaves de acesso só em segredos do GitHub, nunca no código. A conta que publica regras não lê dados.
- **Próximos reforços:** Firebase App Check (só o app oficial fala com o banco) e limites de gravação contra abuso, ambos antes de começar a cobrar.

### D7. Orçamento de desempenho (8 out. 2026)
Medido a cada versão, no celular de 390px:
- **Tamanho do app transferido** (comprimido): até **80 KB**, sem contar a biblioteca do Firebase. A montagem falha se passar. Na pelada-v13: 53,6 KB (era 49,4 KB na v12; a diferença é a formatação legível do código).
- **Primeira tela desenhada** em modo demonstração: até **1,5 segundo** no ambiente de testes. É uma das verificações do roteiro. Na pelada-v13: cerca de 0,5 segundo.
- Passar desses limites exige justificativa registrada aqui.

### D8. Montagem com esbuild, sem framework por enquanto (8 out. 2026)
- **Decisão:** o esbuild monta o site. É uma única ferramenta, sem dependências próprias, e monta tudo em menos de 1 segundo.
- **Por quê:** menos pacotes de terceiros significa menos risco de um pacote comprometido entrar no app. Ele já entende TypeScript e JSX, então serve também para a etapa 2 (Preact).
- **Detalhe para os testes:** em modo demonstração, o estado do app fica visível em `window.S`, para os testes automáticos ajustarem o cronômetro. Com o Firebase ligado, isso não existe.

### D9. Firestore como banco principal; outros bancos só como apoio (8 out. 2026)
- **Contexto:** avaliamos trocar o Firestore pelo MongoDB.
- **Decisão:** ficar no Firestore. Ele permite que o celular fale direto com o banco, protegido pelas regras (sem servidor próprio), funciona com sinal fraco (guarda no aparelho e envia depois) e atualiza as telas ao vivo. No MongoDB, isso exigiria construir e manter um servidor, e o equivalente ao modo offline (Atlas Device Sync) e o acesso direto pelo navegador (Data API) foram descontinuados em setembro de 2025.
- **Bancos híbridos, quando houver necessidade real:**
  - BigQuery para relatórios e análises do negócio (cópia automática, sem mexer no app);
  - PostgreSQL só se o financeiro da cobrança pedir (notas fiscais, conciliação).
- **Regra:** cada dado tem um único banco dono; os outros recebem cópias.
- **Proteção contra dependência:** toda a conversa com o banco fica em `nucleo/backend.js`. Trocar de banco mexeria principalmente nesse módulo.

### D10. Carregar só o que está na tela (8 out. 2026, planejado)
- **Contexto:** o link do jogador e a gestão do grupo baixavam todas as rodadas da história do grupo. Isso deixa o app mais lento a cada mês, principalmente com sinal fraco, e aumenta as leituras cobradas pelo Firebase.
- **Decisão:**
  - **Link do jogador:** busca só a próxima rodada (e a presença dela).
  - **Aba Rodada (administrador):** as próximas rodadas já criadas e as **últimas 4**. Presença, times e partidas de uma rodada só carregam quando ela é escolhida.
  - **Nova aba Histórico:** busca rodadas por período (mês ou intervalo de datas), de 20 em 20. Ao abrir uma rodada, mostra a lista, os times, as partidas e a votação dela.
  - **Partidas** saem da ficha da rodada e vão para uma subpasta (`rodadas/{id}/partidas`), como já acontece com as presenças. A ficha da rodada fica leve.
- **Muda as regras do Firebase:** sim (novo caminho das partidas). Rodadas antigas são migradas na primeira vez que um administrador abre o grupo.

### D11. Totais prontos por mês (8 out. 2026, planejado)
- **Contexto:** ranking e caixa são calculados lendo todas as partidas e lançamentos a cada abertura.
- **Decisão:** cada grupo ganha uma ficha de resumo por mês (`resumos/{AAAA-MM}`): por jogador, jogos, vitórias, empates, derrotas, gols ou pontos, destaques e bagres; e os totais do caixa.
  - Salvar ou apagar uma partida (ou um lançamento) atualiza o resumo do mês na mesma gravação segura (D4).
  - O ranking do ano soma até 12 resumos.
  - Corrigir algo antigo recalcula só aquele mês. O administrador tem um botão **Recalcular** como rede de segurança.
  - Grupos existentes ganham os resumos na primeira abertura do ranking depois da atualização.
- **Limite consciente:** enquanto não houver servidor, quem calcula é o celular do administrador; as regras garantem quem grava, não a conta. Com as Cloud Functions (D5), o recálculo passa para o servidor.
- **Depende de:** D4 (transações) e D10 (partidas em subpasta).

## Mapa do código (pasta `src/`)
| Pasta | O que tem |
|---|---|
| `main.js` | Ponto de partida: carrega os módulos na ordem certa e inicia o app |
| `estilos/app.css` | CSS do app (tokens do Design System e componentes) |
| `i18n/` | `pt-BR.js` (textos), `index.js` (`tx` e `tp`), `formatos.js` (local e moeda) |
| `nucleo/` | `util.js` (utilidades, sem dependências), `links.js`, `estado.js` (estado e assinaturas do banco), `backend.js` (Firebase ou demonstração, carregando dos botões), `edicoes.js` (gravações otimistas e presença) |
| `dominio/` | Regras de negócio sem tela: `esportes.js` (catálogo), `grupo.js`, `rodadas.js`, `caixa.js`, `sorteio.js`, `whatsapp.js` (textos para compartilhar) |
| `ui/` | `render.js` (desenho da tela e abas), `tema.js`, `dialogos.js` |
| `telas/` | Uma tela por arquivo: `apresentacao`, `login`, `convite`, `grupos`, `rodada`, `grupo-form`, `grupo`, `jogadores`, `partida`, `ranking`, `caixa`, `votacao`, `publico-rodada`, `publico-voto` |
| `acoes.js` | O que cada botão (`data-a`) faz |
| `eventos.js` | Cliques, teclas e campos: liga a tela às ações, com o carregando dos botões |
| `rotas.js` | Endereços (`#/p/...`, `#/g/...`) e carregamento de dados por tela |
| `inicio.js` | Inicialização: escolhe Firebase ou demonstração e acompanha o login |
| `pwa.js` | Instalação do app, barra sem internet e atualização de versão |

**Regra de ordem:** `nucleo/util.js`, `i18n/formatos.js` e `i18n/pt-BR.js` não importam nada do app. Código que roda direto ao carregar um módulo (fora de funções) só pode usar esses módulos. O resto do app roda dentro de funções, chamadas depois que tudo carregou.

## Entrega: o que atualizar no projeto do Claude
Os agentes leem o app pelo projeto do Claude, e não pelo GitHub. Por isso, toda proposta de mudança atualiza o projeto na mesma entrega, antes de o link ser passado ao Kleber:

| No projeto do Claude | Vem de (GitHub) | Quando |
|---|---|---|
| `app/index.html` | `dist/index.html` (resultado do `npm run build`) | toda versão |
| `app/sw.js` e `app/manifest.webmanifest` | `site/sw.js` e `site/manifest.webmanifest` | toda versão (o `sw.js` muda a `VERSION`) |
| `app/firestore.rules` | `firestore.rules` | quando as regras mudarem |
| `app/LEIA-ME.md` | `LEIA-ME.md` | quando o uso mudar |
| `VISAO-DO-PRODUTO.md`, `docs/ARQUITETURA.md`, `DESIGN-SYSTEM.md` | `docs/` | quando mudarem |
| `testes/ROTEIRO-DE-TESTES.md` e `testes/testes_app.py` | `testes/` | quando mudarem |

Depois de enviar, conferir que cada arquivo do projeto ficou igual ao do GitHub.
