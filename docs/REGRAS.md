# Nosso Jogo: regras em vigor (resumo)

Leia este arquivo primeiro. Ele traz só o que vale hoje, uma linha por regra. O histórico e o detalhe ficam em `VISAO-DO-PRODUTO.md` (produto), `docs/ARQUITETURA.md` (técnica, decisões D1 a D16) e `DESIGN-SYSTEM.md` (visual). O código entre parênteses é o cartão do Jira.
Atualizado na pelada-v61 (21/10/2026). Toda entrega que mudar uma regra atualiza a linha aqui, na mesma proposta.

## Princípios
- O jogador nunca precisa de conta: confirma e vota pelo link do WhatsApp.
- Só organizador e administradores têm conta: e-mail com senha forte ou Google.
- "Continuar com o Google" entra ou cria a conta em qualquer aba; se a aba não bater, o app avisa (KAN-142).
- Senha: 8+ caracteres, maiúscula, minúscula, número e um especial da lista do Firebase (`^ $ * . [ ] { } ( ) ? " ! @ # % & / \ , > < ' : ; | _ ~`). Vale no app (`telas/login.js`) e na política de senha do Firebase, em modo Exigir; as duas mudam juntas (KAN-10).
- Cada grupo é independente: elenco, rodadas, caixa, votações e administradores.
- Nada específico de esporte no código: posições, pontuação, duplas e textos vêm do catálogo `SPORTS`. Emoji do convite, exemplos da votação (posição-chave só se o esporte tiver) e o nome do ponto ("+2 pontos", "Gol", "TD (+6)") também (KAN-75).
- Celular primeiro, funciona com sinal fraco (grava no aparelho e envia depois).
- App instalado: quem nunca entrou com conta naquele aparelho (jogador) abre direto no último link de rodada aberto. Aparelho em que alguém já entrou com conta é de organizador: abre Meus grupos ou, sem conta entrada (por exemplo, depois de Sair), o login; nunca o link do jogador (KAN-171).
- Vários idiomas: nenhum texto de tela fica no código; tudo vai para o dicionário (`i18n/pt-BR.js`, chamado por `tx`). Tela mexida migra seus textos na mesma entrega (D3).

## Privacidade e segurança (valem nas regras do Firebase, não só na tela)
- Só administradores veem notas, caixa (mensalidade, diária, Pix), contatos, tipo do jogador e votos individuais.
  - Exceção aprovada pelo Kleber em 21/10/2026 (KAN-63): com o controle de vagas ligado, o jogador diarista ganha a marca pública `vaga` ("só entra com vaga aberta"), para o link escondê-lo. A marca não diz o tipo nem o valor, mas permite deduzir quem é diarista. Sem o controle, ninguém tem a marca.
- Links públicos mostram nomes, posições, presença, times e resultados.
- Pix, mensalidade e diária nunca no documento público do grupo; ficam em `privado/caixa` (KAN-79).
- Identificador vindo do link só com letras, números, `_` e `-` (KAN-76). Todo texto do banco é escapado antes da tela.
- Pelo link: ninguém fura a ordem, troca o nome, a posição ou a marca de avulso de outro (KAN-78); presença só em jogos de ontem até 15 dias à frente (KAN-77).
- Limites: 30 avulsos novos pelo link por rodada e 20 grupos criados por conta, por contadores nas regras; os números ficam em `sistema/limites` (KAN-89, KAN-134).
- Qualquer um lê um grupo pelo link; só o portal lista todos os grupos (KAN-133).
- Sair apaga a cópia local dos dados; com algo sem enviar, pergunta antes (KAN-80).
- App Check em observação, com a chave "Nosso Jogo web 2" desde a v42. Só ligar o bloqueio (Aplicar) com mais de 99% de chamadas verificadas por 7 dias; ligado antes, ele derrubou o login em 15/10 (KAN-88, lembrete em 20/10).
- Mudança no `firestore.rules`: testes no emulador e aviso destacado ao Kleber; é publicada no Merge.
- Gravação recusada pelo banco (KAN-170): o app avisa "Não foi possível salvar" e volta a mostrar o que está gravado, nunca o que não foi salvo.
- Lista dentro de lista (posições criadas `posx` e pares separados `sep`) é gravada como `{ __lista: [...] }` e volta a ser lista na leitura, porque o Firestore não aceita o formato direto. O modo demonstração recusa o que o Firestore recusa (KAN-167; `nucleo/dados-banco.ts`, com teste).

