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
- **Montagem:** o **esbuild** junta os módulos num único `index.html` (com o CSS e o código embutidos, sem minificar, para continuar legível). Desde a pelada-v24 (D15), o GitHub roda `npm run build` a cada Merge e publica a pasta `dist/` no **Firebase Hosting**. Arquivos fixos (service worker, manifesto, ícones) e o modelo da página ficam em `site/`.
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
  - **Etapa 2 em diante:** cada tela vira componente com **TypeScript** e **Preact** (versão leve do React, boa para celular), uma tela por entrega. **Começou na pelada-v14** com o link público do jogador (`src/telas/PublicoRodada.tsx`). Nos componentes, o Preact escapa os textos sozinho: não há `innerHTML`.
  - O TypeScript é conferido em toda proposta (`npm run checar`). Componentes leem o estado do app só dentro das funções (regra de ordem).
- **Por quê:** fazer em etapas mantém o risco baixo. Os testes automáticos simulam o usuário, então valem durante toda a migração.

### D3. Vários idiomas desde a reorganização (8 out. 2026)
- **Decisão:** todo texto da tela sai do código para um dicionário por idioma (`src/i18n/pt-BR.js`), com `pt-BR` como idioma base. Moeda, datas e números usam uma configuração única de local (`src/i18n/formatos.js`).
- **Como usar no código:** `tx('publico.vou')` devolve o texto; `tx('publico.cancelado', {data})` troca `{data}`; `tp('voto.votos', n)` escolhe singular ou plural. Texto sem tradução gera aviso, e os testes falham.
- **Como migra:** na etapa 1 entraram a base, os formatos, os avisos de conexão e as duas telas públicas (link da rodada e da votação), que são o que o jogador vê. As demais telas migram junto com a componentização de cada uma. Texto novo já nasce no dicionário.
- **Por quê:** a visão é "qualquer pessoa no mundo". Fazer agora custa pouco; depois custaria refazer telas inteiras.

### D4. Rodada gravada só no que mudou (8 out. 2026, feito na pelada-v14)
- **Contexto:** sorteio, placar e lista ficam no mesmo registro da rodada. Antes, cada gravação reescrevia o registro inteiro: se dois administradores mexiam ao mesmo tempo, a última gravação apagava a outra.
- **Decisão:** gravar só os campos que mudaram (`editRod` compara antes e depois). As partidas são acrescentadas e apagadas uma a uma (`addMatch` e `delMatch`), sem reescrever a lista.
- **Por que não "transações":** a ideia inicial era usar transações do Firestore, mas elas **não funcionam sem internet**, e o placar precisa ser salvo na quadra com sinal fraco. A gravação por campo funciona offline e resolve o caso comum (cada pessoa mexendo numa coisa diferente).
- **Limite consciente:** se duas pessoas mudarem o mesmo campo ao mesmo tempo (as duas sorteando os times, por exemplo), vale a última gravação.
- **Teste:** com uma cópia desatualizada da rodada, fechar a lista não apaga uma partida salva antes.

### D5. Recursos pagos controlados no servidor (planejado)
- **Decisão:** quando houver cobrança, o que cada **conta de organizador** pode usar (o "plano", decisão do Kleber em 13/10/2026: o plano é por conta e vale para todos os grupos dela, ver `PLANOS-E-CONCORRENTES.md` e o épico KAN-114) fica num registro que **só a área administrativa ou o servidor grava** (Cloud Function ligada ao meio de pagamento). As regras do Firebase conferem o plano antes de liberar cada recurso pago. A tela só esconde ou mostra; quem garante é a regra.
- **Por quê:** se a liberação ficasse só na tela, qualquer pessoa com conhecimento técnico usaria o recurso sem pagar.

