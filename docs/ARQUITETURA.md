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
- **Desde a pelada-v47 (KAN-162), país, moeda e fuso:** decidido com o Kleber em 16/10.
  - **Idioma, formato, moeda e fuso são coisas separadas** em `src/i18n/formatos.js`:
    - `LOCAL`: idioma dos textos, hoje só pt-BR;
    - `FORMATO`: ordem da data e separadores, do país do grupo;
    - `MOEDA` e `FUSO`: do grupo.
    `definirRegiao()` troca tudo quando o grupo carrega (`rotas.js`). Fora de um grupo, valem os da conta.
  - **O país da conta** é pedido no cadastro, já sugerido pelo **fuso** do aparelho, no celular e no computador. O fuso vem antes do idioma porque muito computador no Brasil está em inglês. Fica em `usuarios/{uid}` (`pais` e `formato`).
  - **O grupo nasce com país, moeda, fuso e formato do organizador** e guarda uma cópia em `cfg`. Assim, mudar o país da conta não troca o símbolo do caixa antigo. Trocar a moeda do grupo avisa que os valores não são convertidos.
  - **Grupo antigo, sem país:** Brasil, Real e o relógio do aparelho, como antes.
  - **"Agora" segue o fuso do grupo** (`agora()`): o jogo termina na hora do lugar, para quem abre de qualquer fuso.
  - **A tabela de países** (`dominio/paises.ts`, 44 países) traz código do telefone, quantidade de dígitos, moeda, formato e fusos. Os nomes de países e moedas vêm do navegador (`Intl.DisplayNames`), no idioma do app, e não ocupam o dicionário.
  - **Peso:** a tabela vem só com a gestão. O link do jogador lê o formato já gravado no grupo (`dominio/regiao.ts`, sem a tabela) e o telefone com a regra de cada país fica em `dominio/telefone.ts`, fora do link.
  - **Por que não uma biblioteca de telefones** (libphonenumber): ela pesa mais que o app inteiro. A tabela leve, com código e quantidade de dígitos, pega a maioria dos erros.

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
  - **Fase 1, observar (pelada-v21):** o app oficial manda um comprovante invisível do reCAPTCHA Enterprise (chave em `window.APP_CHECK_KEY`, no `site/index.html`, que o portal também usa. Desde a pelada-v42 é a chave **Nosso Jogo web 2** (`6LdSJ_Et…`), com os domínios `nosso-jogo-f4762.web.app`, `nosso-jogo-f4762.firebaseapp.com` e `nosso-jogo-portal.web.app`. A chave antiga (`6LczNOYt…`) só valia no Netlify; a tela do Google não gravava a troca de domínios, e por isso todas as chamadas davam "ReCAPTCHA error": 0% verificadas de 9 a 15/10). O Firebase só mede; nada é bloqueado. Se o script do App Check não carregar, o app segue funcionando.
  - **Incidente de 15/10/2026:** o Aplicar foi ligado sem olhar as métricas, e o login caiu no site e no portal por cerca de 10 minutos, até ser desligado. Lição: o Aplicar só entra depois de ver o gráfico do App Check com mais de 99% verificadas.
  - **Fase 2, bloquear (antes de cobrar):** depois de 7 dias com mais de 99% das chamadas verificadas, o Kleber liga "Aplicar" (Enforce) para o Firestore no console do App Check.
  - **Prévias das propostas** (`CONTEXT=deploy-preview`; desde a v24, no Firebase Hosting) passam a rodar em **modo demonstração**: não tocam nos dados reais e não dependem da chave (que não vale nos endereços de prévia). O GitHub confere isso a cada proposta.

