import { tx } from '../i18n/index.js';
import { numeroVersao } from '../nucleo/versao.js';
import { APP, SPORTS } from '../dominio/esportes.js';
import { themeDef, themeLabel } from '../ui/tema.js';

/* ---------- Página de apresentação ---------- */
function vLanding() {
  const sp = Object.entries(SPORTS).filter(([k]) => !['society', 'outro'].includes(k));
  const feat = [
    [
      '🔗',
      'Confirmação por link',
      'Mande um link no grupo. Cada um toca em Vou ou Não vou, e quem não está na lista se adiciona como avulso. Sem app para baixar, sem cadastro.',
    ],
    [
      '⚖️',
      'Sorteio que pensa',
      'Equilibra a nota de cada jogador e as posições, separa quem não pode cair junto e varia os parceiros a cada rodada.',
    ],
    [
      '⏱️',
      'Placar e cronômetro',
      'Placar com a pontuação de cada esporte: gol, cesta de 3, try, touchdown. Quem ganha fica, e o próximo time entra sozinho.',
    ],
    ['🏆', 'Ranking e histórico', 'Vitórias, aproveitamento e artilharia de cada jogador, rodada após rodada.'],
    ['🗳️', 'Votação do craque', 'Melhor da rodada, melhor por posição e até o bagre. A turma vota pelo celular.'],
    [
      '💰',
      'Caixa da turma',
      'Mensalidade, diária e despesas em um lugar, com cobrança pronta para o WhatsApp e a sua chave Pix.',
    ],
    ['📅', 'Jogo fixo', 'Joga toda segunda às 20h? A rodada se cria sozinha e o link de confirmação é sempre o mesmo.'],
    [
      '📱',
      'App no celular',
      'Instale na tela inicial, como um app. Placar e cronômetro funcionam até sem sinal na quadra.',
    ],
  ];
  const faq = [
    [
      'Os jogadores precisam baixar algo ou criar conta?',
      'Não. Eles recebem um link pelo WhatsApp e confirmam a presença direto no navegador. Só quem organiza cria conta.',
    ],
    [
      'Posso organizar mais de um jogo ou esporte?',
      'Sim. Crie um grupo para cada jogo, como o futebol de segunda e o vôlei de quinta. Cada grupo tem as posições, a pontuação e o elenco do seu esporte.',
    ],
    [
      'Posso dividir a organização com outras pessoas?',
      'Sim. Convide outros administradores por um link. Cada grupo pode ter quantos quiser.',
    ],
    [
      'Como o sorteio deixa os times equilibrados?',
      'Você dá uma nota de 1 a 10 para cada jogador (vale meio ponto) e informa a posição. O sorteio testa centenas de combinações e escolhe a mais equilibrada, respeitando quem não pode jogar junto e evitando repetir os mesmos parceiros.',
    ],
    [
      'Os jogadores veem a nota que eu dei para eles?',
      'Não. Notas e caixa só aparecem para administradores. Os jogadores veem a lista, os times e o placar.',
    ],
    [
      'Funciona no iPhone e no Android?',
      'Sim. Funciona em qualquer navegador e pode ser instalado na tela inicial como um app.',
    ],
    ['Quanto custa?', 'Você pode criar sua conta e seus grupos gratuitamente.'],
  ];
  return `<div class="ld">
  <nav class="ld-nav"><div class="ld-wrap"><a class="ld-logo" href="#/" aria-label="${APP}"><span class="ld-mark" aria-hidden="true"></span><span class="ld-txt">${APP}</span></a>
    <div class="row" style="gap:8px"><button class="btn ld-ghost ld-ic" data-a="themeMenu" aria-haspopup="menu" aria-expanded="false" aria-label="${themeLabel()}" title="${themeLabel()}">${themeDef()[1]}</button><a class="btn ld-ghost ld-enter" href="#/entrar">Entrar</a><a class="btn bib" href="#/criar">Criar conta<span class="ld-gr" style="margin-left:-2px">grátis</span></a></div></div></nav>
  <header class="ld-hero"><div class="ld-wrap ld-hero-in">
    <div class="ld-copy"><p class="ld-eyebrow">Para quem organiza o jogo da semana</p>
      <h1>Times justos.<br>Lista fechada.<br><span>Todo mundo em campo.</span></h1>
      <p class="ld-lead">Do futebol de segunda ao vôlei de sábado: o ${APP} cuida da confirmação de presença, sorteia times equilibrados e guarda placar, ranking e o caixa da turma. Os jogadores confirmam por um link, sem baixar nada.</p>
      <div class="row ld-ctas"><a class="btn bib ld-big" href="#/criar">Criar meu grupo grátis</a><a class="btn ld-ghost ld-big" href="#/entrar">Já tenho conta</a></div>
      <p class="ld-note">Vários grupos e esportes na mesma conta · Funciona como app no celular</p></div>
    <div class="ld-phone" aria-hidden="true"><div class="ld-screen">
      <div class="ld-sh"><b>Futebol de Segunda</b><span>seg, 20:00–22:30 · Arena Central</span></div>
      <div class="ld-big-n">14<small>confirmados</small></div>
      ${[
        ['Rafa', 'in'],
        ['Gui', 'in'],
        ['Japa', 'out'],
        ['Bruno', 'in'],
      ]
        .map(
          ([n, s]) =>
            `<div class="ld-row"><span>${n}</span><span class="ld-b ${s === 'in' ? 'on' : ''}">Vou</span><span class="ld-b ${s === 'out' ? 'off' : ''}">Não vou</span></div>`
        )
        .join('')}
      <div class="ld-teams"><div style="--c:#F4B183"><b>Laranja</b><i>nota 7,2</i></div><div style="--c:#9DBBF0"><b>Azul</b><i>nota 7,2</i></div></div>
    </div></div>
  </div></header>
  <section class="ld-sports"><div class="ld-wrap"><p>Um app para todos os seus esportes</p><div class="ld-chips">${sp.map(([, v]) => `<span>${v.e} ${v.n}</span>`).join('')}<span>🏅 e outros</span></div></div></section>
  <section class="ld-sec"><div class="ld-wrap"><h2 class="ld-h2">A lista no WhatsApp não dá mais conta</h2>
    <div class="ld-pains">${[
      ['“Quem vai mesmo?”', 'Cada um confirma no link e a lista se monta sozinha, com avulsos e quem desistiu.'],
      [
        '“Time desequilibrado de novo.”',
        'O sorteio considera nota, posição e quem não pode jogar junto, e explica o resultado.',
      ],
      ['“Quem ainda não pagou?”', 'O caixa mostra quem está devendo no mês e monta a cobrança com o seu Pix.'],
    ]
      .map(([a, b]) => `<div><p class="ld-q">${a}</p><p>${b}</p></div>`)
      .join('')}</div></div></section>
  <section class="ld-sec alt"><div class="ld-wrap"><h2 class="ld-h2">Tudo o que o organizador precisa</h2>
    <div class="ld-feat">${feat.map(([i, t, d]) => `<div class="ld-card"><span class="ld-ic">${i}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}</div></div></section>
  <section class="ld-sec"><div class="ld-wrap ld-split"><div><h2 class="ld-h2">Um sorteio que não deixa ninguém reclamar</h2>
    <p class="ld-p">Dê uma nota de 1 a 10 para cada jogador (vale meio ponto), marque a posição e diga quem não pode cair junto. O sorteio testa centenas de combinações e mostra por que os times ficaram assim. As notas ficam escondidas dos jogadores.</p>
    <ul class="ld-list"><li>Nota média parecida entre os times</li><li>Goleiros e posições bem distribuídos</li><li>Craques separados quando você quiser</li><li>Parceiros diferentes a cada rodada</li></ul></div>
    <div class="ld-demo"><div class="team"><div class="band" style="background:#F4B183"></div><div class="th"><b>Laranja</b></div><ul>${[
      ['GOL', 'Bruno'],
      ['DEF', 'Rafa'],
      ['MEI', 'Gui'],
      ['ATA', 'Neto'],
      ['ATA', 'Vini'],
    ]
      .map(([p, n]) => `<li><span class="pos ${p === 'GOL' ? 'GOL' : ''}">${p}</span><span class="pn">${n}</span></li>`)
      .join('')}</ul></div>
      <div class="team"><div class="band" style="background:#9DBBF0"></div><div class="th"><b>Azul</b></div><ul>${[
        ['GOL', 'Tiago'],
        ['DEF', 'Léo'],
        ['MEI', 'Caio'],
        ['MEI', 'Fernandinho'],
        ['ATA', 'Japa'],
      ]
        .map(
          ([p, n]) => `<li><span class="pos ${p === 'GOL' ? 'GOL' : ''}">${p}</span><span class="pn">${n}</span></li>`
        )
        .join('')}</ul></div>
      <div class="quality" style="grid-column:1/-1"><span>Diferença de nota média: <b>0,1</b></span><span>Goleiros: <b>1 × 1</b></span><span>Parcerias novas: <b>78%</b></span></div></div></div></section>
  <section class="ld-sec alt"><div class="ld-wrap"><h2 class="ld-h2">Futebol na segunda, vôlei na quinta, beach tennis no domingo</h2>
    <p class="ld-p" style="max-width:640px">Cada jogo vira um grupo, com as posições, a pontuação e o elenco do seu esporte. Troque de grupo com um toque.</p>
    <div class="ld-groups">${[
      ['⚽', 'Futebol de Segunda', 'seg · 20:00 · 16 confirmados'],
      ['🏐', 'Vôlei da Firma', 'qui · 19:00 · 11 confirmados'],
      ['🎾', 'Beach Tennis Domingo', 'dom · 08:00 · 6 duplas'],
    ]
      .map(
        ([e, n, d]) => `<div class="ld-g"><span class="gem">${e}</span><div><b>${n}</b><span>${d}</span></div></div>`
      )
      .join('')}</div></div></section>
  <section class="ld-sec"><div class="ld-wrap"><h2 class="ld-h2">Comece em 3 passos</h2>
    <ol class="ld-steps"><li><b>Crie o grupo</b><span>Escolha o esporte e cadastre os jogadores com nível e posição.</span></li><li><b>Mande o link</b><span>A turma confirma pelo WhatsApp. No jogo fixo, o link é sempre o mesmo.</span></li><li><b>Sorteie e jogue</b><span>Times equilibrados em segundos, placar na quadra e ranking atualizado.</span></li></ol>
    <div style="text-align:center;margin-top:26px"><a class="btn bib ld-big" href="#/criar">Criar meu grupo grátis</a></div></div></section>
  <section class="ld-sec alt"><div class="ld-wrap ld-faq"><h2 class="ld-h2">Perguntas frequentes</h2>${faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></section>
  <section class="ld-final"><div class="ld-wrap"><h2>Seu próximo jogo começa organizado.</h2><div class="row" style="justify-content:center"><a class="btn bib ld-big" href="#/criar">Criar conta grátis</a><a class="btn ld-ghost ld-big" href="#/entrar">Entrar</a></div></div></section>
  <footer class="ld-foot"><div class="ld-wrap">© ${new Date().getFullYear()} ${APP} · <span class="versao">${tx('comum.versaoCurta', { n: numeroVersao() })}</span></div></footer>
  </div>`;
}

export { vLanding };
