# Nosso Jogo — visão do produto e decisões

Última atualização: outubro de 2026 (versão `pelada-v14` do `sw.js`: link do jogador mais leve, aba Histórico e gravação da rodada só no que mudou).

## O produto
Plataforma para **qualquer pessoa no mundo** organizar seus jogos recorrentes ou esporádicos, de **qualquer esporte**. Uma mesma pessoa costuma organizar mais de um jogo e praticar mais de um esporte, então cada conta pode ter **vários grupos**.

**Público:** quem organiza o jogo da semana (a "pelada", o vôlei da firma, o beach tennis de domingo).

**Proposta:** times justos, lista fechada, caixa em dia. Os jogadores confirmam por um link, sem baixar app e sem criar conta.

## Princípios
1. **O jogador não precisa de conta.** Ele recebe um link pelo WhatsApp e confirma presença ou vota direto no navegador.
2. **Só o organizador e os administradores têm conta,** com e-mail e senha forte ou com a conta Google.
3. **Cada grupo é independente:** dados, elenco, rodadas, caixa e administradores.
4. **Privacidade:** notas, caixa (incluindo mensalidade, diária e chave Pix), contatos, tipo do jogador (mensalista ou diarista) e os votos individuais só são vistos por administradores. Os links públicos mostram nomes, posições, presença, times e resultados. A proteção vale nas regras do Firebase, não só na tela.
5. **Esporte configurável:** posições, pontuação, duplas e categorias de votação vêm do catálogo, sem nada fixo de futebol.
6. **Celular primeiro e funcionando com sinal fraco** (PWA, com placar e cronômetro offline; ao abrir, espera no máximo 3 segundos pela rede antes de usar a cópia salva). A página só recarrega sozinha quando uma versão nova substitui a antiga (pelo botão "Atualizar"), nunca na primeira visita.

## Infraestrutura atual
- **Código e publicação (decisão de 7 out. 2026):**
  - o código fica no GitHub, em `kleberkoch-coder/nosso-jogo` (privado);
  - cada versão nova chega como proposta de mudança (*pull request*) e roda os testes automáticos;
  - o Netlify gera um link de prévia de cada proposta;
  - o Kleber aprova com **Merge**. Só então o Netlify publica o site e, se o `firestore.rules` mudou, o GitHub publica as regras no Firebase. A chave usada (conta `publicar-regras-github`) só publica regras e não lê dados dos grupos;
  - não se arrasta mais a pasta no Netlify;
  - os documentos deste projeto espelham a versão proposta mais recente.
- **Hospedagem:** Netlify (`nossosjogos.netlify.app`, site `nossosjogos`), ligado ao GitHub (pasta `site/`). O projeto precisa estar como público no Netlify.
- **Banco e login:** Firebase, projeto `nosso-jogo-f4762`, com Firestore e Authentication (provedores E-mail/senha, Google e Anônimo ativados).
- **Código (pelada-v14):** JavaScript, HTML e CSS (o link do jogador já em TypeScript + Preact) (Firebase compat v10 via CDN), em módulos na pasta `src/`, montados pelo esbuild num único `index.html`. Detalhes e decisões técnicas em `docs/ARQUITETURA.md`.
- **Modo demonstração:** quando a configuração do Firebase está vazia, os dados ficam só no navegador. É usado para testar.

## Rotas (endereços)
| Endereço | O que é |
|---|---|
| `#/` | Página de vendas, para quem não está logado; "Meus grupos", para quem está logado. |
| `#/criar` e `#/entrar` | Cadastro e login. O cursor já fica no e-mail. |
| `#/g/{grupo}` | Área de gestão do grupo (administradores). |
| `#/p/{grupo}` | Link permanente público: sempre a próxima rodada. |
| `#/p/{grupo}/r/{rodada}` | Rodada específica (pública). |
| `#/p/{grupo}/v/{votação}` | Votação pública. |
| `#/convite/{grupo}/{token}` | Convite para ser administrador. |