### D7. Orçamento de desempenho (8 out. 2026)
Medido a cada versão, no celular de 390px:
- **Tamanho do app transferido** (comprimido): até **80 KB**, sem contar a biblioteca do Firebase. A montagem falha se passar. Na pelada-v13: 53,6 KB (era 49,4 KB na v12; a diferença é a formatação legível do código). Na pelada-v14: cerca de 60 KB com o Preact e a aba Histórico (o número exato sai na montagem do GitHub).
- **Desde a pelada-v19 (KAN-105)** o site publicado vai **compactado** (65,5 KB; sem compactar seriam 77,6 KB), com mapa de origem (`main.js.map`) para depurar. A cópia legível sai em `montagem-legivel/index.html` e é a que vai para `app/index.html` no projeto, para os agentes lerem.
- **Primeira tela desenhada** em modo demonstração: até **1,5 segundo** no ambiente de testes. É uma das verificações do roteiro. Na pelada-v13: cerca de 0,5 segundo.
- **Desde a pelada-v41 (KAN-149)** o código é dividido em pedaços: o `index.html` traz o ponto de partida, o código comum vai em `chunks/chunk-*.js` (baixado junto, com `modulepreload`) e a gestão em `chunks/admin-*.js`, que só baixa para quem entra com conta (`src/admin.js`, carregado por `src/nucleo/carga-admin.js`). Os nomes levam um código do conteúdo, então versão nova nunca mistura com cópia antiga do celular. O service worker guarda os pedaços públicos na instalação e os da gestão só nos aparelhos que já usaram a gestão. Na v41: **link do jogador 44,8 KB** (era 77,1 KB) e app inteiro 79,6 KB.
- Limites desde a v41: **link do jogador até 50 KB** e app inteiro até 80 KB. **Desde a v43 o total vai até 85 KB** (justificativa: a divisão em pedaços custa cerca de 2,5 KB, e os componentes em Preact são um pouco maiores que o HTML em texto; só quem administra baixa essa parte, e o link do jogador continua abaixo de 50 KB). Na v43: link do jogador 46,0 KB, total 80,9 KB. A montagem falha se qualquer um passar. Dividir custa cerca de 2,5 KB a mais no total (dois arquivos comprimem um pouco pior), mas só quem administra baixa essa parte. Próxima folga, se o total apertar: separar o dicionário da gestão e os estilos da página inicial.
- **Desde a v46, o total vai até 90 KB** (importação da planilha). **Desde a v47, até 95 KB:** a tabela de países do KAN-162 (cerca de 3 KB), que vem só com a gestão. Na v47: link do jogador 45,1 KB e total 91,5 KB.
- **Desde a v53 (KAN-175), o orçamento mede o que baixa ao abrir cada parte.** Os 95 KB valem para o que baixa ao abrir a gestão (link + pedaço `admin` e o que ele importa direto). A aba Partida (`src/partida.ts`) e a página de apresentação (`telas/apresentacao.js`) viraram pedaços sob demanda, com até **15 KB cada**. A Partida baixa sozinha 1,5 s depois de abrir a gestão, e o service worker a guarda com a gestão, então abre na hora e funciona sem sinal na quadra. A apresentação aparece para o visitante sem esperar a gestão. Na v53: link do jogador 47,2 KB, ao abrir a gestão 91,0 KB, Partida 3,7 KB, apresentação 3,4 KB, tudo somado 98,0 KB. Dividir em mais arquivos custa cerca de 2,4 KB no total, porque cada arquivo comprime separado. Próximas candidatas a sob demanda: Histórico, Caixa e Votação.
- **Desde a v73 (KAN-205), os textos de cada parte sob demanda vão junto com ela** (`src/i18n/pt-BR-caixa.ts`, `-grupo`, `-ranking`, `-votacao`, `-partida`, `-importar`, `-planos`; cada parte chama `juntarTextos` ao chegar), em vez de ficarem no dicionário da gestão. A aba Grupo virou sob demanda na v71. Na v73: ao abrir a gestão **90,9 KB** (era 94,1 na v70), folga de 4,1 KB, acima dos 3 KB combinados. Regra: texto usado só por uma parte sob demanda mora no arquivo de textos dela.
- **Desde a v61 (KAN-180), Caixa, Histórico, Votação e Ranking também são sob demanda** (`src/abas/*.ts`, carregados por `carregarAba` em `src/admin.js`), como a Partida. Cada um traz a tela e as próprias ações, e baixa na primeira vez que a aba é aberta. O service worker guarda esses pedaços junto com a gestão, então eles abrem sem internet depois que a gestão foi usada uma vez. "Importar jogadores" já era sob demanda desde a v59.
  - Na v61: link do jogador 49,1 KB, ao abrir a gestão **88,9 KB** (era 94,4 KB na v60). Sob demanda: Caixa 3,4 KB, Histórico 2,4 KB, Votação 2,3 KB, Ranking 1,4 KB, Partida 6,1 KB, Importar 3,4 KB e apresentação 3,4 KB.
  - **Alvo: manter ao menos 3 KB de folga em cada limite.** Quando a folga cair abaixo disso, o próximo passo é mover mais uma parte para sob demanda (candidatas: aba Grupo e o dicionário da gestão), não subir o limite.
  - Se um pedaço falhar sem internet, o navegador guarda a falha até a página ser recarregada. Por isso o aviso pede para recarregar.
- **Desde a v63 (KAN-183), o link do jogador não traz a tela de entrar nem a votação.** A tela de entrar e criar conta (`src/entrar.ts`: tela, ações e textos `login.*`, `senha.*` e `auth.*`, em `i18n/pt-BR-entrar.ts`) e a votação pública (`telas/publico-voto.js`) baixam só quando são abertas. O convite de administrador usa a mesma tela de entrar.
  - Na v63: **link do jogador 45,4 KB** (era 49,8 KB), ao abrir a gestão 85,4 KB. Sob demanda: entrar 4,1 KB e votação pública 1,3 KB.
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

