# Agentes do Nosso Jogo

São tarefas agendadas que rodam sozinhas, com regras fixas, e trabalham no Jira (projeto KAN). Nenhum agente altera o código, as regras do Firebase ou os documentos deste projeto. As mudanças no app continuam sendo construídas na conversa do projeto, a partir dos cartões aprovados, e só vão para o ar quando o Kleber clica em **Merge** no GitHub.

| Agente | Quando roda | O que faz | Épico | Etiqueta |
|---|---|---|---|---|
| PO (benchmark) | Segunda, 7h52 | Pesquisa o mercado e cria até 5 demandas para avaliar, já com critérios de aceite | KAN-62 | `po-agente` |
| UX/UI | Segunda, 10h52 | Audita o app quando há versão nova, comenta "[UX]" nas demandas do PO, escreve a especificação de UX (com critérios de aceite de UX) das aprovadas e cria até 5 demandas | KAN-68 | `ux-agente` |
| Qualidade | Todo dia, 6h37 | Escreve casos de teste dos cartões aprovados; com versão nova **ou cartões ainda sem validação em Em análise**, roda `testes/testes_app.py`, valida **todos** os cartões pendentes (até 12 por execução), cria cartões de defeito e diz se pode dar Merge (ou se a versão já está no ar e aprovada) | KAN-69 | `qa-agente`, `defeito` |
| Privacidade e Segurança | Terça, 9h41 (audita se as regras ou o app mudaram, ou a cada 30 dias) | Confere as promessas de privacidade nas regras do Firebase e no código | KAN-70 | `seguranca-agente` + gravidade |
| Arquiteto | Quarta, 9h47 | Orienta tecnicamente os cartões aprovados ("[Arquitetura]"), revisa cada versão nova (segurança, desempenho, organização, idiomas), propõe decisões e cria até 3 cartões de dívida técnica por semana | KAN-81 | `arquiteto-agente` |
| Organização do backlog | Sexta, 16h47 | Aponta duplicados, conflitos e entregas paradas, marca o próximo pacote com `proximo-pacote` e resume o que espera decisão | — | `proximo-pacote` |

## Onde os agentes leem o app
Na pasta `app/` deste projeto: `app/index.html` (o app **montado**, num arquivo só, na cópia **legível**; os comentários `// src/...` mostram de qual módulo veio cada trecho. Desde a pelada-v19 o site publicado vai compactado, mas o comportamento é o mesmo), `app/sw.js`, `app/manifest.webmanifest`, `app/firestore.rules` e `app/LEIA-ME.md`. É uma cópia da versão proposta mais recente no GitHub, atualizada a cada entrega. **Não apague essa pasta:** sem ela, os agentes de UX, Qualidade, Segurança, Arquiteto e Organização param de funcionar.

**O que os agentes não enxergam** (GitHub, prévia e site no ar) fica em `testes/VERIFICACOES-GITHUB.md`: resultado dos testes sobre o site publicado, regras de negócio, regras do Firebase no emulador, tamanho do app, Merge feito e regras publicadas. Quem entrega a versão atualiza esse arquivo ao abrir a proposta e de novo depois do Merge. Os agentes usam como evidência, em vez de deixar cartões "parciais" por falta de acesso.

As decisões técnicas ficam em `docs/ARQUITETURA.md`.

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
   - o Arquiteto comenta "[Arquitetura]": onde mexe, segurança, desempenho, idiomas e se precisa de servidor;
   - o Qualidade comenta "[Casos de teste]", com os casos `CT-<chave>-NN`. Se faltavam critérios, ele comenta antes "[Critérios de aceite propostos]". Cartão que é só uma decisão de negócio recebe "Sem testes de app".
3. **Construção** (na conversa do projeto):
   - os casos marcados "(automatizável)" viram testes no `testes/testes_app.py`, na mesma entrega;
   - todo o roteiro precisa passar, e o app montado precisa caber no orçamento de desempenho;
   - a versão vai para o GitHub como proposta de mudança (*pull request*), onde o site é montado, os testes rodam de novo (inclusive as regras do Firebase no emulador) e o GitHub publica a prévia no Firebase Hosting e comenta o link na proposta;
   - a pasta `app/`, os documentos deste projeto e o `testes/VERIFICACOES-GITHUB.md` são atualizados com a versão proposta, para os agentes a enxergarem;
   - cada cartão entregue recebe o comentário "[Entrega] pelada-vXX", com o link da proposta e o da prévia, e vai para **Em análise**;
   - o `proximo-pacote` é retirado.
4. **Validação** (Qualidade, todo dia, enquanto houver versão nova ou cartão em Em análise sem validação):
   - executa os casos de teste no app atual e comenta "[Validação] pelada-vXX", usando o `testes/VERIFICACOES-GITHUB.md` para o que só o GitHub mostra;
   - **passou em todos:** move para **Concluído**;
   - **falhou em algum:** devolve para **A fazer** e cria um defeito para cada falha;
   - o veredito ("Pode publicar", "Já está no ar e está aprovada" ou "Segurar a publicação") vem com o link da proposta.
5. **Publicação** (Kleber): abre a prévia, confere e clica em **Merge**. O GitHub monta e publica o site no Firebase Hosting (e confere que a versão no ar é a nova) e publica as regras do Firebase se elas mudaram. A versão aparece no rodapé do app.

## Registros que os agentes deixam nos épicos
- `[Auditoria]` (UX, KAN-68): última versão auditada.
- `[Testes]` (Qualidade, KAN-69): resultado de cada execução, os cartões concluídos e devolvidos, e o veredito.
- `[Segurança]` (KAN-70): data, versão e resumos das regras e do app auditados.
- `[Arquitetura]` e `[Decisão proposta]` (Arquiteto, KAN-81): versão revisada, tamanho do app, veredito sobre o Merge e decisões sugeridas.

## Infraestrutura de publicação
- **GitHub:** `kleberkoch-coder/nosso-jogo` (privado). Código em `src/`, modelo da página e arquivos fixos em `site/`, montagem em `build.mjs` (`npm run build` gera `dist/` compactado e `montagem-legivel/`); `firestore.rules`, `testes/` e `docs/` na raiz.
- **Automações do GitHub:** "Testes do app" (toda proposta: monta o site, testa as regras de negócio, testa as regras do Firebase no emulador e roda o roteiro sobre o site compactado) e "Publicar regras do Firebase" (quando o `firestore.rules` muda na `main`, com a conta `publicar-regras-github`, que só publica regras).
- **Firebase Hosting (desde a pelada-v24, D15):** endereço oficial `https://nosso-jogo-f4762.web.app`. Automações "Publicar o site" (no Merge, com conferência da versão no ar) e "Prévia da proposta" (canal de prévia de 7 dias, modo demonstração). O Netlify (`nossosjogos.netlify.app`) só mostra o aviso de mudança de endereço.