## Contas, login e navegação
- **Entrar com Google** (decisão de outubro de 2026, v11): alternativa ao e-mail e senha, nunca substituta.
  - O botão "Continuar com Google" aparece nas abas "Criar conta" e "Entrar" e na tela de convite.
  - Abre a janela de escolha de conta; se o navegador bloquear janelas, usa o redirecionamento de página.
  - Em navegadores embutidos (Instagram, Facebook e similares), onde o Google bloqueia o login, o app orienta abrir no Chrome ou Safari.
  - O mesmo e-mail no Google e na senha é a mesma conta (mesmos grupos).
  - As regras do Firestore valem igual para qualquer login que não seja anônimo.
- Erros de login aparecem em português abaixo do formulário. Fechar a janela do Google não mostra erro. Botões de login não têm limite de tempo (giram até a resposta), porque não existe "salvar para depois" em login.
- A senha exige no mínimo 8 caracteres, 1 maiúscula, 1 número e 1 caractere especial, com checklist ao vivo e confirmação de senha.
- A tela de login tem as abas "Criar conta" e "Entrar". No primeiro acesso do aparelho, ela abre em "Criar conta".
- Depois do login:
  - nenhum grupo: abre "Meus grupos" com a janela de criar grupo aberta;
  - um grupo ativo: abre direto nele;
  - mais de um: abre "Meus grupos".
- O botão "⇄ Grupos" no topo troca de grupo.

## Grupos
- **Ao criar, nesta ordem:**
  1. nome;
  2. frequência: **Frequente**, com dias fixos, ou **Esporádico**;
  3. dias e horários, só no frequente (vários dias por semana, cada um com início, término e local);
  4. esporte.
- **Nomes:** não pode repetir nome dentro da conta da pessoa, incluindo grupos inativos. A comparação ignora maiúsculas, acentos e espaços. Grupos de pessoas diferentes podem ter o mesmo nome.
- **Edição:** pela aba **Grupo** > Editar grupo, com o mesmo formulário da criação.
- **Data de criação:** gravada e imutável (as regras garantem).
- **Inativar:** só o organizador pode, e pode reativar. O grupo inativo:
  - sai da lista principal;
  - não aceita confirmações nem votos;
  - não gera a rodada fixa;
  - mantém o histórico.
- **Duplicar:** cria um grupo independente com esporte, frequência, horários, posições e configurações de partidas e caixa. O elenco é opcional. Rodadas, caixa, votações e administradores não são copiados, e quem duplica vira organizador.
- **Papéis:**
  - O organizador é o dono.
  - Os administradores entram por **link de convite**. Quem abre o link cria a conta ou entra e toca em "Aceitar convite". O link pode ser invalidado.
  - Só o organizador remove administradores, e **remover um administrador apaga o link de convite atual**, para a pessoa não voltar sozinha.

## Esportes (catálogo `SPORTS`)
| Esporte | Posições | Pontuação |
|---|---|---|
| Futebol, Society, Futsal | GOL, DEF, MEI, ATA (posição-chave: GOL) | Gol, com gol contra |
| Basquete | ARM, ALA, PIV | +1, +2, +3 |
| Vôlei | LEV, PON, CEN, OPO, LIB (posição-chave: LEV) | Ponto |
| Vôlei de praia, Futevôlei, Beach tennis | Sem posição, **sorteio em duplas** | Ponto ou Game |
| Handebol | GOL, ARM, PON, PIV | Gol, com gol contra |
| Futebol americano | QB, ATQ, LIN, DEF | TD 6, Extra 1, 2 pts, FG 3, Safety 2 |
| Flag football | QB, ATQ, DEF | TD 6, Extra 1 ou 2 |
| Rugby | FOR, BAC | Try 5, Conversão 2, Penal 3, Drop 3 |
| Hóquei | GOL, DEF, ATA | Gol, com gol contra |
| Outro | O nome do esporte é escrito pelo usuário | Ponto |