- **Lista dentro de lista (pelada-v49, KAN-167):** o Firestore não grava uma lista que tem outra lista dentro, e o modo demonstração aceitava. Por isso, as posições criadas e os pares separados se perdiam sem que os testes percebessem.
  - Agora `nucleo/dados-banco.ts` converte nos dois bancos, na entrada e na saída de `backend.js`: na gravação, `[[a, b]]` vira `[{ __lista: [a, b] }]`; na leitura, volta.
  - O modo demonstração recusa o que o Firestore recusa. **Regra para o futuro:** toda diferença conhecida entre o Firestore e o modo demonstração vira uma recusa no modo demonstração.

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

- **pelada-v67 (KAN-106):** o Caixa deixou de carregar todos os lançamentos. Carrega de 3 meses antes do mês escolhido em diante (`inicioDaJanela`; antes, se o A pagar começa antes) e tira o saldo das fichas `resumos.cx`. Fora da aba Caixa, a janela é a do mês atual (referência de valor fora do padrão). Recalcular e a migração leem todos os lançamentos do servidor na hora.

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

### D17. Testar gravação contra o Firestore de verdade (16 out. 2026, pelada-v50, KAN-170)
- **Contexto:** o defeito KAN-167 (posição que sumia ao recarregar) passou por todos os testes. O roteiro rodava no modo demonstração, que aceitava um formato que o Firestore recusa, e nenhum teste recarregava a página depois de gravar.
- **Decisão:**
  1. **Roteiro de gravação** (`testes/persistencia_app.py`): para cada tipo de dado, grava pela tela, espera chegar ao banco, recarrega e confere. No fim, entra de novo num navegador limpo e confere tudo.
  2. **Emulador no GitHub:** a tarefa `persistencia` (`.github/workflows/testes.yml`) roda esse roteiro com o app ligado ao emulador do Firebase (Firestore e Authentication). A montagem de teste define `window.FIREBASE_EMULADOR`, e `nucleo/backend.js` chama `useEmulator`. Nunca toca nos dados reais e não usa App Check.
  3. **Cobertura obrigatória:** `testes/tipos-gravados.mjs` lê do código cada tipo de dado gravado (GB/B.set, patch, del e lotes). `testes/persistencia-cobertura.json` liga cada tipo a um caso, e a conferência da entrega barra tipo novo sem caso.
  4. **Erro de gravação com aviso:** `wrapBackend` transforma erro na hora de montar a gravação em promessa recusada; `w()` avisa "Não foi possível salvar" e a tela relê o que está gravado.
  5. **Modo demonstração igual ao Firestore:** toda diferença conhecida vira recusa no modo demonstração (desde a v49, lista dentro de lista).
- **Prova:** com o formato antigo das posições recolocado de propósito, o roteiro falha (casos P03, P04, P07 e P19).
- **Agente de Qualidade:** passou a exigir "grava, recarrega e confere" e "sai, entra e confere" em todo caso de teste de algo que grava; dado perdido é gravidade Alta.

### D28. Afastamento: período em meses e isenção separada no caixa (28 out. 2026, pelada-v76, KAN-208)
- **Onde fica:** `privado/afast` guarda os afastamentos (`{id: {pid, mot, obs, de, ate, em, ign}}`, meses "AAAA-MM", `ate` vazio = até voltar). Todo administrador lê, porque a lista de presença precisa saber quem está afastado; só quem tem a permissão de Elenco grava. O link do jogador não lê nada daqui: o afastado continua aparecendo e pode confirmar.
- **"Não cobrar" no caixa:** a isenção fica em `privado/caixa.afIsen` (`{id: {pid, de, ate}}`), que só quem tem Caixa no Plano A grava. A mensalidade só deixa de ser cobrada nos meses que **os dois** cobrem (mesmo id). Assim, quem tem Elenco e não tem Caixa pode encurtar ou estender o afastamento, mas não estende a isenção; e "Voltou" ou apagar o afastamento encurta a isenção junto, mesmo sem a permissão de Caixa. Quando a pessoa tem as duas permissões, o app grava as duas fichas no mesmo lote.
- **Mês inteiro:** a regra trabalha só com o mês da mensalidade. Quando o grupo puder escolher o dia em que o mês começa (KAN-209), o afastamento continua igual.
- **Leve para a gestão:** as ações e a janela baixam juntas na primeira vez que alguém afasta (`acoes/afastamento-lote.ts` e `ui/AfastamentoJanela.tsx`, 2,6 KB); na gestão ficam só as regras, a etiqueta, a linha da ficha e o aviso da Rodada. Gestão 91,9 → 93,6 KB (folga de 1,4 KB do limite de 95).
- **Ficha do jogador:** ainda é HTML montado como texto (dívida do KAN-173); entrou só a linha do afastamento, e a janela nova já nasce componente.

