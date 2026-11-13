# Agentes do Nosso Jogo

São tarefas agendadas que rodam sozinhas, com regras fixas, e trabalham no Jira (projeto KAN). Nenhum agente altera o código, as regras do Firebase, as funções do servidor ou os documentos deste projeto. As mudanças no app continuam sendo construídas na conversa do projeto, a partir dos cartões aprovados, e só vão para o ar quando o Kleber clica em **Merge** no GitHub.

| Agente | Quando roda | O que faz | Épico | Etiqueta |
|---|---|---|---|---|
| PO (benchmark) | Segunda, 7h52 | Pesquisa o mercado e cria até 5 demandas para avaliar, já com critérios de aceite | KAN-62 | `po-agente` |
| UX/UI | Segunda, 10h52 | Quando há versão nova, audita o app: usabilidade e visual, olhando cada tela em 390 e 360px nos dois temas. Confere se o Design System está em dia com o que aparece no app, comenta "[UX]" nas demandas do PO, escreve a especificação de UX das aprovadas e cria até 5 demandas | KAN-68 | `ux-agente` |
| Qualidade | Todo dia, 6h37 | Ver a seção "O que o agente de Qualidade faz", abaixo | KAN-69 | `qa-agente`, `defeito` |
| Privacidade e Segurança | Terça, 9h41 (audita se as regras, o app ou as funções do servidor mudaram, ou a cada 30 dias) | Confere as promessas de privacidade nas regras do Firebase, no código do app e, desde a pelada-v116, no código do servidor (quem recebe cada aviso, o que o aviso leva) | KAN-70 | `seguranca-agente` + gravidade |
| Arquiteto | Quarta, 9h47 | Orienta tecnicamente os cartões aprovados ("[Arquitetura]"). Revisa cada versão nova: segurança, desempenho, **escala com muita gente ao mesmo tempo e custo para 1.000 grupos** (desde a pelada-v116, **inclusive as funções do servidor**: quantas vezes rodam, quanto custam, se o teto de avisos está bem calibrado), organização, idiomas e dívida. Propõe decisões e cria até 3 cartões de dívida técnica por semana | KAN-81 | `arquiteto-agente` |
| Organização do backlog | Sexta, 16h47 | Aponta duplicados, conflitos e entregas paradas, marca o próximo pacote com `proximo-pacote` e resume o que espera decisão | — | `proximo-pacote` |

## Três idiomas em tudo (desde 04/11/2026, pelada-v90, KAN-164)
O app fala **português, inglês e espanhol**. Tudo o que for criado daqui em diante nasce nos três idiomas, na mesma entrega:
- **Textos de tela, avisos e mensagens prontas do WhatsApp:** no dicionário em português e também em `src/i18n/en/` e `src/i18n/es/`. O teste `regras/idiomas` barra a entrega se faltar uma chave ou se um marcador (`{n}`, `{data}`…) estiver diferente. Os textos dos avisos no celular, que o servidor monta, ficam em `src/i18n/avisos-servidor.ts`, também nos três idiomas.
- **Nomes do catálogo** (esporte, posição, sigla, pontuação, cor, plano): com a tradução `cat.…` nos dois idiomas.
- **Moeda, formato das datas e dos números e fuso** continuam os do grupo, em qualquer idioma.
- **PO e UX:** os critérios de aceite das demandas novas incluem o comportamento em inglês e espanhol quando houver texto novo.
- **Qualidade:** nos casos de teste de cartão com texto novo, inclui um caso "(automatizável)" com o app em English, conferindo que nada aparece em português e que `window.__njSemTraducao()` volta vazio.
- **Arquiteto:** na revisão de cada versão, confere que o texto novo chegou aos três idiomas e que nada foi montado fora do dicionário.