### D6. Segurança como requisito de cada entrega (8 out. 2026)
- Toda mudança nas regras do Firebase passa pela revisão do agente de Segurança e do arquiteto antes do Merge.
- Todo texto vindo do banco passa pela função de escape antes de ir para a tela.
- **Identificadores** (nomes de documento) vindos do banco só são aceitos com letras, números, `_` e `-` (`idOk`, na leitura de toda coleção; e `idValido` nas regras de presença e voto), desde a pelada-v22 (KAN-76). Assim eles podem ir para atributos do HTML sem risco.
- Chaves de acesso só em segredos do GitHub, nunca no código. A conta que publica regras não lê dados.
- **Próximos reforços:** Firebase App Check (só o app oficial fala com o banco) e limites de gravação contra abuso, ambos antes de começar a cobrar.
- **Presença pelo link (pelada-v25):**
  - **ordem e nome (KAN-78):** a hora da confirmação (`t`) precisa ser um número, não pode ser do futuro nem de mais de 6 horas atrás (folga para quem confirmou sem sinal). Sem mudar a resposta, a hora não muda; ao mudar, nunca volta para trás. Pelo link, nome, marca de avulso e posição de uma presença não mudam. Administradores continuam corrigindo tudo;
  - **datas (KAN-77):** jogo fixo ainda sem documento só aceita presença de ontem até 15 dias à frente;
  - **caixa no documento público (KAN-79):** mensalidade e diária, como a chave Pix, não podem ser criadas nem alteradas em `cfg` do grupo. Grupos antigos podem manter o valor igual ou apagá-lo (a migração apaga ao abrir o grupo).
- **Limites contra abuso (KAN-89), em duas fases:**
  - **Fase 1, só com as regras (pelada-v23, sem custo novo):** contadores que só sobem de 1 em 1, gravados na mesma operação do que contam, e que as regras conferem com `getAfter`. Avulso novo pelo link soma em `rodadas/{rid}/limites/avulsos` (padrão 30 por rodada); grupo novo soma em `contas/{uid}` (padrão 20 por conta, inativar não devolve vaga). Nomes de jogador, avulso e grupo novo com até 40 letras. Os números ficam em `sistema/limites` (`avulsosPorRodada`, `gruposPorConta`), editados só pelo console do Firebase; sem o documento valem os padrões, iguais em `firestore.rules` e `src/dominio/limites.ts` (um teste confere). Administradores não têm limite de avulsos e podem zerar o contador da rodada. Quem enche a lista de propósito trava só os avulsos novos daquela rodada pelo link; o organizador vê o aviso e continua adicionando por dentro.
  - **Fase 2, com Cloud Functions (plano Blaze, quando houver cobrança):** votos por minuto, bloqueio temporário por aparelho e aviso ativo ao organizador. Cartão separado.
- **App Check (KAN-88), em duas fases:**
  - **Fase 1, observar (pelada-v21):** o app oficial manda um comprovante invisível do reCAPTCHA Enterprise (chave em `window.APP_CHECK_KEY`, no `site/index.html`, válida só no domínio `nossosjogos.netlify.app`). O Firebase só mede; nada é bloqueado. Se o script do App Check não carregar, o app segue funcionando.
  - **Fase 2, bloquear (antes de cobrar):** depois de 7 dias com mais de 99% das chamadas verificadas, o Kleber liga "Aplicar" (Enforce) para o Firestore no console do App Check.
  - **Prévias das propostas** (`CONTEXT=deploy-preview`; desde a v24, no Firebase Hosting) passam a rodar em **modo demonstração**: não tocam nos dados reais e não dependem da chave (que não vale nos endereços de prévia). O GitHub confere isso a cada proposta.

### D7. Orçamento de desempenho (8 out. 2026)
Medido a cada versão, no celular de 390px:
- **Tamanho do app transferido** (comprimido): até **80 KB**, sem contar a biblioteca do Firebase. A montagem falha se passar. Na pelada-v13: 53,6 KB (era 49,4 KB na v12; a diferença é a formatação legível do código). Na pelada-v14: cerca de 60 KB com o Preact e a aba Histórico (o número exato sai na montagem do GitHub).
- **Desde a pelada-v19 (KAN-105)** o site publicado vai **compactado** (65,5 KB; sem compactar seriam 77,6 KB), com mapa de origem (`main.js.map`) para depurar. A cópia legível sai em `montagem-legivel/index.html` e é a que vai para `app/index.html` no projeto, para os agentes lerem.
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

