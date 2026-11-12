import { ppos } from './grupo.js';
import { S } from '../nucleo/estado.js';
import { tc, tx } from '../i18n/index.js';
import { clara, ehCorLivre, lerCorLivre } from './cores';

const POS = { GOL: 'Goleiro', DEF: 'Defesa', MEI: 'Meio', ATA: 'Ataque' };
const APP = 'Nosso Jogo';
const FUT = {
  pos: [
    ['GOL', 'Goleiro'],
    ['DEF', 'Defesa'],
    ['MEI', 'Meio'],
    ['ATA', 'Ataque'],
  ],
  key: 'GOL',
  score: [['Gol', 1]],
  og: true,
  word: 'Gols',
  unit: 'gol',
  art: 'Artilharia',
  /* KAN-190: sugestões de material do grupo (o organizador escreve o que quiser); viram atalhos abaixo do campo (KAN-267). */
  mat: ['Bola', 'Coletes', 'Luvas', 'Cronômetro', 'Kit de primeiros socorros'],
  /* KAN-66: o esporte tem assistência (o passe do ponto); ast = nome da coluna no ranking, astN = nome inteiro. */
  ast: 'Assist.',
  astN: 'Assistências',
  min: 10,
};
const SPORTS = {
  futebol: Object.assign({ n: 'Futebol', e: '⚽', time: 11 }, FUT),
  society: Object.assign({ n: 'Society', e: '⚽', time: 6 }, FUT),
  futsal: Object.assign({ n: 'Futsal', e: '🥅', time: 5 }, FUT, { min: 8 }),
  basquete: {
    n: 'Basquete',
    e: '🏀',
    time: 5,
    pos: [
      ['ARM', 'Armador'],
      ['ALA', 'Ala'],
      ['PIV', 'Pivô'],
    ],
    key: null,
    score: [
      ['+1', 1],
      ['+2', 2],
      ['+3', 3],
    ],
    word: 'Pontos',
    unit: 'ponto',
    art: 'Cestinhas',
    mat: ['Bola', 'Coletes', 'Cronômetro', 'Kit de primeiros socorros'],
    ast: 'Assist.',
    astN: 'Assistências',
    min: 10,
  },
  volei: {
    n: 'Vôlei',
    e: '🏐',
    time: 6,
    pos: [
      ['LEV', 'Levantador'],
      ['PON', 'Ponteiro'],
      ['CEN', 'Central'],
      ['OPO', 'Oposto'],
      ['LIB', 'Líbero'],
    ],
    key: 'LEV',
    mat: ['Bola', 'Rede', 'Cronômetro', 'Kit de primeiros socorros'],
    score: [['Ponto', 1]],
    word: 'Pontos',
    unit: 'ponto',
    min: 20,
  },
  volei_praia: {
    n: 'Vôlei de praia',
    e: '🏖️',
    time: 2,
    pos: [],
    mat: ['Bola', 'Rede', 'Cronômetro', 'Kit de primeiros socorros'],
    score: [['Ponto', 1]],
    word: 'Pontos',
    unit: 'ponto',
    min: 20,
  },
  futevolei: {
    n: 'Futevôlei',
    e: '🦶',
    time: 2,
    pos: [],
    mat: ['Bola', 'Rede', 'Cronômetro', 'Kit de primeiros socorros'],
    score: [['Ponto', 1]],
    word: 'Pontos',
    unit: 'ponto',
    min: 20,
  },
  beach_tennis: {
    n: 'Beach tennis',
    e: '🎾',
    time: 2,
    pos: [],
    mat: ['Bolinhas', 'Rede', 'Cronômetro', 'Kit de primeiros socorros'],
    score: [['Game', 1]],
    word: 'Games',
    unit: 'game',
    min: 20,
  },
  handebol: {
    n: 'Handebol',
    e: '🤾',
    time: 7,
    pos: [
      ['GOL', 'Goleiro'],
      ['ARM', 'Armador'],
      ['PON', 'Ponta'],
      ['PIV', 'Pivô'],
    ],
    key: 'GOL',
    mat: ['Bola', 'Coletes', 'Cronômetro', 'Kit de primeiros socorros'],
    score: [['Gol', 1]],
    og: true,
    word: 'Gols',
    unit: 'gol',
    art: 'Artilharia',
    ast: 'Assist.',
    astN: 'Assistências',
    min: 15,
  },
  fut_americano: {
    n: 'Futebol americano',
    e: '🏈',
    time: 11,
    pos: [
      ['QB', 'Quarterback'],
      ['ATQ', 'Ataque'],
      ['LIN', 'Linha'],
      ['DEF', 'Defesa'],
    ],
    key: 'QB',
    score: [
      ['TD', 6],
      ['Extra', 1],
      ['2 pts', 2],
      ['FG', 3],
      ['Safety', 2],
    ],
    word: 'Pontos',
    unit: 'ponto',
    min: 20,
  },
  flag: {
    n: 'Flag football',
    e: '🚩',
    time: 5,
    pos: [
      ['QB', 'Quarterback'],
      ['ATQ', 'Ataque'],
      ['DEF', 'Defesa'],
    ],
    key: 'QB',
    score: [
      ['TD', 6],
      ['Extra 1', 1],
      ['Extra 2', 2],
    ],
    word: 'Pontos',
    unit: 'ponto',
    min: 20,
  },
  rugby: {
    n: 'Rugby',
    e: '🏉',
    time: 15,
    pos: [
      ['FOR', 'Forward'],
      ['BAC', 'Back'],
    ],
    key: null,
    score: [
      ['Try', 5],
      ['Conversão', 2],
      ['Penal', 3],
      ['Drop', 3],
    ],
    word: 'Pontos',
    unit: 'ponto',
    min: 20,
  },
  hoquei: {
    n: 'Hóquei',
    e: '🏒',
    time: 6,
    pos: [
      ['GOL', 'Goleiro'],
      ['DEF', 'Defesa'],
      ['ATA', 'Ataque'],
    ],
    key: 'GOL',
    score: [['Gol', 1]],
    og: true,
    word: 'Gols',
    unit: 'gol',
    ast: 'Assist.',
    astN: 'Assistências',
    min: 15,
  },
  outro: {
    n: 'Outro esporte',
    e: '🏅',
    time: 5,
    pos: [],
    key: null,
    score: [['Ponto', 1]],
    word: 'Pontos',
    unit: 'ponto',
    min: 15,
  },
};
/* Esporte do grupo. time = jogadores por time (definido no grupo; padrão do esporte). pairs = jogam em duplas (time de 2). */
function sport() {
  const b = SPORTS[(S.app && S.app.sport) || 'futebol'] || SPORTS.futebol,
    x = (S.app && S.app.posx) || [],
    t = porTime();
  return Object.assign({}, b, { pos: x.length ? b.pos.concat(x) : b.pos, time: t, pairs: t === 2 });
}
/* Nome do painel de quem marcou na rodada (KAN-192): vem do catálogo (futebol e handebol: "Artilharia";
   basquete: "Cestinhas"); sem nome no catálogo, inclusive nas duplas, "Pontos". */