Cada grupo pode **criar posições próprias** (sigla de até 4 letras e nome) em Grupo > Posições, somadas às do esporte.

## Jogadores
- **Ficha:** nome, posição, **nota de 1 a 10 com meio ponto**, tipo (mensalista ou diarista), telefone/WhatsApp, e-mail opcional e data de cadastro.
- Pode ser inativado (separado de excluir). O inativo sai das listas e mantém o histórico.
- **Avulsos:**
  - Ficam registrados em "Avulsos que já jogaram", com posição, nota e contato, **só depois de entrarem num sorteio** (ou quando o administrador os adiciona na rodada).
  - Quem só se adicionou pelo link aparece apenas na lista daquela rodada, para nomes inventados não virarem cadastro.
  - Quando voltam, escolhem o nome (no link, digitando; na rodada, pela lista) e mantêm o mesmo cadastro.
  - Podem ser promovidos ao elenco sem perder o histórico.
- **Pares "não colocar no mesmo time".**
- A sigla da posição aparece em todas as listas, inclusive no link público.

## Rodadas e presença
- **Frequente:** a próxima rodada de cada dia fixo existe automaticamente. O link permanente vira para a semana seguinte quando o jogo termina. Uma data pode ser cancelada (feriado).
- **Esporádico:** o administrador cria cada rodada (data, horário, término, local).
- O jogador confirma no link com **Vou** ou **Não vou**. Quem não está na lista se adiciona como avulso.
- O administrador pode marcar presença por quem respondeu fora do link e pode **fechar a lista**.
- **Lista fechada vale para todos** (pelada-v15): nem o link nem a aba Rodada mudam presença. O administrador vê a situação de cada um e reabre a lista se precisar.
- **Presença mudada por outro aparelho** (decisão de outubro de 2026: registrar e avisar em vez de travar, para não bloquear quem troca de navegador):
  - A resposta continua livre: qualquer pessoa com o link marca qualquer nome.
  - Cada presença guarda o aparelho que respondeu primeiro (`dev`) e quem gravou por último (`by`).
  - Quando outro aparelho que não é de administrador muda a resposta, a aba Rodada mostra um aviso.
  - A correção pelo administrador remove o aviso.
- **Sem sinal:** se a gravação não termina em 5 segundos no link público (9 segundos na gestão), o botão para de girar e o app avisa que ficou salvo no aparelho e será enviado quando a conexão voltar. "Presença confirmada" só aparece depois de salvar no servidor.

## Sorteio (regra de negócio)
- **Entrada:** confirmados (com possibilidade de desmarcar), quantidade de times (ou duplas automáticas) e o nível de "variar parceiros" (Não, Pouco, Médio, Muito).
- **O que ele minimiza:**
  1. diferença de nota média entre os times;
  2. desequilíbrio de posições, com peso alto para a posição-chave;
  3. craques (nota 9 ou mais) concentrados;
  4. pares que não podem ficar juntos (peso muito alto);
  5. parcerias repetidas no histórico, com peso maior para rodadas recentes.
- **Como funciona:** testa centenas de combinações com trocas sucessivas e escolhe aleatoriamente entre as melhores, para variar.
- A nota de 1 a 10 é dividida por 2 internamente, mantendo o peso que existia na escala antiga de 1 a 5.
- **Depois do sorteio:**
  - o administrador vê a diferença de nota, a distribuição da posição-chave, as separações respeitadas e o percentual de parcerias novas;
  - pode mover jogadores e trocar a cor do colete.