## O que o agente de Qualidade faz
- Escreve os casos de teste dos cartões aprovados. Em todo cartão que grava algo, inclui **"grava, recarrega e confere"** e **"sai, entra e confere"** (desde 16/10, por causa do KAN-167). Em todo cartão com texto novo, inclui um caso em English (desde 04/11, KAN-164).
- Quando há versão nova **ou cartões ainda sem validação em Em análise**:
  - roda `testes/testes_app.py` e o roteiro de gravação `testes/persistencia_app.py`;
  - faz **testes exploratórios**: persistência primeiro, depois fluxos alternativos, dados estranhos, abuso pela tela (como código no nome do jogador) e as telas mexidas em inglês e espanhol;
  - valida **todos** os cartões pendentes, até 12 por execução;
  - cria cartões de defeito. **Dado perdido (some ao recarregar ou ao entrar de novo) é gravidade Alta**;
  - diz se pode dar Merge, ou se a versão já está no ar e aprovada.
- Carga e invasão pelas regras não são dele. O que só o servidor faz (mandar o aviso ao celular) ele confere pelos testes das funções no emulador, registrados em `testes/VERIFICACOES-GITHUB.md`.

## Onde os agentes leem o app
Na pasta `app/` deste projeto, que é uma cópia da versão proposta mais recente no GitHub, atualizada a cada entrega:
- `app/index.html`: o app **montado**, num arquivo só, na cópia **legível**. Os comentários `// src/...` mostram de qual módulo veio cada trecho. Desde a pelada-v19 o site publicado vai compactado, mas o comportamento é o mesmo;
- `app/sw.js`, `app/manifest.webmanifest`, `app/firestore.rules` e `app/LEIA-ME.md`;
- **`app/funcoes/`** (desde a pelada-v116): o código que roda no **servidor** (Cloud Functions do Firebase, região São Paulo). `index.ts` liga as funções ao Firebase (com o limite de cópias); `logica.ts` diz o que cada função lê, grava e manda, o teto de avisos por mês e o registro de falhas; `config.ts` é a região; `avisos.ts` é a regra pura dos avisos (`src/dominio/avisos.ts`). As funções rodam com a conta do servidor, que **não passa pelas regras do Firebase**: a conferência de quem recebe o quê está no próprio código.

**Não apague essa pasta:** sem ela, os agentes de UX, Qualidade, Segurança, Arquiteto e Organização param de funcionar.

**O que os agentes não enxergam** (GitHub, prévia e site no ar) fica em `testes/VERIFICACOES-GITHUB.md`:
- resultado dos testes sobre o site publicado e do **roteiro de gravação no emulador do Firebase**;
- regras de negócio, regras do Firebase e **funções do servidor** no emulador;
- tamanho do app;
- Merge feito e regras e funções publicadas.

Quem entrega a versão atualiza esse arquivo ao abrir a proposta e de novo depois do Merge. Os agentes usam como evidência, em vez de deixar cartões "parciais" por falta de acesso.

**Regras em vigor, em resumo:** `docs/REGRAS.md`, com uma linha por regra e o mapa de impacto (o que mexer quando muda cada assunto). Leia primeiro; o detalhe fica em `VISAO-DO-PRODUTO.md`. As decisões técnicas ficam em `docs/ARQUITETURA.md` (a D61 trata das funções do servidor).

## Como as decisões funcionam
- **Demandas do PO, do UX, do Arquiteto e achados de segurança médios ou baixos:** chegam em **Ideia** com `para-avaliar`. Comente *aprovado* ou *recusado* no cartão; o agente dono move na próxima execução.
- **Defeitos e achados de segurança críticos ou altos:** entram direto em **A fazer**, porque não são opcionais.
- **Decisões técnicas novas:** o Arquiteto comenta "[Decisão proposta]" no épico KAN-81. Se você concordar, peça na conversa do projeto para registrar em `docs/ARQUITETURA.md`.
- **Construir o próximo pacote:** peça na conversa do projeto: "construir o próximo pacote". Os cartões com `proximo-pacote` viram uma versão nova, testada com o roteiro antes da entrega.
- **Publicar:** clique em **Merge pull request** na proposta de mudança do GitHub, de preferência depois do veredito "Pode publicar" do agente de Qualidade e sem objeção do Arquiteto.

