# Nosso Jogo — como colocar no ar

O Nosso Jogo é uma plataforma para qualquer pessoa organizar seus jogos (futebol, vôlei, basquete, futevôlei, beach tennis, handebol, futebol americano, rugby e outros). Cada organizador cria a conta, monta um grupo para cada jogo e manda o link para os jogadores confirmarem.

Arquivos desta pasta:

- `index.html`: o site inteiro.
- `manifest.webmanifest`, `sw.js` e a pasta `icons/`: o que faz o site virar app no celular (PWA).
- `firestore.rules`: as regras de segurança do banco de dados.
- `LEIA-ME.md`: este guia.

Publique sempre a **pasta inteira**.

Antes de configurar qualquer coisa, dá para testar: abra o `index.html` no navegador. Ele roda em **modo demonstração**, com os dados salvos só naquele navegador. Crie uma conta qualquer, assuma como organizador e experimente.

Para usar de verdade com o grupo, siga os passos abaixo. Leva uns 15 minutos e não tem custo.

---

## 1. Criar o projeto no Firebase

1. Acesse **console.firebase.google.com** e entre com uma conta Google.
2. Clique em **Criar um projeto** (ou "Adicionar projeto") e dê um nome, por exemplo `pelada-do-sabado`.
3. O Google Analytics pode ser desativado, porque não é necessário. Conclua a criação.

## 2. Ativar o login

1. No menu da esquerda, abra **Criação > Authentication** e clique em **Vamos começar**.
2. Na aba **Método de login**, ative estes três métodos:
   - **E-mail/senha**: login dos administradores com e-mail e senha.
   - **Google**: permite que os administradores entrem com a conta Google, sem criar senha. Ao clicar em **Google**:
     - ligue a chave **Ativar**;
     - preencha o **Nome do projeto exibido ao público** (por exemplo `Nosso Jogo`, que aparece na janela do Google);
     - escolha o seu e-mail em **E-mail de suporte do projeto**;
     - clique em **Salvar**.
   - **Anônimo**: permite que os jogadores confirmem presença pelo link sem criar conta.

## 3. Criar o banco de dados

1. No menu, abra **Criação > Firestore Database** e clique em **Criar banco de dados**.
2. Escolha o local **southamerica-east1 (São Paulo)** e o **modo de produção**.
3. Depois de criado, abra a aba **Regras**. Apague o conteúdo, cole todo o arquivo `firestore.rules` e clique em **Publicar**.

## 4. Ligar o site ao seu projeto

1. Clique na engrenagem ao lado de "Visão geral do projeto" e entre em **Configurações do projeto**.
2. Em **Seus apps**, clique no ícone **Web** (`</>`), dê um apelido e registre. Não precisa marcar o Hosting.
3. Vai aparecer um bloco `firebaseConfig = { apiKey: "...", ... }`.
4. Abra o `index.html` num editor de texto (Bloco de Notas serve). Logo no começo há o bloco `window.FIREBASE_CONFIG`. Preencha cada campo com os valores do seu projeto e salve.

Observação: esses dados não são senha. Eles ficam visíveis no site por natureza, e quem protege os dados são as regras do passo 3.

## 5. Publicar o site

O site fica no **Firebase Hosting**, no mesmo projeto do banco, e é publicado pelo GitHub a cada Merge (veja "Como as versões novas vão para o ar"). Na primeira vez:

1. No [console do Firebase](https://console.firebase.google.com), abra o projeto, clique em **Criação** > **Hosting** > **Vamos começar** e avance até **Continuar para o console** (as instruções de instalação podem ser ignoradas).
2. No [Google Cloud](https://console.cloud.google.com), em **IAM e administrador** > **IAM**, deixe a conta de serviço usada pelo GitHub (`publicar-regras-github@...`) só com estes 5 papéis: **Administrador das regras do Firebase**, **Administrador do Firebase Hosting**, **Leitor de chaves de API**, **Leitor do Service Usage** e **Consumidor do Service Usage**. Não use **Administrador do Firebase**: ele também lê os dados dos grupos.
3. Se usar o App Check, inclua `seuprojeto.web.app` e `seuprojeto.firebaseapp.com` nos domínios da chave do reCAPTCHA.

Os endereços `seuprojeto.web.app` e `seuprojeto.firebaseapp.com` já vêm autorizados no login do Firebase. Um domínio próprio entra em **Hosting** > **Adicionar domínio personalizado**, e também precisa ir para **Authentication** > **Configurações** > **Domínios autorizados**.

## 6. Primeiro acesso

O endereço principal (`https://seuprojeto.web.app/`) abre a **página de apresentação** do produto, com os botões **Criar conta grátis** e **Entrar**.

1. Clique em **Criar conta grátis**.
   - O jeito mais rápido é tocar em **Continuar com Google** e escolher a sua conta.
   - Se preferir e-mail e senha, a senha precisa ter pelo menos 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial (por exemplo `Jogo@2026`).
2. Clique em **Criar meu grupo** e preencha:
   - **Nome:** não pode repetir o nome de outro grupo seu.
   - **Frequência:** **Frequente**, para quem joga em dias fixos toda semana, ou **Esporádico**, para quem só joga de vez em quando.
   - **Dias e horários** (só para frequente): um ou mais dias na semana, cada um com horário próprio de início e término e local opcional. Por exemplo, segunda das 20:00 às 22:30 e quinta das 19:00 às 20:30.
   - **Esporte:** define as posições, a pontuação do placar e as categorias da votação.
3. Na aba Jogadores, cadastre o elenco. A ficha de cada jogador tem:
   - posição;
   - **nota de 1 a 10** (vale meio ponto, como 7,5);
   - tipo (mensalista ou diarista);
   - telefone/WhatsApp e e-mail, opcionais;
   - data de cadastro.

   Jogador que parou de vir pode ser **inativado**: ele sai das listas, mas o histórico fica.

**Avulsos:**
- **Pelo link:** o avulso que se adiciona aparece só na lista daquela rodada. Ele passa a ficar registrado em Jogadores > "Avulsos que já jogaram", com posição e nota, quando entra no sorteio, ou seja, quando joga de verdade. Assim, nomes inventados no link não viram cadastro permanente.
- **Pelo administrador:** o avulso adicionado na rodada é registrado na hora.
- **Quando ele volta:** no link, basta começar a digitar o nome e tocar em "Já jogou aqui". Na rodada, o administrador escolhe o nome na lista. Não é preciso preencher tudo de novo.

**Posições:** cada esporte já vem com as suas. Em **Grupo > Posições** você cria outras (sigla de até 4 letras e nome, como VOL – Volante).

**Duplicar grupo:** em **Grupo > Duplicar grupo** você cria um grupo novo a partir de um existente, com o mesmo esporte, horários, posições e configurações e, se quiser, o elenco. Os dois ficam totalmente independentes: rodadas, caixa e votações não são copiados.

**Aba Grupo:** mostra a ficha do grupo (nome, esporte, frequência, dias e horários, **data de criação** e status). Ali você pode:
- **Editar grupo**, alterando qualquer dado acima.
- **Inativar** ou **reativar** o grupo (só o organizador). O grupo inativo:
  - sai da lista principal (fica em "Grupos inativos");
  - deixa de aceitar confirmações e votos nos links públicos;
  - deixa de criar a rodada fixa;
  - mantém todo o histórico.
- Ajustar **Partidas e caixa** (minutos, mensalidade, diária, Pix) e os **Administradores**. Mensalidade, diária e chave Pix só aparecem para administradores.
- Escolher a **Aparência** (tema Automático, Claro ou Escuro) deste aparelho.

4. Para ter outros administradores, use **Grupo > Administradores > Convidar**. Isso gera um link de convite para mandar à pessoa. Ela abre o link, cria a conta (ou entra, inclusive com **Continuar com Google**) e toca em **Aceitar convite**.
   - **Remover administrador:** só o organizador remove. Ao remover, o link de convite atual deixa de funcionar automaticamente, para a pessoa não voltar sozinha com o link antigo. Para convidar alguém depois, toque em **Convidar** e mande o link novo.

**Vários grupos:** crie um grupo para cada jogo que você organiza (o futebol de segunda, o vôlei de quinta). Use o botão **⇄ Grupos** no topo para trocar entre eles.

**Como cada esporte funciona:**

| Esporte | Posições | Placar |
|---|---|---|
| Futebol, Society, Futsal | Goleiro, Defesa, Meio, Ataque | Gol (com gol contra) |
| Basquete | Armador, Ala, Pivô | +1, +2, +3 |
| Vôlei | Levantador, Ponteiro, Central, Oposto, Líbero | Ponto |
| Vôlei de praia, Futevôlei, Beach tennis | Sem posição, sorteio em duplas | Ponto / Game |
| Handebol | Goleiro, Armador, Ponta, Pivô | Gol |
| Futebol americano | Quarterback, Ataque, Linha, Defesa | TD 6, Extra 1, 2 pts, FG 3, Safety 2 |
| Flag football | Quarterback, Ataque, Defesa | TD 6, Extra 1 ou 2 |
| Rugby | Forward, Back | Try 5, Conversão 2, Penal 3, Drop 3 |
| Hóquei | Goleiro, Defesa, Ataque | Gol |
| Outro esporte | Sem posição (você escreve o nome do esporte) | Ponto |

**Reforço opcional da senha:** a regra de senha já é verificada no site. Se no seu Firebase existir a opção **Authentication > Configurações > Política de senha**, ative-a com os mesmos requisitos para que o próprio Firebase também recuse senhas fracas.

**Textos da página de apresentação:** a pergunta "Quanto custa?" diz que criar conta e grupos é gratuito. Se no futuro você cobrar, me peça para ajustar esse texto. O nome do produto fica na constante `APP` no `index.html`.

## Tema claro ou escuro

O botão redondo no topo de todas as telas (🌓, ☀️ ou 🌙) escolhe o tema:

- **🌓 Automático** (padrão): segue o tema do celular e muda sozinho junto com ele.
- **☀️ Claro**: sempre claro. Bom para usar na quadra, no sol.
- **🌙 Escuro**: sempre escuro. Bom à noite.

A escolha vale na hora e fica salva **naquele aparelho**. Funciona também para os jogadores no link da rodada, que não têm conta. O organizador encontra a mesma opção em **Grupo > Aparência**.

## Instalar como app no celular (PWA)

O site funciona como app. Ao abrir o endereço no celular aparece o botão **📲 Instalar app** no topo.

- **Android (Chrome):** toque em "Instalar app" e confirme. O ícone vai para a tela inicial.
- **iPhone (Safari):** toque em "Instalar app" para ver o passo a passo: Compartilhar → Adicionar à Tela de Início. No iPhone isso só funciona pelo Safari.

Como o app se comporta:

- Ele abre em tela cheia, com ícone próprio, como um aplicativo comum.
- O jogador (quem nunca entrou com conta naquele celular) abre direto na rodada do último link que abriu. No celular em que alguém já entrou com conta, o app abre **Meus grupos** ou, depois de **Sair**, a tela de login; nunca o link do jogador (pelada-v51).
- Funciona com sinal fraco ou sem internet na quadra. O cronômetro e o placar rodam normalmente, e o que for salvo sem conexão é enviado quando a internet voltar. Uma faixa avisa quando você está offline.
- Com sinal fraco, o app espera no máximo 3 segundos pela internet. Se ela não responder, abre a cópia guardada no celular e se atualiza sozinho depois.
- Se o jogador tocar em **Vou** sem sinal, ele vê o aviso de que a resposta ficou salva no celular e será enviada quando a conexão voltar. O ideal é ele abrir o link de novo antes do jogo para conferir. Para o administrador vale o mesmo: o que não chegou ao servidor fica salvo no aparelho e é enviado depois.
- Quando você publicar uma versão nova, o app mostra "Nova versão disponível · Atualizar".

O app só funciona com o site publicado (https). Abrindo o arquivo direto do computador, ele roda apenas como página comum.

## Uso no dia a dia

**Se o grupo joga sempre no mesmo dia e horário**, cadastre o jogo fixo na aba Rodada, por exemplo toda segunda, das 20:00 às 22:30, no mesmo local. A partir daí:

- A próxima rodada aparece sozinha. Não precisa criar nada toda semana.
- Existe um **link permanente** do grupo (`…/#/p/código-do-grupo`) que sempre abre a próxima rodada. Mande uma vez no grupo e fixe a mensagem.
- Quando o jogo termina (no horário de término), o link já passa a mostrar a semana seguinte.
- Feriado ou quadra fechada? Use **Cancelar esta data**. O link pula automaticamente para a semana seguinte.
- Dá para cadastrar mais de um jogo fixo, por exemplo segunda e quinta.

**Para jogos fora da rotina:**

1. **Criar a rodada:** informe só a data, o horário e o local.
2. **Mandar o link:** no jogo fixo, use o link permanente; numa rodada avulsa, clique em "Mandar link no WhatsApp". Cada jogador abre o link, acha o nome e toca em **Vou** ou **Não vou**. Quem não está na lista toca em **Adicionar meu nome** e entra como avulso.
3. **Fechar a lista:** quando quiser travar as confirmações, clique em "Fechar lista".
4. **Sortear:** escolha quantos times, quanto variar os parceiros e, se precisar, desmarque quem não vai entrar. Os times aparecem também no link da rodada.
5. **Partida:** use o placar e o cronômetro, registre os gols e salve o resultado. Isso alimenta o ranking. Quando o tempo acaba, além do som e da vibração, aparece o aviso **Tempo esgotado** no placar.
   - **Fim por placar:** escolha, por exemplo, 2 gols; quando um time chegar lá, o app avisa e pausa o tempo. No vôlei, use **Minutos: Sem tempo** e o limite de pontos.
   - **Corrigir uma partida:** na lista de partidas da rodada, toque em **Editar** para trocar o autor de um gol, tirar ou incluir gols. O ranking se ajusta sozinho.
   - **Próximo jogo:** depois de salvar, o app já sugere quem joga (quem ganha fica e entra quem espera há mais tempo) e mostra **Na espera**. Se o grupo combinar diferente, é só trocar o Time A ou o Time B.
6. **Votação:** crie a votação e mande o link. Os jogadores votam pelo celular, sem login, e o resultado aparece quando você encerrar.
7. **Caixa:** mensalistas e diaristas (incluindo os avulsos que jogaram) aparecem como pendentes até você marcar "Recebi".
   - Quem não paga (por exemplo, um goleiro fixo) fica como **Isento de pagamento** na ficha e nunca aparece como pendente.
   - Quem recebe um valor por jogo tem **Recebe por jogo** marcado na ficha, com o valor. Cada jogo em que a pessoa jogar entra no Caixa, em **A pagar**. Quando você pagar, toque em **Pagar**, deixe marcados os jogos que está pagando e toque em **Paguei**: a despesa é lançada sozinha.

Para promover um avulso que virou frequente, clique em **Pôr no elenco** na lista de confirmados. O histórico dele é mantido.

## Bom saber

O link da rodada funciona como a lista do WhatsApp: qualquer pessoa que o tenha pode marcar presença em qualquer nome. A diferença é que fica registrado:
- Se um aparelho mudar a resposta que outro aparelho deu (por exemplo, alguém marcando "Não vou" no nome de um colega), a aba Rodada mostra um aviso com o nome.
- Confira com o jogador e, se estiver errado, corrija em **Marcar presença**: o aviso some.
- Se precisar, feche a lista.

Atenção: se o mesmo jogador abrir o link pelo navegador do WhatsApp e depois pelo Chrome, o app trata como dois aparelhos, e o aviso também aparece. Nesse caso, basta confirmar com ele.

**Entrar com Google:** é só para administradores; jogadores continuam sem conta.
- Quem já tem conta com e-mail e senha e entra pelo Google com o mesmo e-mail continua na mesma conta, com os mesmos grupos. Se depois disso a senha antiga não funcionar, use **Esqueci a senha** para criar uma nova.
- O Google não deixa entrar por dentro de alguns aplicativos (Instagram, Facebook e navegadores embutidos de outros apps). Nesses casos, o site avisa e orienta abrir o link no Chrome ou no Safari, ou entrar com e-mail e senha.

**Votação:**
- Vale um voto por aparelho, e é possível mudar o voto até a votação ser encerrada.
- Cada aparelho vê só o próprio voto; ninguém consegue ver em quem os outros votaram.
- Limite conhecido: quem abrir a votação em outro navegador consegue votar de novo, porque os jogadores não têm conta.

**Portal do Nosso Jogo** (desde a pelada-v26): site separado em **https://nosso-jogo-portal.web.app**, só para a administração. Não tem criação de conta: clique em **Entrar com o Google** com a conta do portal (`portalnossojogo@gmail.com`), de preferência no computador pessoal. Ele mostra a lista de clientes com plano, grupos, último acesso e última rodada.
- **Liberar uma conta no portal:** entre com ela; se não estiver liberada, a tela mostra o **identificador** da conta. Peça na conversa do projeto para incluí-lo nas regras (proposta de mudança + Merge). Não há outro jeito de liberar.

Para ajustar os planos sem versão nova: no console do Firebase, **Firestore Database** > **Dados** > coleção `sistema` > documento `planos`, campo `planos` (tipo **map**), com um mapa por plano (`gratis`, `A`, `B`...), cada um com `nome` (texto), `grupos` e `admins` (número, ou **null** para ilimitado) e `recursos` (**array** de textos). Sem esse documento, valem Grátis, A e B padrão. Os limites dos planos ainda não valem no app (KAN-119).

**Limites contra abuso** (desde a pelada-v23):
- Pelo link, entram no máximo **30 nomes novos (avulsos) por rodada**. Jogadores cadastrados e quem só muda a própria resposta não contam. No limite, o link pede para a pessoa falar com o organizador, e a aba Rodada mostra um aviso. O organizador continua adicionando avulsos em **Adicionar avulso**, sem limite.
- Cada conta cria no máximo **20 grupos** (criar e duplicar contam; inativar não devolve a vaga).
- Para mudar esses números, sem publicar versão nova:
  1. Abra o [console do Firebase](https://console.firebase.google.com), escolha o projeto e vá em **Firestore Database** > **Dados**.
  2. Se ainda não existir a coleção `sistema`, clique em **+ Iniciar coleção**, digite `sistema` e clique em **Próximo**. Em **ID do documento**, digite `limites`.
  3. Adicione os campos `avulsosPorRodada` e `gruposPorConta`, com o tipo **number** e o valor desejado (por exemplo, 30 e 20), e clique em **Salvar**.
  4. Para mudar depois, clique no documento `sistema/limites`, passe o mouse sobre o campo, clique no lápis, troque o número e clique em **Atualizar**. Vale na hora.
  Sem esse documento, valem 30 e 20.

Notas, contatos, caixa, mensalidade, diária, chave Pix e o tipo do jogador (mensalista ou diarista) só aparecem para administradores. Os jogadores veem apenas nomes, posições, presença, times e resultados.

Quanto ao custo, o plano gratuito do Firebase (Spark) permite dezenas de milhares de leituras e gravações por dia, muito acima do que uma pelada usa. O Firebase Hosting também é gratuito nesse volume.

## Como as versões novas vão para o ar

Desde outubro de 2026 o código fica no GitHub (`kleberkoch-coder/nosso-jogo`, privado), e a publicação é automática:

1. **Proposta:** cada versão nova chega como uma proposta de mudança (*pull request*) no GitHub, com o resumo do que mudou.
2. **Testes:** o GitHub roda sozinho o roteiro de testes (`testes/testes_app.py`) em modo demonstração. O resultado aparece na proposta: ✓ verde (passou) ou ✕ vermelho (falhou).
3. **Prévia:** o GitHub publica uma prévia da versão nova no Firebase Hosting e comenta o link na proposta ("Prévia da proposta"), em modo demonstração. O site oficial não muda nessa etapa.
4. **Sua aprovação:** abra a prévia no celular e, se estiver tudo certo, clique em **Merge pull request** e depois em **Confirm merge**.
5. **No ar:**
   - o GitHub publica o site oficial (`https://nosso-jogo-f4762.web.app`) no Firebase Hosting em 2 a 3 minutos e confere que a versão no ar é a nova (automação "Publicar o site"; se não for, fica vermelha);
   - se o `firestore.rules` mudou, o GitHub publica as regras no Firebase sozinho (automação "Publicar regras do Firebase").

Desde a pelada-v24 o site fica no Firebase Hosting. O Netlify foi desligado em 14/10/2026 e o endereço antigo `nossosjogos.netlify.app` não existe mais.

**Onde fica cada coisa no repositório:**
- `src/`: o código do app, dividido em módulos (telas, regras de negócio, textos por idioma);
- `site/`: o modelo da página e os arquivos fixos (`sw.js`, `manifest.webmanifest` e `icons/`);
- `build.mjs` e `package.json`: a montagem (`npm run build` junta tudo em `dist/`, que é o que vai para o ar);
- `firestore.rules`: as regras do Firebase;
- `testes/`: o roteiro e o script de testes;
- `docs/`: a visão do produto, a arquitetura e o Design System;
- `.github/workflows/`: as automações (testes, prévia, publicar o site e publicar as regras).

**Se algo der errado:**
- **Testes em vermelho:** não clique em Merge. Peça na conversa do projeto para corrigir.
- **Regras não publicadas:** veja a aba **Actions** do repositório. A causa mais comum é o segredo `FIREBASE_SERVICE_ACCOUNT` ausente ou vencido.
- **Site não publicado:** veja a automação **Publicar o site** na aba **Actions**. A causa mais comum é a conta do GitHub sem o papel **Administrador do Firebase Hosting** (Google Cloud > **IAM e administrador** > **IAM** > conta `publicar-regras-github` > lápis > **Adicionar outro papel**).
- **Voltar uma versão:** no [console do Firebase](https://console.firebase.google.com), abra **Hosting**, role até **Histórico de versões**, clique nos três pontinhos de uma versão anterior e em **Reverter**.

A cada mudança no app, o número em `VERSION` no começo do `site/sw.js` sobe (agora está em `pelada-v14`), para os celulares receberem a atualização.

**Versão `pelada-v14`: mais rápida e com a aba Histórico.**
- **O que mudou:**
  - o link do jogador carrega só a próxima rodada, e não mais a história inteira do grupo: abre mais rápido, principalmente com sinal fraco;
  - a aba Rodada mostra as próximas rodadas e as últimas 4. Os jogos mais antigos ficam na nova aba **Histórico**, com busca por mês ou por período; cada rodada mostra lista, times, partidas e votação;
  - dois administradores mexendo na mesma rodada ao mesmo tempo (um salva a partida, outro fecha a lista) não apagam mais o que o outro fez;
  - por dentro: o link do jogador é o primeiro componente em TypeScript e Preact.
- **O que fazer:** só aprovar a proposta de mudança. As regras do Firebase **não mudaram**.

**Versão `pelada-v13`: código reorganizado.**
- **O que mudou:** por dentro, o app foi dividido em módulos e ganhou a base para vários idiomas. Por fora, nada muda para organizadores e jogadores.
- **O que fazer:** só aprovar a proposta de mudança no GitHub. As regras do Firebase **não mudaram**.

**Versão `pelada-v12`: visual novo e tema claro ou escuro.**
- **O que mudou:**
  - paleta mais leve, em tons pastel; o verde-gramado ficou no cabeçalho e no placar;
  - botão de tema em todas as telas;
  - botões Vou e Não vou maiores no link da rodada;
  - aviso visual quando o tempo da partida acaba;
  - ícones do app com as cores novas.
- **O que fazer:** as regras do Firestore **não mudaram** (na época, a publicação era manual).
- **No celular de quem já usa:** aparece "Nova versão disponível · Atualizar". Quem instalou o app pode precisar remover e instalar de novo para ver o ícone novo na tela inicial.

**Versão `pelada-v11`: botão Continuar com Google.**
- As regras do Firestore não mudaram.
- É preciso ativar o provedor Google no Firebase (passo 2).
- Confira se o endereço do site está em **Authentication > Configurações > Domínios autorizados** (passo 5).
- Sem isso, o botão mostra um aviso, e o login por e-mail e senha continua funcionando normalmente.

**Versão `pelada-v10`: dados do caixa só para administradores.** A mensalidade, a diária, a chave Pix e o tipo dos jogadores saíram da parte pública do grupo e foram para a área de administradores. Grupos antigos são migrados sozinhos na primeira vez que um administrador abre o grupo com a versão nova; não é preciso fazer nada.

Dados criados na versão de grupo único (antes dos "vários grupos") não aparecem mais. Se quiser limpar, apague no Firestore as coleções antigas `config`, `admins`, `convites`, `privado`, `jogadores`, `rodadas`, `caixa` e `votacoes`, mantendo só `grupos` e `usuarios`.