### D27. Votação e janela de compartilhar como componentes; cabeçalho compacto só no CSS (28 out. 2026, pelada-v75, KAN-194, KAN-195, KAN-131)
- **Tela mexida, tela migrada:** a aba Votação e a janela Nova votação saíram de `telas/votacao-gestao.js` (HTML montado como texto) para `telas/Votacao.tsx` (TypeScript + Preact), com os mesmos `data-a` e `data-c`; a aba continua sob demanda (`abas/votacao.ts`, 2,9 KB). Os textos foram para `i18n/pt-BR-votacao.ts`, que chega com a parte.
- **Janela de compartilhar:** saiu de `dominio/whatsapp.js` para `ui/Compartilhar.tsx`. As ações importam `shareDlg` direto de lá, e não pelo `whatsapp.js`, porque o `whatsapp.js` também entra no link do jogador: os textos da janela (só da gestão) iriam junto e a montagem barra (o link tem de ficar abaixo de 50 KB).
- **Seletor de rodada:** o texto de cada opção (data, hora, "fixo") virou `textoRodada()` em `ui/componentes.tsx`, usado pelo seletor das abas e pela Nova votação; o local nunca entra (KAN-146).
- **Cabeçalho compacto:** só CSS (`@media (max-width: 420px)` em `app.css`), sem mudar o HTML; o nome cortado reaproveita o mesmo "tocar para abrir" do subtítulo (`subtituloCompleto` em `ui/render.js` e o clique em `eventos.js`, agora também para `#gname`).
- **Números:** gestão 91,3 → 91,9 KB; textos fora do dicionário 282 → 268; arquivos sem tipos 47 → 46; telas como componente 10 → 11.

### D26. Totais do caixa à parte do ranking (28 out. 2026, pelada-v74, KAN-207)
- **Problema (auditoria de Segurança de 28/10):** os totais do caixa de cada mês ficavam no resumo do ranking (`resumos/{mês}.cx`), que todo administrador lê e grava; com as permissões da v69, quem não tem Caixa recebia e podia mudar esses totais.
- **Decisão:** o Firestore não esconde um campo de um documento, então os totais foram para `resumosCaixa/{mês}` (`mes`, `at`, `cx`), com leitura `podeVer(caixa)` e gravação `pode(caixa)`. O lançamento grava o caixa e o total do mês no mesmo lote. O resumo do ranking não aceita mais `cx`; o `cx` antigo só sai com a permissão de Caixa.
- **Mudança de lugar:** uma vez por grupo, o app do organizador soma o `cx` antigo de cada mês ao `resumosCaixa` e tira o `cx` do resumo, no mesmo lote, e marca `privado/migracao.cx`. Até isso acontecer, o `cx` antigo continua legível por todo administrador (como antes da v74). Recalcular sem a permissão de Caixa não lê o caixa e mantém o `cx` antigo como está.
- **Custo:** uma leitura a mais (todos os resumos) na primeira abertura do organizador; gestão 90,9 → 91,3 KB.

### D25. Administradores convidados por plano e quem só vê (28 out. 2026, pelada-v71, KAN-204)
- **Sem contar documentos:** as regras não contam convidados, então o grupo guarda a lista (`grupos/{gid}.adms`), na ordem de entrada. Entrar pelo convite é um lote: o cadastro do convidado e o nome dele no fim da lista, dentro do limite do plano do organizador (`entrouNaLista`). Sair também (`saiuDaLista`). Só o organizador arruma a lista; o app dele a mantém igual aos convidados que existem (`listaDeConvidados`), e grava a primeira vez nos grupos de antes da v71.
- **Quem grava:** toda regra de gravação que pedia `isMember` passou a pedir `adminAtivo`: o organizador, ou um convidado entre os primeiros da lista até o limite (`dentroDoLimite`). Ler continua com `isMember` e, para caixa, contatos e convite, `podeVer` (permissão sem o limite). Sem a lista (grupo antigo), todos gravam.
- **Na tela:** `soVer()` em `dominio/grupo.js` (respondido pela gestão, `nucleo/plano.ts`) desliga as permissões, põe a classe `so-ver` no corpo da página (o CSS esconde o que grava) e o `eventos.js` barra com aviso qualquer ação fora de uma lista de ações que só leem.
- **Aba Grupo sob demanda** (`abas/grupo.ts`), como Caixa e Ranking, para a gestão caber em 95 KB: 94,1 → 93,7 KB com tudo da v71.
- **Custo nas regras:** cada gravação de convidado lê a ficha do organizador e `sistema/planos` (até 2 leituras a mais, que se repetem dentro de um lote).