function artNome() {
  return sport().art || tc('Pontos');
}
function porTimePadrao(k) {
  return (SPORTS[k || 'futebol'] || SPORTS.futebol).time || 5;
}
function porTime() {
  const v = +((S.app || {}).cfg || {}).porTime;
  return v >= 1 ? v : porTimePadrao(S.app && S.app.sport);
}
function basePos() {
  return (SPORTS[(S.app && S.app.sport) || 'futebol'] || SPORTS.futebol).pos;
}
function sportName(a) {
  a = a || S.app || {};
  return a.sport === 'outro' && a.sportName ? a.sportName : (SPORTS[a.sport || 'futebol'] || SPORTS.futebol).n;
}
function posKeys() {
  return sport().pos.map(x => x[0]);
}
function posLabel(k) {
  const f = sport().pos.find(x => x[0] === k);
  return f ? f[1] : '';
}
/* Sigla da posição na tela (KAN-226): no idioma da pessoa (GOL → GK em inglês, ARQ em espanhol), pela chave do catálogo
   do esporte ou geral. O código gravado no banco não muda; posições criadas pelo grupo ficam como foram escritas. */
function siglaTela(k, esporte) {
  if (!k) return '';
  const e = esporte || (S.app && S.app.sport) || 'futebol',
    a = tc('#' + e + '.' + k);
  if (a[0] !== '#') return a;
  const b = tc('#' + k);
  return b[0] !== '#' ? b : k;
}
function hasPos() {
  return sport().pos.length > 0;
}
const posIdx = k => {
  const i = posKeys().indexOf(k);
  return i < 0 ? 99 : i;
};
/* Nome do time pela posição na rodada (v60, pedido do Kleber): "Time 1", "Time 2"… ou "Dupla 1".
   A cor ficou só para o colete, que muda à vontade sem mudar o nome. */