### D10. Carregar só o que está na tela (8 out. 2026; link do jogador, aba Rodada e Histórico feitos na pelada-v14; partidas em subpasta na pelada-v18)
- **Contexto:** o link do jogador e a gestão do grupo baixavam todas as rodadas da história do grupo. Isso deixa o app mais lento a cada mês, principalmente com sinal fraco, e aumenta as leituras cobradas pelo Firebase.
- **Decisão:**
  - **Link do jogador:** busca só a próxima rodada (e a presença dela).
  - **Aba Rodada (administrador):** as próximas rodadas já criadas e as **últimas 4**. Presença, times e partidas de uma rodada só carregam quando ela é escolhida.
  - **Nova aba Histórico:** busca rodadas por período (mês ou intervalo de datas), de 20 em 20. Ao abrir uma rodada, mostra a lista, os times, as partidas e a votação dela.
  - **Partidas** saem da ficha da rodada e vão para uma subpasta (`rodadas/{id}/partidas`), como já acontece com as presenças. A ficha da rodada fica leve.
- **Como ficou na pelada-v14:**
  - link do jogador: consulta as rodadas a partir de ontem, no máximo 6;
  - aba Rodada: duas consultas, as próximas (até 12) e as recentes (até 5, para mostrar as últimas 4 mais o jogo de hoje);
  - ranking: carrega todas as rodadas só enquanto a aba está aberta (até os totais por mês da D11); caixa: só as rodadas do mês escolhido; votação antiga: só a rodada dela;
  - Histórico: busca paginada (`B.pagina`), sem ficar ouvindo o banco;
  - sorteio: a variação de parceiros passa a considerar as rodadas da janela (as mais recentes, que já eram as de maior peso).
- **Muda as regras do Firebase:** a parte feita na v14, não. As partidas em subpasta (v18), sim.
- **Como ficou na pelada-v18 (KAN-86):**
  - partida em `rodadas/{id}/partidas/{idPartida}`; a ficha da rodada guarda só a contagem `np`;
  - a aba Partida ouve só as partidas da rodada aberta; o Histórico lê as partidas ao abrir a rodada; o link do jogador mostra o placar (só leitura);
  - regras: leitura aberta como a da rodada; só administradores gravam; **partida só é criada se não existe e só é apagada se existe** (nunca editada). Assim, se dois aparelhos fazem a mesma coisa, o segundo lote é recusado inteiro e nada conta em dobro;
  - migração: na primeira abertura de um administrador depois da atualização, lendo do servidor (nunca só do aparelho), copia as partidas antigas para a subpasta, tira da ficha só os itens copiados e grava `privado/migracao` = `{v:18}`. Pode rodar em dois aparelhos ao mesmo tempo; se falhar, tenta de novo depois de 1 minuto;
  - transição: um aparelho ainda com a v17 em cache que salvar partida dentro da ficha tem a partida movida na hora pelo próximo administrador com a v18.

### D11. Totais prontos por mês (8 out. 2026; feito na pelada-v18)
- **Contexto:** ranking e caixa são calculados lendo todas as partidas e lançamentos a cada abertura.
- **Decisão:** cada grupo ganha uma ficha de resumo por mês (`resumos/{AAAA-MM}`): por jogador, jogos, vitórias, empates, derrotas, gols ou pontos, destaques e bagres; e os totais do caixa.
  - Salvar ou apagar uma partida (ou um lançamento) atualiza o resumo do mês na mesma gravação segura (D4).
  - O ranking do ano soma até 12 resumos.
  - Corrigir algo antigo recalcula só aquele mês. O administrador tem um botão **Recalcular** como rede de segurança.
  - Grupos existentes ganham os resumos na primeira abertura do ranking depois da atualização.