### D24. Planos valendo no app, sem servidor (28 out. 2026, pelada-v70, KAN-119)
- **Plano em vigor** (`dominio/planos.ts`, `situacao`, com teste): o pago do portal vale primeiro; sem ele, o teste (14 dias de `contas/{uid}.teste`) ou a transição (`sistema/planos.transicaoAte`) dão o Plano A até a data mais distante; sem nada, Grátis. As regras do Firebase repetem a conta (`planoPago`, `limiteGruposPlano`), com os limites 1/3/sem limite escritos nelas: mudar os limites no catálogo exige mudar as regras também.
- **Quem garante:** as regras recusam lançar no caixa, mudar `privado/caixa`, criar votação e ligar o controle de vagas sem o Plano A; ler continua (nada é apagado). O teste só é gravado uma vez, com a hora de agora.
- **Limite de grupos sem consulta:** as regras não contam documentos, então a conta guarda a lista dos grupos ativos (`contas/{uid}.ativos`). Criar e reativar só passam com o grupo entrando na lista, dentro do limite, na mesma gravação; sair da lista só com o grupo inativo. Conta de antes da v70 grava a lista uma vez (o app faz sozinho); essa primeira gravação não é conferida grupo a grupo, proteção mais fraca aceita.
- **Convidados e o link não leem a ficha do organizador:** o app do organizador mantém um espelho no grupo (`grupos/{gid}.pl`, `{id, ate, o, t}`), só para a tela. Se o Kleber mudar o plano no portal, o espelho atualiza quando o organizador abrir o app; as regras já valem na hora.
- **Recursos na tela:** `recurso(k)` em `dominio/grupo.js` responde pelo plano; quem calcula é a gestão (`nucleo/plano.ts`), que se registra ao carregar. O link do jogador não baixa nada dos planos.
- **Custo:** gestão 89,5 → 94,0 KB (perto do limite de 95 KB; as janelas Planos e escolher grupos baixam sob demanda, 1,6 KB); link do jogador 46,7 → 47,1 KB. Leituras novas: a ficha da conta e `sistema/planos` (uma vez por sessão, ao vivo). Nas regras, até 3 leituras a mais nas gravações de caixa e votação.
- **Fica para a v71:** limite de administradores convidados por plano (os mais novos só veem), que mexe em todas as regras de edição.

### D23. Permissões dos administradores convidados (27 out. 2026, pelada-v69, KAN-201)
- **Decisão (Kleber):** quatro permissões por convidado (Caixa, Notas, Elenco e contatos, Configurações), gravadas em `membros/{uid}.perm`. Convidado novo entra com tudo desligado; administrador sem `perm` (de antes) continua com tudo. Só o organizador muda.
- **Onde vale:** nas regras do Firebase (`pode(gid, k)` em `firestore.rules`), que são a proteção de verdade, e na tela (`posso(k)` em `dominio/grupo.js`, regra pura em `dominio/permissoes.ts`, com teste). Sem a permissão, o aparelho nem pede caixa, contatos ou convite (`syncPerm` em `rotas.js`), e ligar ou desligar vale na hora, porque o cadastro do administrador é acompanhado ao vivo.
- **Notas escondidas:** sem a permissão de notas, `privado/ratings` continua legível para o sorteio equilibrar; só gravar exige a permissão. Quem sabe abrir as ferramentas do navegador ainda vê as notas: proteção mais fraca, escolhida pelo Kleber para o sorteio continuar funcionando para todos.
- **Dia a dia no documento do grupo:** sem Configurações, só `cfg.place`, `cfg.time`, `cfg.novelty` e `cfg.foraPos` mudam (função `soDiaADia`).
- **Aba Grupo como componente:** `telas/grupo.js` virou `telas/GrupoTela.tsx` (mesmos `data-a`), com os textos no dicionário.
- **Custo:** gestão 87,7 → 89,5 KB; link do jogador 46,5 → 46,7 KB. Nenhuma leitura a mais (cada regra lê o cadastro do administrador, que o Firebase já lia para `isMember`).

### D22. Menos minutos no GitHub e conferência da origem do código (27 out. 2026)
- **Problema:** em 22/10 o GitHub Actions parou por falta de minutos na conta (repositório privado). Cada versão rodava o roteiro completo duas vezes (na proposta e de novo depois do Merge), e o teste de carga rodava toda segunda.
- **Decisão:** "Testes do app" roda só na proposta (e à mão), e uma atualização da proposta cancela a rodada velha. O teste de carga roda só quando as regras do Firebase ou o próprio teste mudam (e à mão). "Publicar o site" continua conferindo a versão no ar depois do Merge.
- **Conferência da origem** (`testes/conferir-main.mjs`): antes de cada versão nova, confere que cada mudança da main veio de uma proposta com Merge do Kleber, verificada pelo GitHub. É a proteção para o caso de o repositório ficar público: quem é de fora pode sugerir mudanças, mas só entra na main o que o Kleber aprovar, e qualquer coisa fora disso aparece aqui. Desde 27/10/2026 o repositório é público (decisão do Kleber, enquanto o app não é cobrado): o GitHub Actions fica sem limite de minutos.