## Caminho de um cartão (critérios de aceite, testes e publicação)
1. **Ideia** (`para-avaliar`): o PO, o UX ou o Arquiteto escreve o problema, a proposta e os **Critérios de aceite** ("Dado … quando … então …"). O UX comenta "[UX]" nos do PO, incluindo critérios de UX que faltam.
2. **A fazer** (aprovado, defeito ou achado grave):
   - o UX comenta a "[Especificação de UX]", com a lista "Critérios de aceite de UX";
   - o Arquiteto comenta "[Arquitetura]": onde mexe, segurança, desempenho, escala, idiomas e se precisa de servidor;
   - o Qualidade comenta "[Casos de teste]", com os casos `CT-<chave>-NN`. Se faltavam critérios, ele comenta antes "[Critérios de aceite propostos]". Cartão que é só uma decisão de negócio recebe "Sem testes de app".
3. **Construção** (na conversa do projeto):
   - os casos marcados "(automatizável)" viram testes no `testes/testes_app.py`, no `testes/persistencia_app.py` ou, para o servidor, em `testes/funcoes/`, na mesma entrega;
   - tipo de dado novo gravado no banco precisa de um caso no roteiro de gravação (a conferência da entrega barra se faltar);
   - texto novo entra nos três idiomas (o teste `regras/idiomas` barra se faltar);
   - todo o roteiro precisa passar, e o app montado precisa caber no orçamento de desempenho;
   - a versão vai para o GitHub como proposta de mudança (*pull request*). Lá o site é montado e os testes rodam de novo, inclusive as regras do Firebase, as funções do servidor e o roteiro de gravação no emulador. O GitHub publica a prévia no Firebase Hosting e comenta o link na proposta;
   - a pasta `app/` (inclusive `app/funcoes/`), os documentos deste projeto e o `testes/VERIFICACOES-GITHUB.md` são atualizados com a versão proposta, para os agentes a enxergarem;
   - cada cartão entregue recebe o comentário "[Entrega] pelada-vXX", com o link da proposta e o da prévia, e vai para **Em análise**;
   - o `proximo-pacote` é retirado.
4. **Validação** (Qualidade, todo dia, enquanto houver versão nova ou cartão em Em análise sem validação):
   - executa os casos de teste no app atual e comenta "[Validação] pelada-vXX", usando o `testes/VERIFICACOES-GITHUB.md` para o que só o GitHub mostra;
   - **passou em todos:** move para **Concluído**;
   - **falhou em algum:** devolve para **A fazer** e cria um defeito para cada falha;
   - o veredito ("Pode publicar", "Já está no ar e está aprovada" ou "Segurar a publicação") vem com o link da proposta.
5. **Publicação** (Kleber): abre a prévia, confere e clica em **Merge**. O GitHub monta e publica o site no Firebase Hosting, confere que a versão no ar é a nova e publica as regras do Firebase e as funções do servidor, se elas mudaram. A versão aparece no rodapé do app.

## Registros que os agentes deixam nos épicos
- `[Auditoria]` (UX, KAN-68): última versão auditada.
- `[Testes]` e `[Exploratório]` (Qualidade, KAN-69): resultado de cada execução (regressão e gravação), os achados exploratórios, os cartões concluídos e devolvidos, e o veredito.
- `[Segurança]` (KAN-70): data, versão e resumos das regras, do app e das funções do servidor auditados.
- `[Arquitetura]` e `[Decisão proposta]` (Arquiteto, KAN-81): versão revisada, tamanho do app, custo do servidor, veredito sobre o Merge e decisões sugeridas.

## Infraestrutura de publicação
- **GitHub:** `kleberkoch-coder/nosso-jogo` (privado).
  - Código em `src/`, modelo da página e arquivos fixos em `site/`, montagem em `build.mjs`. O `npm run build` gera o `dist/` compactado e a `montagem-legivel/`.
  - Funções do servidor em `funcoes/` (montadas por `funcoes/montar.mjs`, desde a pelada-v116).
  - `firestore.rules`, `testes/` e `docs/` ficam na raiz.