## País, moeda e fuso (KAN-162)
- **Conta:** o país é pedido no cadastro, já sugerido pelo fuso do aparelho (celular ou computador). Conta sem país recebe o do aparelho uma vez. A pessoa troca no menu da conta (botão com a inicial, no cabeçalho) → País e formatos. Vale só para os grupos novos (KAN-166).
- **Grupo novo:** nasce com o país, a moeda e o fuso do organizador. O fuso é o do aparelho, se for do país; senão, o principal do país. Tudo pode ser trocado em Editar grupo, e trocar o país troca a moeda e o fuso.
- **O grupo guarda uma cópia** (`cfg.pais`, `moeda`, `fuso` e `formato`), então mudar o país da conta não mexe nos grupos que já existem.
- **Formato pelo país do grupo:** data, separadores de número e símbolo da moeda (R$ 1.234,50; $1,234.50). Não há opções soltas de ponto, vírgula ou cifrão. Os nomes dos dias continuam no idioma do app (hoje, português).
- **Trocar a moeda** pede confirmação. Os valores já lançados não são convertidos: o número fica igual, só o símbolo muda.
- **O fuso do grupo decide a hora do jogo:** quando a rodada termina e vira para a próxima, e o "hoje", para quem abre de qualquer fuso.
- **Grupo antigo, sem país:** Brasil, Real e o relógio do aparelho, sem mudança.
- **Ainda não fazem parte:** relógio de 12h/24h e primeiro dia da semana (KAN-163), e o app em inglês (KAN-164).

## Grupos e papéis
- Ao criar: nome, frequência (Frequente com dias fixos ou Esporádico), dias e horários (só Frequente), esporte, país, moeda e fuso (KAN-162).
- Nome não repete dentro da conta (ignora maiúsculas, acentos e espaços).
- Jogadores por time é do grupo (o esporte só dá o padrão); 2 = duplas.
- Inativar só o organizador: some da lista, não aceita presença nem voto, não gera rodada fixa, mantém histórico.
- Duplicar copia configuração e, se quiser, o elenco; não copia rodadas, caixa, votações nem administradores.
- Administradores entram por link de convite; só o organizador remove, e remover invalida o link atual.

## Jogadores
- Ficha: nome, posição, nota de 1 a 10 (meio ponto), tipo (mensalista, diarista ou isento de pagamento), "Recebe por jogo" com o valor, contato. Inativar é diferente de excluir.
- Isento de pagamento (KAN-172): continua no elenco, no sorteio, no ranking e na votação, mas nunca deve mensalidade nem diária. Importar elenco aceita "Isento" ou "Não paga"; em Ordenar por Tipo, os isentos vêm por último.
- Telefone (KAN-156, KAN-162; regra em `dominio/telefone.ts` e `dominio/paises.ts`, com teste):
  - O país fica num combo ao lado do número (bandeira e código), que já vem com o país do grupo.
  - Sem "+", vale a regra do país do combo: quantidade de dígitos e o "0" na frente que sai. No Brasil, DDD + número, com 10 ou 11 dígitos. No +1, o código de área não começa com 1, o que pega um número brasileiro com o combo nos EUA.
  - Com "+" (ou "00"), vale o código digitado, de 8 a 15 dígitos.
  - "Outro país" no combo exige o "+".
  - Fica gravado no formato internacional (+55…). Os números antigos, sem "+", continuam brasileiros.
  - Ao editar, o combo volta com o país do número; no +1, fica com o país do grupo quando ele também usa +1.