### D21. Relógio de 12h/24h e semana pelo país do grupo (22 out. 2026, pelada-v65, KAN-163)
- **Decisão:** o horário continua gravado em 24h ("20:00"); só a exibição e o campo mudam. Se o país usa 12h vem do navegador (`Intl.DateTimeFormat(formato).resolvedOptions().hourCycle`, padrão CLDR), pelo formato que o grupo já guarda: sem biblioteca e sem a tabela de países no link do jogador. As contas (12h ↔ 24h, faixa com o período uma vez, ordem dos dias) ficam em `dominio/relogio.ts`, com teste.
- **Primeiro dia da semana:** lista curta de países que começam no domingo em `dominio/relogio.ts`, porque o Firefox não informa isso (`Intl.Locale.weekInfo`).
- **Campo de horário como componente:** `HoraCampo` em `ui/HoraCampo.tsx` (fora de `componentes.tsx`, porque os textos `hora.*` são da gestão e não podem entrar no link). O comportamento (setas, digitação, AM/PM) continua em `ui/hora.ts`, por escuta no documento. A Nova rodada monta o componente nos lugares `data-hora-raiz` (`montarHoras`).
- **Custo:** link do jogador 45,4 → 46,1 KB; gestão 85,4 → 86,9 KB. Nenhuma leitura a mais; regras do Firebase iguais.

### D20. Leitura confiável com internet ruim (21 out. 2026, pelada-v62, KAN-184)
- **Problema:** com a cópia offline do Firestore ligada, quem abria o link pela primeira vez com internet lenta recebia antes a resposta da cópia do aparelho ("documento não existe") e via "Grupo não encontrado". Um erro de rede também marcava a leitura como pronta, sem nova tentativa.
- **Decisão:**
  - A escuta de documento (`backend.js`, `sub`) inclui as mudanças de metadados. "Não existe" vindo só da cópia, com o aparelho online, é ignorado até o servidor responder (`esperarServidor`). O app só é avisado quando o conteúdo muda.
  - Toda assinatura (`estado.js`, `assinar`) repete depois de 1, 2 e 4 s em erros passageiros (`proximaTentativa`). Só depois de desistir a leitura conta como pronta, com a falha anotada em `S.falhou`.
  - As telas públicas mostram "Não foi possível carregar" com "Tentar de novo" (recarrega a página), e "Está demorando mais que o normal" depois de 12 s.
  - No modo demonstração, `window.__njFalhar` e `window.__njSegurar` simulam falha e lentidão para os testes.

### D19. Vagas para diaristas e avulsos garantidas nas regras (21 out. 2026, pelada-v59, KAN-63)
- **Decisão:** com o controle ligado no grupo (`cfg.vagasCtrl`), a presença pelo link de quem precisa de vaga (avulso, ou jogador com a marca pública `vaga`) só entra com `vagas.aberta` na rodada e somando 1 em `rodadas/{rid}/limites/vagas` na mesma gravação, até `vagas.max` (0 = sem limite). Quem estava dentro e sai pode devolver 1. É o mesmo desenho do contador de avulsos (KAN-89): sem servidor, conferido com `getAfter`.
- **Privacidade:** para o link esconder o diarista, a marca `vaga` fica no documento público do jogador. O app a ajusta sozinho a partir do tipo (`privado/caixa`), só com o controle ligado (`sincronizarVagas`). Exceção à regra de que o tipo é privado, aprovada pelo Kleber em 21/10/2026.
- **Sem abertura automática:** abrir num horário marcado precisaria de servidor (Blaze, KAN-174). O administrador abre na hora, com a sugestão do que falta para o mínimo (KAN-179).
- **Tamanho:** para a gestão continuar abaixo de 95 KB, "Importar jogadores" (KAN-159) passou a baixar só quando a janela abre (parte sob demanda `ImportarJogadores`, 3,4 KB), guardada pelo service worker como as outras partes da gestão.
- **v66 (KAN-197, auditoria de 27/10):** a descida do contador também exige o controle ligado e que o jogador precise de vaga, como a subida. Antes, a saída de um mensalista podia descer o contador e abrir vaga a mais.

### D18. Teste de carga no emulador e custo estimado (16 out. 2026, KAN-158)
- **Contexto:** o app nunca tinha sido medido com muita gente ao mesmo tempo. Três pontos recebem gravações de várias pessoas no mesmo instante: o contador de avulsos da rodada (`limites/avulsos`), o documento da rodada e os votos.
- **Decisão:** a tarefa **Teste de carga** (`.github/workflows/carga.yml`, script `testes/carga/carga.mjs`) sobe o emulador do Firestore com as regras de verdade e simula aparelhos diferentes fazendo as mesmas gravações do app. Ela roda toda segunda às 6h17, à mão (Actions → Teste de carga → Run workflow) e em toda proposta que mexe nas regras ou no próprio teste. O resultado aparece no resumo da execução e fica guardado como arquivo.
- **Resultado da primeira medição (16/10/2026, emulador no GitHub):**

  | Cenário | Resultado | Tempo (mediana / mais lento) |
  |---|---|---|
  | 50 confirmações em 10 s | 50 de 50 gravadas, nenhuma falha | 39 ms / 446 ms |
  | 40 avulsos ao mesmo tempo, limite 30 | exatamente 30 entraram e 10 receberam o aviso de limite; contador em 30 | 1.132 ms / 1.489 ms |
  | 30 votos ao mesmo tempo | 30 de 30 contados ao encerrar | 608 ms / 621 ms |
  | 2 administradores (sorteio + 10 marcações) | tudo gravado, nenhuma falha | 109 ms / 154 ms |
  | Abrir o link com a lista cheia (50 jogadores, 80 respostas) | 132 leituras | 112 ms |

  - **Ponto de atenção:** o contador de avulsos é o mais lento (até 1,5 s com 40 pessoas no mesmo segundo), porque todas as gravações passam pelo mesmo documento. Continua abaixo do critério de 2 s e só acontece com avulsos novos. Se um dia passar disso, dá para dividir o contador em partes.
  - O emulador roda numa máquina só: os tempos servem para comparar versões e achar gargalos, não são os tempos do Firebase no ar.
