import { ppos } from './grupo.js';
import { S } from '../nucleo/estado.js';
import { esc } from '../nucleo/util.js';
import { tx } from '../i18n/index.js';

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
    score: [['Gol', 1]],
    og: true,
    word: 'Gols',
    unit: 'gol',
    art: 'Artilharia',
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
  return sport().art || 'Pontos';
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
  return i >= 0 ? tn(i) : COL[(m['c' + lado] || 0) % COL.length].n;
}
/* "colete laranja" (sem colete nas duplas). */
const colete = c => tx('time.colete', { cor: COL[(c || 0) % COL.length].n.toLowerCase() });
function posTag(id) {
  const k = ppos(id);
  return hasPos() && k
    ? `<span class="pos ${k === sport().key ? 'GOL' : ''}" title="${esc(posLabel(k))}">${esc(k)}</span>`
    : '';
}
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
const col = c => COL[(c || 0) % COL.length];
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

export {
  porTime,
  porTimePadrao,
  APP,
  artNome,
  COL,
  SPORTS,
  basePos,
  col,
  hasPos,
  posIdx,
  posKeys,
  posLabel,
  posTag,
  sport,
  sportName,
  tn,
  tnJogo,
  timeDoJogo,
  colete,
};