- E-mail precisa de nome@domínio.terminação. Telefone ou e-mail inválido não salva.
- Ordem da aba Jogadores (KAN-168): "Ordenar por" Nome (A–Z, o padrão), Posição (na ordem do esporte; some em esporte sem posição), Nota (maior primeiro), Tipo (mensalistas primeiro) ou Mais recentes. Empate em ordem alfabética. Vale para ativos, inativos e avulsos, fica guardada no aparelho e não muda a lista de presença da Rodada (regra em `dominio/ordem-jogadores.ts`, com teste).
- Importar da planilha (KAN-159): telefone sem "+" segue o país do grupo (KAN-162). Colar do Excel/Google Planilhas ou enviar .xlsx/.csv (só a primeira aba). Colunas reconhecidas pelo título: Nome (obrigatório), Posição, Nota, Tipo, Telefone e E-mail; sem título, nessa ordem. Nome que já está no elenco ou repetido na lista fica de fora; dado inválido vira aviso e o jogador entra sem ele. Até 100 por vez, gravados de uma vez (regra em `dominio/planilha.ts`, com teste).
- Avulso do link só vira cadastro depois de entrar num sorteio (ou se o administrador o adicionar); pode ser promovido ao elenco.
- Pares "não colocar no mesmo time" são respeitados no sorteio.

## Rodadas e presença
- Aba Rodada não repete informação: dia, hora e local ficam no cartão da rodada; o painel de cima é só o "Link permanente" (KAN-150).
- Frequente: a próxima rodada de cada dia fixo existe sozinha; o link permanente vira quando o jogo termina; uma data pode ser cancelada.
- Esporádico: o administrador cria cada rodada.
- Local é texto livre, até 200 letras (cabe o endereço completo, KAN-143); com local, o link, a aba Rodada e o convite do WhatsApp mostram "Como chegar" (Google Maps e Waze, por busca do texto, sem custo) (KAN-141).
- Ordem da lista = hora da confirmação; tocar Vou de novo não muda; desmarcar e voltar vai para o fim (KAN-78).
- Lista fechada vale para todos (link e gestão); o administrador reabre.
- Presença mudada por outro aparelho: registra e avisa o administrador, não trava.
- Link: busca "Procure seu nome"; "Você vai?" antes dos times; cada nome aparece uma vez (KAN-127).
- Gestão: uma lista com filtros Todos, Vão, Não vão e Sem resposta; "Sortear times" fixo no rodapé até o sorteio (KAN-71).
- Ao abrir o grupo, as abas Rodada e Partida esperam rodadas e presença chegarem antes de desenhar (KAN-137).

## Sorteio
- Equilibra nota média, posições (peso alto na posição-chave), craques (nota 9+), pares separados e parcerias repetidas.
- O app sugere quantos times; o excedente de um time vira reserva (quem confirmou por último).
- Posições fora do sorteio ficam salvas no grupo.
- Sortear fecha a lista e guarda a foto dos confirmados; se a lista mudar depois, a aba Rodada avisa (só depois que a presença carregou).
- Sortear de novo: proibido com votação na rodada; com partidas salvas, pergunta antes; mover e pôr no time continuam (KAN-138).
- Cor do colete é gravada à parte dos times (KAN-108).
- Nome do time = posição no sorteio: "Time 1", "Time 2"… (duplas: "Dupla 1") (v60, KAN-181). A cor é só o colete ("colete laranja"), mostrada ao lado do nome na Rodada, no link e no WhatsApp. Tocar no colete abre as 8 cores; se outro time já usa a escolhida, os dois trocam. Trocar o colete nunca muda o nome.

- Cobrar quem não respondeu (KAN-64; regra em `dominio/cobrar.ts`, com teste): na aba Rodada, logo depois do quadro da rodada, aparece o bloco "Ainda não responderam (N)" com os nomes do elenco ativo sem Vou nem Não vou. Ele tem dois caminhos:
  - **Cobrar no grupo:** monta a mensagem do WhatsApp com os nomes e o link de confirmar (o permanente, no jogo fixo).
  - **Cobrar um por um:** abre o WhatsApp de cada pessoa que tem telefone, com a mensagem e o link, pelo aparelho do administrador. Os telefones continuam só para administradores. Quem não tem telefone aparece como "sem telefone".
  - O bloco some quando todos responderam ou a lista está fechada.