- **Custo estimado (premissas: grupo com 25 jogadores, 1 jogo por semana, cada jogador abre o link 3 vezes, o administrador abre a gestão 10 vezes e há uma votação):**
  - **Por grupo:** cerca de 8.500 leituras e 150 gravações por semana, ou seja, cerca de 37 mil leituras e 650 gravações por mês. A maior parte das leituras vem de quem abre o link, porque cada abertura lê o elenco e a lista inteira: 132 leituras com a lista cheia na medição.
  - **Preço do Firestore (out. 2026, edição Standard):** franquia grátis de 50 mil leituras e 20 mil gravações **por dia**. Acima disso, US$ 0,03 por 100 mil leituras e US$ 0,09 por 100 mil gravações. O preço pode variar com a região do banco; conferir no console.
  - **100 grupos:** cerca de 3,7 milhões de leituras e 65 mil gravações por mês. No plano pago, com a franquia, dá **menos de US$ 1 por mês**.
  - **1.000 grupos:** cerca de 37 milhões de leituras e 650 mil gravações por mês, ou **cerca de US$ 11 por mês** no plano pago.
  - **Alerta para o negócio:** o projeto está no plano grátis (Spark), que **para de responder** quando passa de 50 mil leituras no dia, em vez de cobrar. Como os grupos concentram o uso perto do dia do jogo, isso pode acontecer já com **15 a 25 grupos ativos** jogando no mesmo dia. Recomendação: passar para o Blaze, com alerta de orçamento, antes de chegar a 15 grupos ativos.
- **O que faria mudar:** o link ler menos (só a próxima rodada e as respostas, sem o elenco inteiro a cada abertura), se as leituras crescerem mais rápido que os grupos.
- **Decisão do Kleber (16/10/2026):** o Blaze fica para o futuro. O gatilho para rever é chegar perto de 15 grupos ativos ou ver o Firebase recusar leituras por cota (cartão KAN-174).

