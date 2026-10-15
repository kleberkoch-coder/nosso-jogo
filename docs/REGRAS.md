# Nosso Jogo: regras em vigor (resumo)

Leia este arquivo primeiro. Ele traz só o que vale hoje, uma linha por regra. O histórico e o detalhe ficam em `VISAO-DO-PRODUTO.md` (produto), `docs/ARQUITETURA.md` (técnica, decisões D1 a D16) e `DESIGN-SYSTEM.md` (visual). O código entre parênteses é o cartão do Jira.
Atualizado na pelada-v40 (15/10/2026). Toda entrega que mudar uma regra atualiza a linha aqui, na mesma proposta.

## Princípios
- O jogador nunca precisa de conta: confirma e vota pelo link do WhatsApp.
- Só organizador e administradores têm conta: e-mail com senha forte ou Google.
- "Continuar com o Google" entra ou cria a conta em qualquer aba; se a aba não bater, o app avisa (KAN-142).
- Senha: 8+ caracteres, maiúscula, minúscula, número e um especial da lista do Firebase (`^ $ * . [ ] { } ( ) ? " ! @ # % & / \ , > < ' : ; | _ ~`). Vale no app (`telas/login.js`) e na política de senha do Firebase, em modo Exigir; as duas mudam juntas (KAN-10).
- Cada grupo é independente: elenco, rodadas, caixa, votações e administradores.
- Nada específico de esporte no código: posições, pontuação, duplas e textos vêm do catálogo `SPORTS`.
- Celular primeiro, funciona com sinal fraco (grava no aparelho e envia depois).
- Vários idiomas: nenhum texto de tela fica no código; tudo vai para o dicionário (`i18n/pt-BR.js`, chamado por `tx`). Tela mexida migra seus textos na mesma entrega (D3).

## Privacidade e segurança (valem nas regras do Firebase, não só na tela)
- Só administradores veem notas, caixa (mensalidade, diária, Pix), contatos, tipo do jogador e votos individuais.
- Links públicos mostram nomes, posições, presença, times e resultados.
- Pix, mensalidade e diária nunca no documento público do grupo; ficam em `privado/caixa` (KAN-79).
- Identificador vindo do link só com letras, números, `_` e `-` (KAN-76). Todo texto do banco é escapado antes da tela.
- Pelo link: ninguém fura a ordem, troca o nome, a posição ou a marca de avulso de outro (KAN-78); presença só em jogos de ontem até 15 dias à frente (KAN-77).
- Limites: 30 avulsos novos pelo link por rodada e 20 grupos criados por conta, por contadores nas regras; os números ficam em `sistema/limites` (KAN-89, KAN-134).
- Qualquer um lê um grupo pelo link; só o portal lista todos os grupos (KAN-133).
- Sair apaga a cópia local dos dados; com algo sem enviar, pergunta antes (KAN-80).
- App Check em observação; ligar o bloqueio antes de cobrar (KAN-88, lembrete em 20/10).
- Mudança no `firestore.rules`: testes no emulador e aviso destacado ao Kleber; é publicada no Merge.

## Grupos e papéis
- Ao criar: nome, frequência (Frequente com dias fixos ou Esporádico), dias e horários (só Frequente), esporte.
- Nome não repete dentro da conta (ignora maiúsculas, acentos e espaços).
- Jogadores por time é do grupo (o esporte só dá o padrão); 2 = duplas.
- Inativar só o organizador: some da lista, não aceita presença nem voto, não gera rodada fixa, mantém histórico.
- Duplicar copia configuração e, se quiser, o elenco; não copia rodadas, caixa, votações nem administradores.
- Administradores entram por link de convite; só o organizador remove, e remover invalida o link atual.

## Jogadores
- Ficha: nome, posição, nota de 1 a 10 (meio ponto), tipo mensalista ou diarista, contato. Inativar é diferente de excluir.
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