- Mínimo para o jogo e confirmados por posição (KAN-179; regra em `dominio/posicoes.ts`, com teste):
  - Na aba Rodada e no link do jogador, o quadro da rodada mostra quantos confirmados há em cada posição (ex.: GOL 1 · DEF 4). Aparece só a posição com alguém confirmado ou com mínimo definido.
  - "Definir mínimo" (só na gestão) grava no grupo, em `cfg.minPos`, o total de jogadores e o mínimo de cada posição; vale para todas as rodadas. 0 = não acompanhar.
  - Com mínimo, a contagem vira "GOL 1 de 2" e o que falta aparece em destaque: "Faltam 2 jogadores · Falta 1 GOL", também no link.
  - Vale para qualquer esporte: as posições vêm do esporte e das posições criadas pelo grupo; esporte sem posição (beach tennis, futevôlei, vôlei de praia) usa só o mínimo total.
  - O mínimo total é o quórum que a liberação controlada de diaristas e avulsos (KAN-63) usa.
  - O botão chama "Mínimo e vagas" desde a v59.
- Vagas para diaristas e avulsos (KAN-63, pelada-v59; regra em `dominio/vagas.ts`, com teste; garantida nas regras do Firebase):
  - **Ligar:** em "Mínimo e vagas", "Diaristas e avulsos só entram quando eu abrir vagas na rodada" (`cfg.vagasCtrl`). Vem desligado: sem ele, nada muda.
  - **Quem precisa de vaga:** avulso (fora do elenco) e diarista (marca `vaga` no jogador, ajustada sozinha pelo app a partir do tipo). Mensalista e isento confirmam sempre.
  - **Na rodada:** quadro "Vagas para diaristas e avulsos" com "Fechadas", "Abertas · 1 de 3 preenchidas" ou "Esgotadas". "Abrir vagas" pergunta "Quantas vagas?", já com o que falta para o mínimo; vazio = sem limite. Abrir zera o contador; "Mudar vagas" mantém quem já entrou; "Fechar vagas" fecha.
  - **No link, fechadas ou esgotadas:** quem precisa de vaga some (a não ser que já esteja confirmado), "Adicionar meu nome" some e aparece o aviso. Abertas: "Restam N vagas".
  - **Contador** (`rodadas/{rid}/limites/vagas`): entrar pelo link soma 1, quem estava dentro e sai devolve 1, na mesma gravação da presença. Passou do máximo, o Firebase recusa.
  - O administrador continua pondo qualquer pessoa pela gestão, aberto ou fechado.

## Partida, ranking e votação
- A aba Partida tem o seletor de rodada no topo, mesmo quando a rodada escolhida não tem times (KAN-160).
- Placar com a pontuação do esporte e o autor; cronômetro com alarme. Minutos: qualquer um de 1 a 60, mais 70, 80 e 90 (v60: antes faltavam 9, 11…).
- Partida salva guarda a posição dos times (`ta`, `tb`, desde a v60), para o nome não depender do colete. Partidas antigas: o nome sai da cor na rodada; se a rodada não estiver carregada (ranking de meses antigos), aparece a cor.
- Fim por placar (KAN-175, opcional): "Sem limite" ou de 1 a 25 gols/pontos. Quando um time chega ao limite, aparece "Fim por placar", o cronômetro pausa e toca como no fim do tempo; desfazer o gol tira o aviso. Minutos têm a opção "Sem tempo": o cronômetro conta para cima, sem alarme (vôlei). Tempo e limite valem para as partidas seguintes da sessão.
- Próximo jogo (KAN-175; regra em `dominio/fila.ts`, com teste): o app sugere e o responsável troca o Time A ou o Time B à vontade. Primeiro jogo: os 2 primeiros do sorteio. Quem ganha fica, e entra quem está esperando há mais tempo. Empate no 1º jogo: fica o 1º do sorteio; nos outros, fica o time que entrou. Com 2 times, os mesmos de novo. A sugestão sai dos jogos salvos (vale depois de recarregar ou em outro aparelho). A tela mostra "Na espera" na ordem da fila e a lista numerada dos jogos da rodada.
- Cada partida guarda quem jogou: re-sorteio não altera o ranking.
- Artilharia da rodada (KAN-178; regra `camposArtilharia` em `dominio/resumos.ts`, com teste): para quem não registra partida por partida, o painel "Artilharia da rodada" na aba Partida lança o total de gols/pontos de cada jogador dos times, com "+ / −". Decisão do Kleber (17/10): só gols, sem jogo nem vitória. Fica num documento da rodada (`partidas/art`, tipo `art`), que não aparece na lista de partidas nem na sugestão do próximo jogo. Corrigir depois usa a mesma versão da edição de partida. Se a rodada já tem partidas com placar, a janela avisa que os dois somam.
- Escalação (KAN-177; regra em `dominio/escalacao.ts`, com teste): cada lado do placar tem **Escalação**, que vale só para aquela partida. Nela dá para puxar um jogador de outro time, trocar (sai um, entra outro) ou pôr alguém da lista de presença que está sem time. Quem já está na partida não aparece para entrar. A janela do gol mostra quem está em quadra. Decisão do Kleber (17/10): conta para quem esteve em quadra. O emprestado leva o jogo, o resultado e os gols do lado em que jogou, e quem saiu e quem entrou contam o jogo. A partida seguinte volta ao sorteio; trocar o Time A ou o Time B zera a escalação daquele lado.
- Editar partida salva (KAN-176): na lista "Partidas desta rodada", **Editar** abre os gols de cada lado. Dá para trocar o autor (inclusive "sem autor" e gol contra), tirar e incluir gols; o placar sai dos gols. Ao salvar, a partida e o resumo do mês se ajustam num lote só (regra `camposEdicao` em `dominio/resumos.ts`, com teste). A partida guarda a versão (`ver`): as regras do Firebase só aceitam a edição se a versão subir de 1 em 1, então duas edições ao mesmo tempo não bagunçam o ranking (a segunda é recusada).
- Ranking: 3 por vitória, 1 por empate; filtro de ano e mês; vem de totais por mês (`resumos/{AAAA-MM}`), com botão Recalcular.
- Votação: um voto por aparelho pelo link (limite conhecido: outro navegador vota de novo); resultado ao encerrar.