### D12. Ficar em JavaScript/TypeScript e pagar a dívida técnica aos poucos (8 out. 2026)
- **Contexto:** a dúvida era se valeria trocar de linguagem para não acumular dívida técnica.
- **Decisão:** não trocar. Todo app web roda em JavaScript; o caminho certo é o **TypeScript** (JavaScript com tipos conferidos antes de ir para o ar), que já começou na v14. As funções no servidor, quando vierem, também serão em TypeScript: uma linguagem só no produto inteiro.
- **Onde está a dívida de verdade:** telas montadas como texto (`innerHTML`, onde um escape esquecido vira brecha), código sem tipos, um estado global que qualquer parte altera e regras de negócio sem teste próprio.
- **Como pagar, sem parar o produto:**
  1. **Tela mexida, tela migrada:** toda tela tocada por uma funcionalidade vira componente TypeScript + Preact na mesma entrega.
  2. **Uma fatia fixa por pacote:** cada entrega leva pelo menos um cartão de dívida técnica, indicado pelo arquiteto.
  3. **Painel medido a cada versão** (a montagem calcula sozinha; ver abaixo). Número que piora sem justificativa segura o Merge.
  3a. **Desde a pelada-v43 (KAN-154) o painel trava a montagem:** os tetos ficam em `docs/divida.json` (innerHTML, textos fora do dicionário, arquivos sem tipos, telas como componente e regras com teste). Se um número piorar, a montagem falha com a explicação em português; quando melhora, o teto é ajustado na mesma entrega. Na v43: innerHTML 24, 344 textos fora do dicionário, 53 arquivos sem tipos, 3 de 16 telas como componente.
  3a2. **Desde a pelada-v44 (KAN-157) o GitHub confere a entrega** (`testes/conferir-entrega.mjs`, passo da tarefa "montar"): VERSION, Design System, REGRAS, aviso das regras do Firebase e o checklist da proposta (`.github/pull_request_template.md`). Rodada contra o histórico, ela teria barrado a #48 (mesma versão da #46) e a v41 sem registro no Design System.
  3a3. **Desde a pelada-v45 (KAN-155) o código segue um formato único** (Prettier 3.3.3, configuração em `.prettierrc.json`: linhas de até 120 caracteres, aspas simples). O GitHub recusa código fora do formato (`npm run conferir-formato`); para formatar, `npm run formatar`. Num ambiente sem acesso ao registro do npm, a automação "Ferramentas para o ambiente de construção" guarda o pacote no ramo `ferramentas` (`git show origin/ferramentas:prettier-3.3.3.tgz`). Na mesma versão, a medida de textos fora do dicionário passou a ignorar quebras de linha depois de `>` (o código formatado quebra o JSX em linhas): mesmo código, 352 textos, e o teto foi ajustado para esse número.
  3a4. **pelada-v46 (KAN-159, KAN-160):**
    - Partida e Jogadores viraram componentes (5 de 16 telas).
    - **O dicionário foi dividido:** `src/i18n/pt-BR-gestao.js` (caixa, jogadores, partida, sorteio, importar e outros grupos só da gestão) chega com `src/admin.js` e é juntado ao dicionário por `juntarTextos`. A montagem confere, pelos pedaços gerados, que nenhum arquivo do link público usa um grupo de textos da gestão. Com isso, o link do jogador caiu de 48,1 para 44,5 KB.
    - O total passou para **até 90 KB** (era 85): a importação da planilha, o leitor de .xlsx sem biblioteca (usa o `DecompressionStream` do navegador) e os componentes, tudo só para quem administra. Na v46: total 86,1 KB.
    - O `tsconfig.json` aceita importar `.ts` com a extensão (`allowImportingTsExtensions`), para as regras em TypeScript se importarem entre si também nos testes do Node.
  3a5. **pelada-v47 (KAN-162):**
    - "Meus grupos" virou componente (`telas/Grupos.tsx`, 6 de 16 telas).
    - Os textos do formulário do grupo e da página inicial foram para o dicionário (302 textos fora dele, eram 327).
    - O total passou para **até 95 KB** (era 90): a tabela de países, que só quem administra baixa. O link do jogador ficou em 45,1 KB.
    - Ficou para depois (KAN-165): o formulário do grupo (`telas/grupo-form.js`) e o login (`telas/login.js`) ganharam campos de país, mas ainda não viraram componentes.
  3a6. **pelada-v65 (KAN-165):** o formulário do grupo (`telas/GrupoForm.tsx`) e a tela de entrar (`telas/Login.tsx`) viraram componentes (8 de 16 telas), por fora iguais (mesmos ids). Frequência, esporte, dias fixos e país viraram estado do componente; as ações `pickFreq`, `pickSport`, `addSched` e `rmSched` só chamam o formulário aberto. A tela de entrar é montada em `#authRaiz` (`montarAuth`); o convite preenche o cabeçalho `#invHead`. Dívida: 49 arquivos sem tipos (eram 52), 299 textos fora do dicionário (eram 300).
  3b. **Componentes reaproveitáveis** ficam em `src/ui/componentes.tsx` (texto cortado, Como chegar, seletor segmentado, posição, nota, etiqueta), registrados no Design System. A aba Rodada virou componente na v43 (`src/telas/Rodada.tsx`); as partes que Partida e Histórico ainda usam em texto ficam em `telas/rodada-partes.js` até essas telas migrarem.
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
| `i18n/` | `pt-BR.js` (textos do link e do login), `pt-BR-gestao.js` (textos da gestão), `index.js` (`tx` e `tp`), `formatos.js` (idioma, formato, moeda, fuso e `agora()` do grupo, KAN-162), `cidades.ts` (nomes de cidades dos fusos) |
| `nucleo/` | `util.js` (utilidades, sem dependências), `links.js`, `estado.js` (estado e assinaturas do banco), `backend.js` (Firebase ou demonstração, carregando dos botões), `edicoes.js` (gravações otimistas e presença) |
| `dominio/` | Regras de negócio sem tela: `esportes.js` (catálogo), `grupo.js`, `rodadas.js`, `caixa.js` (configuração do caixa), `caixa-regras.ts` (pendências do mês e totais, com teste próprio desde a pelada-v30), `sorteio.js`, `whatsapp.js` (textos para compartilhar), `limites.ts` (limites contra abuso) |
| `ui/` | `render.js` (desenho da tela e abas), `tema.js`, `dialogos.js` (janelas; desde a pelada-v30 também a janela de confirmação do app, `confirmou()`, no lugar do `confirm()` do navegador) |
| `telas/` | Uma tela por arquivo: `apresentacao`, `Login.tsx`, `convite`, `grupos`, `rodada`, `historico`, `GrupoForm.tsx`, `grupo`, `jogadores`, `partida`, `ranking`, `Votacao.tsx` (aba e Nova votação, v75), `votacao` (apuração), `publico-voto` e os componentes `PublicoRodada.tsx` e `Caixa.tsx` (pelada-v30, KAN-135) (link do jogador; `publico-rodada.js` guarda o "quem sou eu" do aparelho) |
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