function tn(i) {
  return tx(sport().pairs ? 'time.dupla' : 'time.nome', { n: (i || 0) + 1 });
}
/* Time de uma partida salva: pela posição gravada (ta/tb, desde a v60) ou, nas antigas, pela cor na rodada. */
function timeDoJogo(m, lado, times) {
  const i = m['t' + lado];
  return i != null ? i : (times || []).findIndex(t => t.c === m['c' + lado]);
}
function tnJogo(m, lado, times) {
  const i = timeDoJogo(m, lado, times);
  return i >= 0 ? tn(i) : col(m['c' + lado]).n;
}
/* "colete laranja" (sem colete nas duplas). */
const colete = c => tx('time.colete', { cor: col(c).n.toLowerCase() });
const COL = [
  { n: 'Laranja', c: '#F4B183', e: '🟧' },
  { n: 'Azul', c: '#9DBBF0', e: '🟦' },
  { n: 'Amarelo', c: '#F5DC7E', e: '🟨' },
  { n: 'Vermelho', c: '#EFA3A3', e: '🟥' },
  { n: 'Roxo', c: '#C3A8EE', e: '🟪' },
  { n: 'Branco', c: '#E3E6E1', e: '⬜' },
  { n: 'Verde', c: '#9ED3B1', e: '🟩' },
  { n: 'Preto', c: '#4A4A4A', e: '⬛' },
];
/* KAN-235: além das 8 de sempre (número), a cor livre da paleta ("#rrggbb|Nome", dominio/cores.ts). */
const col = c => (ehCorLivre(c) ? lerCorLivre(c) : COL[(+c || 0) % COL.length]);
/* Cor clara (Branco ou uma livre clara): a bolinha e a faixa ganham borda. */
const corClara = x => clara(x.c);
/* KAN-164: os nomes do catálogo (esporte, posições, pontuação, palavra do placar, cores) ficam em português aqui e
   são trocados pelos do idioma da pessoa quando ele muda. Guarda os originais na primeira vez. */
let ORIG = null;
function aplicarCatalogo() {
  ORIG =
    ORIG ||
    JSON.parse(
      JSON.stringify({
        s: Object.fromEntries(Object.entries(SPORTS).map(([k, v]) => [k, v])),
        c: COL,
      })
    );
  for (const [k, o] of Object.entries(ORIG.s)) {
    const s = SPORTS[k];
    s.n = tc(o.n);
    s.pos = o.pos.map(([sig, nome]) => [sig, tc(nome)]);
    s.score = o.score.map(([r, p]) => [tc(r), p]);
    s.word = tc(o.word);
    s.unit = tc(o.unit);
    if (o.art) s.art = tc(o.art);
    if (o.mat) s.mat = o.mat.map(tc);
    if (o.ast) {
      s.ast = tc(o.ast);
      s.astN = tc(o.astN);
    }
  }
  ORIG.c.forEach((o, i) => (COL[i].n = tc(o.n)));
  /* O futebol, o society e o futsal dividiam as listas (FUT): depois da troca, cada um tem a sua. */
}
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

export {
  aplicarCatalogo,
  siglaTela,
  porTime,
  porTimePadrao,
  APP,
  artNome,
  COL,
  SPORTS,
  basePos,
  col,
  corClara,
  hasPos,
  posIdx,
  posKeys,
  posLabel,
  sport,
  sportName,
  tn,
  tnJogo,
  timeDoJogo,
  colete,
};