- **Limite consciente:** enquanto não houver servidor, quem calcula é o celular do administrador; as regras garantem quem grava, não a conta. Com as Cloud Functions (D5), o recálculo passa para o servidor.
- **Depende de:** D4 (transações) e D10 (partidas em subpasta).
- **Como ficou na pelada-v18 (KAN-87):**
  - ficha `resumos/{AAAA-MM}`: `jog.{pid}` (j, v, e, d, g, mvp, bagre), `jogos.{idPartida}` (placar, para o histórico do ranking) e `cx` (entradas e saídas em centavos);
  - cada partida, lançamento e votação encerrada/reaberta grava num **lote** (tudo ou nada, também sem internet) junto com o ajuste da ficha, usando o **incremento do servidor**: dois administradores ao mesmo tempo somam os dois (no lugar das transações da D4, que não funcionam sem internet);
  - o Ranking ganhou filtro de **ano** (até 12 fichas) e **mês** (1 ficha), além de "Todos os anos"; o padrão é o ano atual;
  - **Recalcular** (aba Ranking) refaz as fichas do período lendo as partidas no servidor;
  - **Caixa:** saldo, entradas e saídas continuam calculados dos lançamentos, que a tela já carrega inteiros por causa das pendências (exato mesmo com aparelho antigo). A ficha `cx` é mantida para quando o caixa passar a carregar só o mês;
  - a regra fica em `src/dominio/resumos.ts`, com teste próprio (`testes/regras/ranking.test.mjs`, compara com o cálculo antigo);
  - riscos aceitos: Recalcular ao mesmo tempo que outro administrador salva uma partida pode sobrescrever aquele incremento (basta recalcular de novo); aparelho com a v17 em cache que encerrar votação ou apagar rodada não ajusta as fichas até alguém usar Recalcular.

### D16. Planos e área administrativa sem servidor (13 out. 2026, pelada-v26, KAN-115 e KAN-116)
- **Decisão:** o plano é por conta (`contas/{uid}`: `plano`, `planoAte`), e o catálogo de planos fica em `sistema/planos`, com os padrões em `src/dominio/planos.ts`. O app pergunta pelo recurso (`temRecurso`), nunca pelo nome do plano. Validade vencida volta ao Grátis.
- **Quem grava o plano:** só o administrador do portal. Regra `adminPortal()`: login com o Google **e** identificador (uid) na lista escrita nas regras. Não depende de e-mail nem de nenhum campo do banco: só muda com uma proposta aprovada no GitHub.
- **Portal em site separado** (decisão do Kleber em 13/10/2026): `nosso-jogo-portal.web.app`, montado de `src/portal/` para `dist-portal/` e publicado pela mesma automação. Sem criação de conta, só Google. O app dos clientes não carrega nenhum código do portal, então uma falha no app não alcança a tela do portal. Isolamento total (projeto Firebase separado + servidor de ponte) fica para o plano Blaze. A própria conta grava só o contador de grupos e o último acesso, e as regras conferem campo a campo (`camposMudados()`).
- **Lista de clientes:** lida na hora pelo administrador do portal (fichas de conta, grupos, e-mail do dono no cadastro de administradores e a última rodada gravada de cada grupo). Funciona bem para dezenas ou poucas centenas de clientes; com mais, os números passam a vir de um resumo diário (KAN-118, com servidor).
- **Achado de segurança corrigido junto (KAN-133):** a coleção `grupos` era de leitura pública também para **listar**, então qualquer pessoa conseguia baixar nomes, dias e locais de todos os grupos. Agora qualquer pessoa lê **um** grupo (o link público continua igual), mas só o administrador do portal lista todos.