## Partida, ranking e votação
- Placar com a pontuação do esporte e o autor; cronômetro com alarme; com 3+ times, quem ganha fica.
- Cada partida guarda quem jogou: re-sorteio não altera o ranking.
- Ranking: 3 por vitória, 1 por empate; filtro de ano e mês; vem de totais por mês (`resumos/{AAAA-MM}`), com botão Recalcular.
- Votação: um voto por aparelho pelo link (limite conhecido: outro navegador vota de novo); resultado ao encerrar.

## Caixa
- Mensalidade (quem não é diarista, por mês), diária (diaristas e avulsos que jogaram, por rodada), outras entradas e despesas.
- Pendências do mês e cobrança pronta para o WhatsApp com Pix. Regra em `dominio/caixa-regras.ts`, com teste.
- "Recebi" grava na hora com Desfazer por 6 s; apagar lançamento também tem Desfazer (KAN-129).

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
- Horários (início e término) são escolhidos numa lista de 15 em 15 minutos, nunca no relógio do celular, que corta botões no Android com letra grande (KAN-151).
- Alvos de toque: 44px nos principais, 36px nos pequenos. Contraste WCAG AA nos temas claro e escuro.

## Entrega (como toda mudança vai ao ar)
- Proposta (PR) com testes verdes e prévia; `VERSION` do `site/sw.js` sobe; o Kleber aprova com Merge.
- O Merge publica o site e, se mudaram, as regras do Firebase; a automação confere a versão no ar.
- Na mesma entrega: atualizar este arquivo, os docs afetados, a pasta `app/` do projeto e os cartões do Jira ([Entrega], Em análise).
- Limite de tamanho: 80 KB comprimido (D7).

## Mapa de impacto (o que mexer quando muda X)
| Assunto | Tela | Ações | Regra (sem tela) | Dados no Firebase | Testes |
|---|---|---|---|---|---|
| Presença pelo link | `telas/PublicoRodada.tsx` | `acoes/publico.js` | `nucleo/edicoes.js` (setPres) | `rodadas/{rid}/presencas`, `limites/avulsos` | `testes_app.py` (link), `regras-firebase` (presença) |
| Presença na gestão | `telas/rodada.js` | `acoes/rodada.js` | `dominio/grupo.js` (attendance, curRodada) | idem | `testes_app.py` (Rodada) |
| Sorteio e times | `telas/rodada.js` | `acoes/rodada.js` | `dominio/sorteio.js`, `times.ts`, `divergencia.ts` | `rodadas/{rid}` (times, cores, base) | `regras/times`, `lista-sorteio` |
| Partida e ranking | `telas/partida.js`, `ranking.js` | `acoes/partida.js` | `nucleo/partidas.js`, `dominio/resumos.ts` | `rodadas/{rid}/partidas`, `resumos/{mês}` | `regras/ranking` |
| Votação | `telas/votacao.js`, `publico-voto.js` | `acoes/votacao.js` | `telas/votacao.js` (tally) | `votacoes/{vid}`, `votos` | `testes_app.py` (votação) |
| Caixa | `telas/Caixa.tsx` | `acoes/caixa.js` | `dominio/caixa-regras.ts`, `caixa.js` | `caixa/{id}`, `privado/caixa`, `resumos` | `regras/caixa` |
| Grupo e convite | `telas/grupo.js`, `grupo-form.js`, `convite.js` | `acoes/grupo.js` | `dominio/limites.ts` | `grupos/{gid}`, `membros`, `privado/convite`, `contas/{uid}` | `regras/limites`, `regras-firebase` |
| Planos e portal | `portal/` | `portal/tela.js` | `dominio/planos.ts` | `contas/{uid}`, `sistema/planos` | `regras/planos`, portal em `testes_app.py` |
| Janelas e avisos | `ui/dialogos.js`, `nucleo/util.js` (toast) | `acoes/conta.js` (confSim) | — | — | `testes_app.py` (CT-KAN-128) |
| Esportes | catálogo em `dominio/esportes.js` | — | — | `grupos/{gid}` (sport, posx) | `testes_app.py` (outros esportes) |
Qualquer mudança em `firestore.rules` afeta todas as linhas: rodar o emulador (`testes/regras-firebase`) e avisar o Kleber.