## Caixa
- Mensalidade (quem não é diarista, por mês), diária (diaristas e avulsos que jogaram, por rodada), outras entradas e despesas.
- Pendências do mês e cobrança pronta para o WhatsApp com Pix. Regra em `dominio/caixa-regras.ts`, com teste.
- Valor fora do padrão (KAN-161; regra `foraDoPadrao` em `dominio/caixa-regras.ts`, com teste): o app pergunta antes de gravar ("Lançar R$ X? É bem mais que o normal deste grupo.", com "Corrigir valor", que volta ao campo, e "Lançar assim mesmo") quando o valor passa de 10 vezes a referência do grupo. A referência é a maior entre a mensalidade e a diária do grupo; sem elas, o maior lançamento dos últimos 3 meses; sem nada, não pergunta. Não existe teto em dinheiro (vale para qualquer moeda). A mesma conferência vale para o "Lançar" do Caixa, o valor por jogo da ficha e o total da janela Pagar (referência: valor por jogo × jogos marcados). Na ficha, nome repetido e valor fora do padrão viram uma pergunta só.
- "Recebi" grava na hora com Desfazer por 6 s; apagar lançamento também tem Desfazer (KAN-129).
- A pagar por jogo (KAN-172; regra `aPagar` em `dominio/caixa-regras.ts`, com teste):
  - Quem tem "Recebe por jogo" na ficha (qualquer tipo) passa a ter a receber cada rodada em que jogou, ou seja, em que estava num time sorteado. Quem só confirmou não entra. Contam as rodadas a partir do dia em que a pessoa passou a receber.
  - No Caixa, o painel "A pagar" mostra cada pessoa com os jogos acumulados e o total, e o topo mostra o total a pagar. O saldo só desconta quando se paga.
  - "Pagar" abre os jogos, todos marcados. Dá para desmarcar alguns e ajustar o total. "Paguei" lança uma despesa com o jogador, o total e as rodadas pagas (`refs`), com Desfazer. Os jogos pagos saem do A pagar.
  - Se o valor por jogo mudar, os jogos ainda não pagos usam o valor novo.
  - O valor e o tipo ficam em `privado/caixa` (`tipos`, `porJogo: {id: {v, desde}}`), só para administradores.