### D15. Hospedagem no Firebase Hosting, publicada pelo GitHub (13 out. 2026, pelada-v24)
- **Contexto:** em 10/10 o plano grátis do Netlify ficou sem créditos e pausou as publicações. O site no ar ficou na v19 enquanto os Merges da v20 à v23 aconteciam, e as regras do Firebase (publicadas pelo GitHub) seguiram em frente: a v19 passou a ser recusada ao pôr avulso pelo link e ao criar grupo. A correção temporária das regras (proposta #21) liberou de novo. Ninguém percebeu antes porque o "No ar" era anotado com base no Merge, sem conferir o site.
- **Decisão:**
  - o site passa a ser publicado no **Firebase Hosting** (`https://nosso-jogo-f4762.web.app`), no mesmo projeto do banco e no plano grátis (Spark), pela automação "Publicar o site" (`.github/workflows/publicar-site.yml`), com a mesma conta de serviço das regras. Desde 13/10/2026 essa conta tem só os papéis de publicar (**Administrador das regras do Firebase**, **Administrador do Firebase Hosting**, **Leitor de chaves de API**, **Leitor do Service Usage** e **Consumidor do Service Usage**). Antes tinha **Administrador do Firebase**, que também lia os dados dos grupos. A troca foi testada republicando regras e site;
  - a automação **confere no endereço oficial que a versão no ar é a do `site/sw.js`** e fica vermelha se não for. O "No ar" do `testes/VERIFICACOES-GITHUB.md` passa a vir dessa conferência;
  - as **prévias** das propostas saem num canal de prévia do Firebase Hosting (`.github/workflows/previa.yml`), em modo demonstração, com o link comentado na proposta e validade de 7 dias;
  - o **Netlify foi desligado** em 14/10/2026 (pelada-v28): site apagado, acesso ao GitHub removido e endereço antigo tirado do login e do App Check. O endereço `nossosjogos.netlify.app` deixou de existir, para ninguém continuar usando o app antigo (v19), sem as correções de segurança. Com isso, os limites contra abuso voltaram a ser obrigatórios nas regras (KAN-134).
- **Impacto para quem usa:** o endereço muda. Administradores entram de novo uma vez no endereço novo, e o tema e o "quem sou eu" do link são escolhidos de novo, porque o navegador guarda isso por endereço. Os dados dos grupos não mudam (o banco é o mesmo).
- **Próximo passo:** domínio próprio, depois da decisão do nome. Ele é ligado à mesma hospedagem, e o endereço `web.app` continua funcionando.
- **Para os agentes:** o endereço oficial é `https://nosso-jogo-f4762.web.app`. Não sugerir voltar ao Netlify.

### D14. Docker: não agora (8 out. 2026)
- **Contexto:** surgiu a pergunta se o Docker (o "contêiner" que embala um programa com tudo de que ele precisa para rodar num servidor) se encaixa no Nosso Jogo.
- **Decisão:** não usar Docker para rodar o app. O Nosso Jogo não tem servidor próprio: o site é entregue pelo Firebase Hosting (antes, Netlify) e banco e login ficam no Firebase, administrados pelo Google. Criar um servidor só para usar contêiner aumentaria custo, manutenção e superfície de ataque, sem ganho para o jogador.
- **Onde ele já aparece (e continua):** só como ferramenta de teste, nos testes automáticos do GitHub (imagem pronta do Playwright, com o navegador instalado).
- **Quando reavaliar:** se surgir um serviço próprio que o Firebase não cobre (pagamentos com regras complexas, relatórios pesados, integração com sistema externo). Mesmo assim, o primeiro passo continua sendo as funções do Firebase (D5), sem servidor e sem Docker. Contêiner só entra se esse serviço precisar de máquina dedicada, e de preferência num serviço gerenciado (ex.: Cloud Run), sem administrar servidor.
- **Para os agentes:** não sugerir Docker, Kubernetes ou servidor próprio antes de existir uma necessidade que se enquadre no "quando reavaliar".

### D13. Regras do Firebase testadas no emulador antes do Merge (8 out. 2026, pelada-v19, KAN-104)
- **Contexto:** as regras vão ao ar sozinhas no Merge, e o modo demonstração não as aplica.
- **Decisão:** tarefa `regras-firebase` no GitHub (`.github/workflows/testes.yml`) roda o emulador do Firestore com `testes/regras-firebase/regras.test.mjs` (21 casos: partidas, resumos, caixa, privado, Pix, presença pelo link, administradores). A proposta só fica verde se todos passarem; o resumo aparece como aviso na tarefa.
- **Regra de trabalho:** toda mudança nas regras entra com casos novos nesse arquivo.

### D12. Ficar em JavaScript/TypeScript e pagar a dívida técnica aos poucos (8 out. 2026)
- **Contexto:** a dúvida era se valeria trocar de linguagem para não acumular dívida técnica.
- **Decisão:** não trocar. Todo app web roda em JavaScript; o caminho certo é o **TypeScript** (JavaScript com tipos conferidos antes de ir para o ar), que já começou na v14. As funções no servidor, quando vierem, também serão em TypeScript: uma linguagem só no produto inteiro.
- **Onde está a dívida de verdade:** telas montadas como texto (`innerHTML`, onde um escape esquecido vira brecha), código sem tipos, um estado global que qualquer parte altera e regras de negócio sem teste próprio.
- **Como pagar, sem parar o produto:**
  1. **Tela mexida, tela migrada:** toda tela tocada por uma funcionalidade vira componente TypeScript + Preact na mesma entrega.
  2. **Uma fatia fixa por pacote:** cada entrega leva pelo menos um cartão de dívida técnica, indicado pelo arquiteto.
  3. **Painel medido a cada versão** (a montagem calcula sozinha; ver abaixo). Número que piora sem justificativa segura o Merge.
  4. **Prioridade:** primeiro o caixa e o link de votação (dinheiro e dados de pessoas de fora), e testes próprios das regras do sorteio e do ranking (o coração do produto).
- **Prazo estimado:** com 1 a 2 telas por entrega, todo o app em TypeScript em 8 a 10 pacotes.
- **O que faria mudar:** decisão de negócio por apps nativos nas lojas com recursos que o app web não tem. Mesmo assim, há caminhos que reaproveitam o código atual.

### Painel da dívida técnica
A montagem (`npm run build`) imprime estes números. Eles são registrados aqui a cada versão, e o arquiteto acompanha a tendência.

| Versão | Arquivos em TypeScript | Telas como componente | Pontos com `innerHTML` | Regras de negócio com teste próprio (de 5) | App comprimido |
|---|---|---|---|---|---|
| pelada-v14 | 1 de 39 | 1 de 15 | 28 | 0 | cerca de 67 KB |
| pelada-v15 | 2 de 40 | 1 de 15 | 28 | 0 | 68,8 KB |
| pelada-v16 | 3 de 41 | 1 de 15 | 28 | 0 | 70,8 KB |
| pelada-v17 | 4 de 42 | 1 de 15 | 28 | 1 (rodadas fixas) | 72,9 KB |
| pelada-v18 | 5 de 44 | 1 de 15 | 28 | 2 (+ ranking) | 77,3 KB ⚠️ perto do limite de 80 KB |
| pelada-v19 | 5 de 45 | 1 de 15 | 28 | 2 | 65,5 KB (compactado) |
| pelada-v20 | 5 de 45 | 1 de 15 | 28 | 2 | 65,9 KB |
| pelada-v21 | 5 de 45 | 1 de 15 | 28 | 2 | 66,1 KB |
| pelada-v22 | 5 de 45 | 1 de 15 | 28 | 2 | 66,4 KB |
| pelada-v23 | 6 de 46 | 1 de 15 | 28 | 2 | 67,3 KB |
| pelada-v24 | 6 de 46 | 1 de 15 | 28 | 2 | 67,4 KB |
| pelada-v25 | 6 de 46 | 1 de 15 | 28 | 2 | 67,5 KB |
| pelada-v26 | 7 de 47 | 1 de 15 | 28 | 2 | 68,0 KB (portal à parte) |
| pelada-v27 | 7 de 47 | 1 de 15 | 28 | 2 | 68,1 KB |
| pelada-v28 | 7 de 55 | 1 de 15 | 28 | 2 | 67,7 KB (ações divididas em 8 arquivos; textos do portal fora do app) |
| pelada-v29 | 7 de 55 | 1 de 15 | 28 | 2 | 70,5 KB (melhorias de uso no celular: KAN-71, 72, 73, 74, 127 e 130) |
| pelada-v40 | 9 de 57 | 2 de 15 | 24 | 3 | 76,7 KB (ficha do grupo, painel do link permanente e campo de horário, KAN-150 e 151; 3,3 KB do limite) |
| pelada-v39 | 9 de 56 | 2 de 15 | 24 | 3 | 75,5 KB (local numa linha só, KAN-146) |
| pelada-v38 | 9 de 56 | 2 de 15 | 24 | 3 | 75,3 KB (subtítulo cortado abre ao tocar, KAN-145) |
| pelada-v37 | 9 de 56 | 2 de 15 | 24 | 3 | 75,1 KB (texto longo quebra dentro da tela, KAN-144) |
| pelada-v36 | 9 de 56 | 2 de 15 | 24 | 3 | 75,0 KB (local com até 200 letras, KAN-143) |
| pelada-v35 | 9 de 56 | 2 de 15 | 24 | 3 | 75,0 KB (janela preenchida, Como chegar, aviso do Google; atenção: 5 KB do limite de 80) |
| pelada-v34 | 9 de 56 | 2 de 15 | 24 | 3 | 73,9 KB (senha igual à política do Firebase e textos do login no dicionário, KAN-10) |
| pelada-v33 | 9 de 56 | 2 de 15 | 24 | 3 | 73,3 KB (sortear de novo bloqueado com votação, KAN-138) |
| pelada-v32 | 9 de 56 | 2 de 15 | 24 | 3 | 73,0 KB (aviso de lista diferente só depois da presença chegar, KAN-137) |
| pelada-v31 | 9 de 56 | 2 de 15 | 24 | 3 | 73,0 KB (abrir o grupo sem piscar a aba Rodada, KAN-137) |
| pelada-v30 | 9 de 56 | 2 de 15 | 24 | 3 | 72,9 KB (Caixa como componente e regra do caixa com teste, KAN-135; confirmação do app, KAN-128) |

As 5 regras de negócio com teste próprio previsto: sorteio, ranking, pendências do caixa, rodadas fixas (próxima data) e apuração da votação. Os testes ficam em `testes/regras/` com o nome da regra (`sorteio.test.mjs`, `ranking.test.mjs`, `caixa.test.mjs`, `rodadas-fixas.test.mjs`, `votacao.test.mjs`) e rodam com `npm run regras` (testador do próprio Node, que lê TypeScript direto). Desde a pelada-v15 já existe o primeiro teste de regra, lista × times (`lista-sorteio.test.mjs`), e na v16 entrou jogadores por time e reservas (`times.test.mjs`); eles não entram na conta das 5. Para uma regra ganhar teste, ela precisa sair do código que lê o estado, como foi feito em `src/dominio/divergencia.ts`.

## Mapa do código (pasta `src/`)
| Pasta | O que tem |
|---|---|
| `main.js` | Ponto de partida: carrega os módulos na ordem certa e inicia o app |
| `estilos/app.css` | CSS do app (tokens do Design System e componentes) |
| `i18n/` | `pt-BR.js` (textos), `index.js` (`tx` e `tp`), `formatos.js` (local e moeda) |
| `nucleo/` | `util.js` (utilidades, sem dependências), `links.js`, `estado.js` (estado e assinaturas do banco), `backend.js` (Firebase ou demonstração, carregando dos botões), `edicoes.js` (gravações otimistas e presença) |
| `dominio/` | Regras de negócio sem tela: `esportes.js` (catálogo), `grupo.js`, `rodadas.js`, `caixa.js` (configuração do caixa), `caixa-regras.ts` (pendências do mês e totais, com teste próprio desde a pelada-v30), `sorteio.js`, `whatsapp.js` (textos para compartilhar), `limites.ts` (limites contra abuso) |
| `ui/` | `render.js` (desenho da tela e abas), `tema.js`, `dialogos.js` (janelas; desde a pelada-v30 também a janela de confirmação do app, `confirmou()`, no lugar do `confirm()` do navegador) |
| `telas/` | Uma tela por arquivo: `apresentacao`, `login`, `convite`, `grupos`, `rodada`, `historico`, `grupo-form`, `grupo`, `jogadores`, `partida`, `ranking`, `votacao`, `publico-voto` e os componentes `PublicoRodada.tsx` e `Caixa.tsx` (pelada-v30, KAN-135) (link do jogador; `publico-rodada.js` guarda o "quem sou eu" do aparelho) |
| `acoes.js` e `acoes/` | O que cada botão (`data-a`) faz, dividido por assunto desde a pelada-v28: `conta`, `grupo`, `rodada`, `jogadores`, `partida`, `caixa`, `votacao` e `publico` |
| `portal/` | Portal do Nosso Jogo, site separado (`main.js`, `tela.js` e `textos.js`, com dicionário próprio) |
| `eventos.js` | Cliques, teclas e campos: liga a tela às ações, com o carregando dos botões |
| `rotas.js` | Endereços (`#/p/...`, `#/g/...`) e carregamento de dados por tela |
| `inicio.js` | Inicialização: escolhe Firebase ou demonstração e acompanha o login |
| `pwa.js` | Instalação do app, barra sem internet e atualização de versão |

**Regra de ordem:** `nucleo/util.js`, `i18n/formatos.js` e `i18n/pt-BR.js` não importam nada do app. Código que roda direto ao carregar um módulo (fora de funções) só pode usar esses módulos. O resto do app roda dentro de funções, chamadas depois que tudo carregou.

## Entrega: o que atualizar no projeto do Claude
Os agentes leem o app pelo projeto do Claude, e não pelo GitHub. Por isso, toda proposta de mudança atualiza o projeto na mesma entrega, antes de o link ser passado ao Kleber:

| No projeto do Claude | Vem de (GitHub) | Quando |
|---|---|---|
| `app/index.html` | `montagem-legivel/index.html` (cópia legível gerada pelo `npm run build`; o `dist/` publicado vai compactado) | toda versão (anotar também a linha do Painel da dívida técnica) |
| `app/sw.js` e `app/manifest.webmanifest` | `site/sw.js` e `site/manifest.webmanifest` | toda versão (o `sw.js` muda a `VERSION`) |
| `app/firestore.rules` | `firestore.rules` | quando as regras mudarem |
| `app/LEIA-ME.md` | `LEIA-ME.md` | quando o uso mudar |
| `REGRAS.md` | `docs/REGRAS.md` | toda entrega que mudar uma regra ou o mapa de impacto (desde 15/10/2026) |
| `VISAO-DO-PRODUTO.md`, `docs/ARQUITETURA.md`, `DESIGN-SYSTEM.md` | `docs/` | quando mudarem |
| `testes/ROTEIRO-DE-TESTES.md` e `testes/testes_app.py` | `testes/` | quando mudarem |
| `testes/VERIFICACOES-GITHUB.md` | `testes/` (resultado das verificações do GitHub e do site no ar, que os agentes não enxergam) | toda entrega (ao abrir a proposta) e de novo depois do Merge |

Depois de enviar, conferir que cada arquivo do projeto ficou igual ao do GitHub.