- **Automação "Testes do app"** (em toda proposta):
  - confere a entrega: versão, Design System, REGRAS e checklist (desde a v44) e, desde a v50, um caso de gravação para cada tipo de dado gravado;
  - monta o site, com a trava de tamanho e de dívida técnica;
  - testa as regras de negócio (inclusive os três idiomas, desde a v90) e as regras do Firebase no emulador;
  - desde a v116, testa as **funções do servidor no emulador** (tarefa "funcoes"); rodada à mão, faz também o **ensaio da publicação das funções** (tarefa "funcoes-permissoes", que não publica nada);
  - roda o roteiro sobre o site compactado;
  - desde a v50, roda o **roteiro de gravação com o app ligado ao emulador do Firebase** (tarefa "persistencia").
- **Automação "Publicar regras do Firebase":** roda quando o `firestore.rules` muda na `main`, com a conta `publicar-regras-github`.
- **Automação "Publicar as funções"** (desde a pelada-v116): roda quando `funcoes/` (ou as regras que ela usa) muda na `main`, com a mesma conta, que ganhou os papéis de publicar funções.
- **Firebase Hosting** (desde a pelada-v24, D15):
  - endereço oficial: `https://nosso-jogo-f4762.web.app`;
  - automações "Publicar o site" (no Merge, com conferência da versão no ar) e "Prévia da proposta" (canal de prévia de 7 dias, em modo demonstração);
  - o Netlify foi desligado em 14/10/2026;
  - o **Portal do Nosso Jogo** (área da administração) é outro site: `https://nosso-jogo-portal.web.app`, montado de `src/portal/`. Desde a pelada-v116, a tela de falhas do Portal também mostra as falhas dos avisos no celular (tipo **Aviso**).

## Quem cobre o quê (atualizado em 13/11/2026)
| Assunto | Quem cobre | Como |
|---|---|---|
| O que já funcionava continua funcionando | GitHub + Qualidade | roteiro automático em toda proposta; Qualidade roda de novo a cada versão |
| **Dado gravado não some** (KAN-170, depois do KAN-167) | GitHub + Qualidade | tarefa "persistencia": roteiro de gravação contra o emulador do Firebase em toda proposta (grava, recarrega e confere; entra de novo e confere); a conferência da entrega barra gravação nova sem caso; o Qualidade exige "recarrega e confere" em todo caso que grava |
| **Tudo nos três idiomas** (KAN-164) | GitHub + Qualidade + Arquiteto | `regras/idiomas` barra chave ou marcador faltando; Qualidade testa as telas novas em English; Arquiteto confere na revisão |
| Fluxos alternativos, dados estranhos, abuso pela tela | Qualidade | testes exploratórios a cada versão nova |
| Invadir ou gravar dados direto, sem a tela | GitHub + Segurança | regras do Firebase testadas no emulador em toda proposta; auditoria semanal da Segurança |
| Dados privados em aberto | Segurança + Qualidade | matriz de quem lê o quê nas regras; conferência do link público na tela |
| **Funções do servidor** (avisos no celular, desde a v116) | GitHub + Arquiteto + Segurança | testes no emulador em toda proposta e ensaio da publicação; Arquiteto revisa custo e escala; Segurança revisa quem recebe o quê e o que o aviso leva; as falhas aparecem no Portal (tipo Aviso) |
| Usabilidade e visual | UX | auditoria com fotos em 390 e 360px, nos dois temas, a cada versão nova |
| Design System em dia | GitHub + UX | o GitHub barra estilo novo sem registro; o UX confere se o registro está completo |
| Muita gente ao mesmo tempo, custo e escala | Arquiteto | conta de gargalos e custo a cada versão (inclusive as funções do servidor); teste de carga no emulador (KAN-158, aprovado) |
| Dívida técnica | GitHub + Arquiteto | trava em `docs/divida.json`; Arquiteto cobra melhora |