## Planos e portal
- Plano é por conta do organizador e vale para todos os grupos dela; vencido volta ao Grátis.
- Grátis: 1 grupo, 1 administrador convidado, presença, sorteio, placar, ranking do mês.
- Plano A: até 3 grupos, 2 administradores, caixa, votação, ranking anual, histórico, lista de espera, cobrar quem não respondeu.
- Plano B: ilimitado, 5 administradores, cards e relatórios com IA, painéis do caixa.
- Catálogo em `sistema/planos`, muda sem versão nova. O app pergunta pelo recurso, nunca pelo nome do plano. Os limites ainda não valem no app (KAN-119).
- Plano só é gravado pelo portal (ou servidor de pagamento), nunca pelo app.
- Portal em site separado (`nosso-jogo-portal.web.app`), só Google, acesso só pelo uid listado nas regras (`adminPortal()`); nunca mostra notas, caixa, Pix ou contatos.

## Padrões de tela
- Todo botão que grava, cria, exclui, abre ou faz login mostra loading; janelas só fecham depois de gravar.
- Login e cadastro: cursor no e-mail; Enter envia em toda janela.
- Janela de formulário com algo preenchido: tocar fora ou Esc pergunta "Descartar o que você preencheu?" antes de fechar (KAN-140).
- Confirmações na janela do app (nunca `confirm` ou `alert`): pergunta curta, consequência, botão com o verbo; coral quando apaga (KAN-128).
- Local e outros textos longos: numa linha só com "…" (sublinhado pontilhado quando corta); passar o mouse mostra o texto inteiro e tocar abre ou fecha. O seletor de rodadas e o cabeçalho não mostram o local. Nada pode criar rolagem lateral (KAN-144, KAN-146).
- Horário (início e término): campo do app com hora (00–23) e minutos (00–59), setas ▲▼ e digitação; qualquer minuto vale (ex.: 10:03); nunca o relógio do celular, que corta botões no Android com letra grande (KAN-151).
- Menu da conta (KAN-166): quem tem conta vê, no canto do cabeçalho de todas as telas, um botão redondo com a inicial do e-mail. Ele abre o e-mail, "País e formatos", "Tema" e "Sair" (o Sair não fica mais solto no cabeçalho). Funciona como o menu do tema: setas, Esc e tocar fora.
- Tema (KAN-169): com conta, fica no menu da conta ("Tema: Automático", que abre Automático, Claro e Escuro) e o botão 🌓 sai do cabeçalho. Sem conta (link do jogador, votação, login, apresentação), o botão 🌓 continua. A aba Grupo segue com o painel Aparência. Vale só para o aparelho.
- Dias fixos do grupo: cada horário tem o rótulo em cima, "Início" e "Término (opcional)" (KAN-166).
- Alvos de toque: 44px nos principais, 36px nos pequenos. Contraste WCAG AA nos temas claro e escuro.

## Entrega (como toda mudança vai ao ar)
- Proposta (PR) com testes verdes e prévia; `VERSION` do `site/sw.js` sobe; o Kleber aprova com Merge.
- O Merge publica o site e, se mudaram, as regras do Firebase; a automação confere a versão no ar.
- Na mesma entrega: atualizar este arquivo, os docs afetados, a pasta `app/` do projeto e os cartões do Jira ([Entrega], Em análise).
- Limite de tamanho (D7): o link do jogador até 50 KB comprimido; ao abrir a gestão, até 95 KB; cada parte sob demanda (Partida, Caixa, Histórico, Votação, Ranking, Importar e apresentação), até 15 KB. Alvo: pelo menos 3 KB de folga; quando apertar, mover mais uma parte para sob demanda em vez de subir o limite (KAN-180, v61).
- Textos da gestão ficam em `src/i18n/pt-BR-gestao.js` e chegam com a parte de gestão; os do link público e do login, em `src/i18n/pt-BR.js`. A montagem barra o link público usando texto da gestão.
- Dívida técnica não piora (D12, KAN-154): a montagem falha se aumentar innerHTML, textos fora do dicionário ou arquivos sem tipos, ou se diminuírem as telas como componente (tetos em `docs/divida.json`).
- O GitHub confere toda proposta (KAN-157, `testes/conferir-entrega.mjs`): app mudou → VERSION sobe; componente `.tsx` novo em `src/ui/` ou classe nova no CSS → `docs/DESIGN-SYSTEM.md` muda; tela ou ação mudou → `docs/REGRAS.md` muda (ou "sem mudança de regra" na proposta); `firestore.rules` mudou → a proposta avisa; checklist da proposta sem item em branco.
- Tudo que grava tem caso no roteiro de gravação (KAN-170, `testes/persistencia_app.py`): grava, recarrega (F5), confere e, no fim, entra de novo num navegador limpo e confere tudo. No GitHub, a tarefa "persistencia" roda esse roteiro contra o emulador do Firebase (Firestore e login de verdade, com as regras). A conferência da entrega barra tipo de dado gravado sem caso (`testes/persistencia-cobertura.json`).
- Código num formato único (Prettier, `.prettierrc.json`); o GitHub recusa código fora do formato (KAN-155).
- Tela mexida, tela migrada: tela tocada vira componente TypeScript + Preact na mesma entrega, usando `src/ui/componentes.tsx`; componente visual novo entra antes no Design System (KAN-152, KAN-153).
- A gestão (telas e ações de quem tem conta, página inicial e convite) fica em `src/admin.js` e só baixa quando alguém entra com conta; o link público e a votação nunca a baixam (KAN-149). Tela ou ação nova de gestão entra por lá.