- **Sortear fecha a lista** (pelada-v15) e guarda a "foto" dos confirmados daquele momento.
- **Pôr direto no time** (pelada-v15): com os times gerados, o administrador põe uma pessoa num time ("+ Pôr no time") e ela já entra confirmada. Não existe em esportes de dupla.
- **Lista diferente dos times** (pelada-v15):
  - se a lista for reaberta, mudar presença no app pede confirmação;
  - a aba Rodada avisa quem não vai mais (estava num time) e quem confirmou depois do sorteio, venha a mudança do app ou do link; no link nada muda;
  - quem foi desmarcado de propósito na tela do sorteio não gera aviso;
  - para resolver: "Sortear de novo", "Manter os times assim" ou, por pessoa, "Tirar do time" e "Pôr no time" (em duplas, só as duas primeiras).

## Partida, ranking, votação e caixa
- **Partida:**
  - placar com os botões de pontuação do esporte e autor de cada ponto;
  - cronômetro com alarme;
  - com 3 ou mais times, quem ganha fica e o próximo time entra.
- **Ranking:** pontos (3 por vitória, 1 por empate), jogos, vitórias, empates, derrotas, aproveitamento, gols ou pontos do esporte, destaques e bagres das votações. Também mostra o histórico de rodadas.
- **Votação:**
  - categorias: melhor jogador, melhor da posição-chave, melhor por posição, bagre e categoria livre;
  - um voto por aparelho, pelo link; cada aparelho lê só o próprio voto (limite conhecido: outro navegador pode votar de novo);
  - o resultado é publicado ao encerrar;
  - ao criar, a janela troca para o link da votação, pronto para o WhatsApp (corrigido na v12: antes ela fechava sozinha).
- **Caixa:**
  - mensalidade, diária (diaristas e avulsos que jogaram), outras entradas e despesas;
  - pendências do mês e cobrança pronta para o WhatsApp, com Pix.

## Padrões de interface
- **Design System** (`claude/DESIGN-SYSTEM.md` e a página do Design System): fonte da verdade para cores, tipografia, componentes e acessibilidade. Valores novos entram primeiro nele.
- Loading em todo botão de ação. As janelas só fecham depois que a gravação termina.
- O cursor já vem no primeiro campo relevante, e o Enter envia.
- Os textos de compartilhamento são gerados prontos para o WhatsApp.
- **Visual (decisão de 7 out. 2026, Design System v2, direção "Equilíbrio"; aplicado na `pelada-v12`):**
  - tema campo e colete em tons pastel;
  - o verde-gramado forte fica só no cabeçalho e no placar, pela identidade e pela leitura do placar no sol;
  - botões, chips e estados em pastel com texto escuro (menta, limão suave, coral);
  - fontes Barlow Condensed e Figtree;
  - contraste WCAG 2.2 AA nos dois temas;
  - alvos de toque de 44px nos botões principais do celular.
- **Tema (decisão de 7 out. 2026, aplicado na `pelada-v12`):**
  - seletor com **Automático** (padrão, segue o celular), **Claro** e **Escuro**;
  - chip no cabeçalho de todas as telas, inclusive no link público para jogadores sem conta, e opção em **Grupo > Aparência**;
  - a escolha fica salva no aparelho (`localStorage`, chave `nj-tema`) e é aplicada antes de desenhar a página;
  - tocar fora do menu só fecha o menu, sem acionar o que está embaixo.
- **Link público:** Vou e Não vou com 44px de altura e ✓ / ✕ quando marcados.
- **Cronômetro:** além do som e da vibração, mostra o aviso visual "Tempo esgotado".