## Mapa de impacto (o que mexer quando muda X)
| Assunto | Tela | Ações | Regra (sem tela) | Dados no Firebase | Testes |
|---|---|---|---|---|---|
| Presença pelo link | `telas/PublicoRodada.tsx` | `acoes/publico.js` | `nucleo/edicoes.js` (setPres) | `rodadas/{rid}/presencas`, `limites/avulsos` | `testes_app.py` (link), `regras-firebase` (presença) |
| Vagas para diaristas e avulsos | `telas/Rodada.tsx` (PainelVagas, janela Abrir vagas; ligar em Mínimo e vagas), `telas/PublicoRodada.tsx` (esconde e avisa) | `acoes/rodada.js` (abrirVagas, salvarVagas, fecharVagas, salvarMinimos), `acoes/publico.js` | `dominio/vagas.ts`; `nucleo/edicoes.js` (setPres soma no contador); `dominio/caixa.js` (sincronizarVagas: marca dos diaristas) | `grupos/{gid}` (cfg.vagasCtrl), `jogadores/{id}` (vaga), `rodadas/{rid}` (vagas), `limites/vagas` | `regras/vagas`, `regras-firebase` (vagas), `testes_app.py` (CT-KAN-63), `persistencia_app.py` (P22) |
| Presença na gestão | `telas/Rodada.tsx` (com "Ainda não responderam") | `acoes/rodada.js` (cobrarGrupo) | `dominio/grupo.js` (attendance, curRodada), `dominio/cobrar.ts` | idem | `regras/cobrar`, `testes_app.py` (Rodada, CT-KAN-64) |
| Mínimo para o jogo | `ui/componentes.tsx` (PorPosicao, na Rodada e no link), `telas/Rodada.tsx` (janela Mínimo) | `acoes/rodada.js` (abrirMinimos, salvarMinimos) | `dominio/posicoes.ts` | `grupos/{gid}` (cfg.minPos) | `regras/minimo-posicao`, `testes_app.py` (CT-KAN-179), `persistencia_app.py` (P21) |
| Sorteio e times | `telas/Rodada.tsx` | `acoes/rodada.js` | `dominio/sorteio.js`, `times.ts`, `divergencia.ts` | `rodadas/{rid}` (times, cores, base) | `regras/times`, `lista-sorteio` |
| Partida e ranking | `telas/Partida.tsx` (placar em `ui/placar.js`; janela Editar; baixa sob demanda por `src/partida.ts`), `ranking.js` | `acoes/partida.js` (saveMatch, editarPartida, salvarEdicao), `acoes/recalcular.ts` | `nucleo/partidas.js` (addMatch, editMatch, delMatch, salvarArtilharia), `dominio/resumos.ts` (camposPartida, camposEdicao, camposArtilharia), `dominio/fila.ts` (próximo jogo), `dominio/escalacao.ts` (empréstimo e troca) | `rodadas/{rid}/partidas` (com `ver`), `resumos/{mês}` | `regras/ranking`, `regras/editar-partida`, `regras/fila`, `regras-firebase` (partidas), `regras/escalacao`, `regras/artilharia`, `testes_app.py` (CT-KAN-175 a CT-KAN-178), `persistencia_app.py` (P13, P13b, P13c) |
| Importar elenco | `ui/ImportarJogadores.tsx`, `telas/Jogadores.tsx` | `acoes/jogadores.js` (importarJogadores) | `dominio/planilha.ts`, `ui/arquivo-planilha.ts` | `jogadores/{id}`, `privado/caixa`, `privado/ratings`, `privado/contatos` | `regras/planilha`, `testes_app.py` (CT-KAN-159) |
| País, moeda e fuso | `ui/menu-conta.ts` (menu da conta, KAN-166), `grupo-form.js`, `login.js` (cadastro), `ui/regiao.ts` (combos), `ui/contato-form.ts` (telefone) | `acoes/grupo.js` (contaPais, createGroup, saveGroup) | `dominio/paises.ts`, `regiao.ts`, `telefone.ts`, `i18n/formatos.js` (formato, moeda, `agora()`) | `usuarios/{uid}` (pais, formato), `grupos/{gid}` (cfg.pais, moeda, fuso, formato) | `regras/paises`, `regras/contato`, `testes_app.py` (CT-KAN-162) |
| Votação | `telas/votacao.js`, `publico-voto.js` | `acoes/votacao.js` | `telas/votacao.js` (tally) | `votacoes/{vid}`, `votos` | `testes_app.py` (votação) |
| Caixa | `telas/Caixa.tsx` | `acoes/caixa.js` (com a conferência de valor fora do padrão) | `dominio/caixa-regras.ts` (pendências, foraDoPadrao), `caixa.js` | `caixa/{id}`, `privado/caixa`, `resumos` | `regras/caixa`, `regras/fora-do-padrao`, `testes_app.py` (CT-KAN-161) |
| Isento e A pagar por jogo | `ui/dialogos-gestao.js` (ficha), `telas/Caixa.tsx` (A pagar, janela Pagar) | `acoes/jogadores.js` (savePlayer), `acoes/caixa.js` (abrirPagar, pagarJogos) | `dominio/caixa-regras.ts` (aPagar), `caixa.js` (recebePorJogo, inicioAPagar); rodadas desde o início em `rotas.js` (rodPag) | `privado/caixa` (tipos, porJogo), `caixa/{id}` (refs) | `regras/a-pagar`, `testes_app.py` (CT-KAN-172), `persistencia_app.py` (P20) |
| Grupo e convite | `telas/grupo.js`, `grupo-form.js`, `convite.js` | `acoes/grupo.js` | `dominio/limites.ts` | `grupos/{gid}`, `membros`, `privado/convite`, `contas/{uid}` | `regras/limites`, `regras-firebase` |
| Planos e portal | `portal/` | `portal/tela.js` | `dominio/planos.ts` | `contas/{uid}`, `sistema/planos` | `regras/planos`, portal em `testes_app.py` |
| Janelas e avisos | `ui/dialogos.js`, `nucleo/util.js` (toast) | `acoes/conta.js` (confSim) | — | — | `testes_app.py` (CT-KAN-128) |
| Tamanho e carga | `ui/render.js` (espera a gestão e as abas sob demanda) | `acoes.js` (só públicas) | `admin.js` (carregarPartida, carregarAba), `abas/*.ts` (Caixa, Histórico, Votação, Ranking), `nucleo/carga-admin.js`, `build.mjs` | — | `testes_app.py` (CT-KAN-149, CT-KAN-180) |
| Esportes | catálogo em `dominio/esportes.js` | — | — | `grupos/{gid}` (sport, posx) | `testes_app.py` (outros esportes, CT-KAN-75) |
| Abertura do app instalado | `ui/render.js` (home) | `acoes/conta.js` (Sair) | `inicio.js` (marca `nj-organizador`, último link `pelada-last`) | nenhum (só o aparelho) | `testes_app.py` (CT-KAN-171) |
Qualquer mudança em `firestore.rules` afeta todas as linhas: rodar o emulador (`testes/regras-firebase`) e avisar o Kleber.