## Modelo de dados (Firestore)
```
usuarios/{uid}                      → lista "Meus grupos" da conta
grupos/{gid}                        → nome, esporte, freq, ativo, cfg (fixos, minutos, local), posx, owner, createdAt  [leitura pública; regras impedem gravar nova chave Pix aqui]
grupos/{gid}/membros/{uid}          → administradores (owner/admin)
grupos/{gid}/privado/ratings        → notas (nivel) e pares separados  [só admins]
grupos/{gid}/privado/contatos       → telefones e e-mails  [só admins]
grupos/{gid}/privado/convite        → token do link de convite  [só admins]
grupos/{gid}/privado/caixa          → mensal, diaria, pix, tipos {id: mensalista|diarista}  [só admins]
grupos/{gid}/jogadores/{id}         → elenco: nome, posição, ativo, criado  [leitura pública]
grupos/{gid}/avulsos/{id}           → avulsos registrados (nome, posição)  [leitura pública]
grupos/{gid}/rodadas/{rid}          → rodada, times, partidas  [leitura pública]
grupos/{gid}/rodadas/{rid}/presencas/{id}  → confirmações: s, t, by, dev, nome, avulso, pos (qualquer pessoa com o link grava; dev não muda)
grupos/{gid}/caixa/{id}             → lançamentos  [só admins]
grupos/{gid}/votacoes/{vid}         → votação  [leitura pública]
grupos/{gid}/votacoes/{vid}/votos/{uid}    → um voto por aparelho  [cada aparelho lê o próprio; admins leem todos]
```
Rodadas de jogo fixo têm o id `f-AAAA-MM-DD-HHMM` e podem receber presença antes do documento existir.

Migração (v10): grupos antigos com valores e Pix em `cfg` e `tipo` nos jogadores são migrados para `privado/caixa` automaticamente quando um administrador abre o grupo.

## Ideias e pendências
- Revisar o texto "Quanto custa?" da página de vendas se o produto passar a ser cobrado.
- **Arquitetura (decisões de 8 out. 2026, detalhes em `docs/ARQUITETURA.md`):**
  - sem microsserviços nem filas próprias por enquanto: o Firebase já cresce sozinho, e as gravações simultâneas mais comuns são separadas por documento;
  - front-end em módulos (feito na v13) e, nas próximas entregas, telas como componentes em TypeScript e Preact, uma por vez, começando pelo link público;
  - vários idiomas: textos num dicionário por idioma (base `pt-BR`); feito para as telas públicas e avisos, as demais telas migram junto com a componentização;
  - próximos passos técnicos: transações na gravação da rodada (sorteio e placar), Firebase App Check e limites contra abuso antes de começar a cobrar;
  - banco: ficamos no Firestore; outros bancos só como apoio (BigQuery para relatórios, PostgreSQL se o financeiro pedir), cada dado com um único banco dono;
  - **desempenho (feito na v14):** o link do jogador carrega só a próxima rodada; a aba Rodada mostra as próximas e as últimas 4, e a presença de cada rodada só carrega ao escolher; a **aba Histórico** busca rodadas antigas por mês ou período e mostra lista, times, partidas e votação de cada uma;
  - **desempenho (planejado, v15):** partidas numa subpasta da rodada; ranking e caixa com totais prontos por mês e botão Recalcular;
  - **gravação da rodada (feito na v14):** só os campos que mudaram, para dois administradores não apagarem o trabalho um do outro; funciona sem internet (por isso não usamos transações);
  - **linguagem e dívida técnica (D12):** ficamos em JavaScript, migrando para TypeScript; toda tela mexida vira componente na mesma entrega, cada pacote leva um cartão técnico, e um painel medido a cada versão acompanha a evolução;
  - **cobrança por partes do serviço** (intenção de out. 2026): o plano de cada grupo será gravado só pelo servidor (Cloud Functions ligadas ao pagamento) e conferido nas regras do Firebase, nunca só na tela.
- Política de senha também no Firebase (Authentication > Configurações), se disponível.
- **Ícones do app:**
  - na `pelada-v12` foram recriados com as cores novas: verde-gramado `#1F5A40`, círculo em cal e ponto limão;
  - os arquivos de imagem não ficam nos documentos do projeto; a referência é a pasta `site/icons/` do GitHub.
- **Limites conhecidos:**
  - a votação permite votar de novo em outro navegador;
  - a presença pode ser marcada por qualquer pessoa com o link (registrado e avisado).
