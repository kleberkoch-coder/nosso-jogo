/* Regra "ranking e totais por mês" (uma das 5 da D12; KAN-87). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicar, caixaDoMes, camposLancamento, camposPartida, camposVotacao, placares, ranking, resumirTudo, saldo, vazio } from '../../src/dominio/resumos.ts';

const P = (id, date, ga, gb, goals = [], extra = {}) => ({ id, rid: 'r-' + date, date, ca: 0, cb: 1, pa: ['a', 'b'], pb: ['c', 'd'], ga, gb, goals, at: 1, ...extra });

/* Jeito antigo (v17): soma tudo direto das partidas. Os resumos têm que dar o mesmo resultado. */
function antigo(ps) {
  const s = {}, g = id => s[id] || (s[id] = { id, j: 0, v: 0, e: 0, d: 0, gols: 0, mvp: 0, bagre: 0 });
  ps.forEach(m => { const res = m.ga > m.gb ? 'a' : m.ga < m.gb ? 'b' : 'e';
    m.pa.forEach(id => { const x = g(id); x.j++; res === 'a' ? x.v++ : res === 'e' ? x.e++ : x.d++; });
    m.pb.forEach(id => { const x = g(id); x.j++; res === 'b' ? x.v++ : res === 'e' ? x.e++ : x.d++; });
    m.goals.forEach(gl => { if (gl.pid && !gl.og) g(gl.pid).gols += (gl.pts || 1); }); });
  return Object.values(s).map(x => Object.assign(x, { pts: x.v * 3 + x.e, ap: x.j ? Math.round((x.v * 3 + x.e) / (x.j * 3) * 100) : 0 })).sort((x, y) => x.id.localeCompare(y.id));
}
const ord = l => l.slice().sort((x, y) => x.id.localeCompare(y.id));

const PARTIDAS = [
  P('m1', '2026-08-03', 2, 1, [{ t: 'a', pid: 'a' }, { t: 'a', pid: 'b' }, { t: 'b', pid: 'c' }]),
  P('m2', '2026-09-07', 0, 0),
  P('m3', '2026-10-05', 1, 3, [{ t: 'a', pid: 'c', og: true }, { t: 'b', pid: 'd', pts: 2 }, { t: 'b', pid: 'c' }]),
];

test('grupo com partidas em 3 meses: ranking do ano igual ao jeito antigo', () => {
  const res = resumirTudo(PARTIDAS, [], []);
  assert.deepEqual(Object.keys(res).sort(), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(ord(ranking(Object.values(res))), antigo(PARTIDAS));
});

test('ranking do mês lê só aquela ficha', () => {
  const res = resumirTudo(PARTIDAS, [], []);
  assert.deepEqual(ord(ranking([res['2026-10']])), antigo([PARTIDAS[2]]));
});

test('salvar e depois apagar uma partida volta ao que era', () => {
  const doc = resumirTudo(PARTIDAS, [], [])['2026-10'], antes = JSON.stringify(ranking([doc]));
  const nova = P('m4', '2026-10-12', 4, 0, [{ t: 'a', pid: 'a', pts: 3 }]);
  aplicar(doc, camposPartida(nova, nova.rid, nova.date, 1));
  assert.equal(ranking([doc]).find(l => l.id === 'a').gols, 3);
  aplicar(doc, camposPartida(nova, nova.rid, nova.date, -1));
  assert.equal(JSON.stringify(ranking([doc])), antes);
  assert.equal(doc.jogos.m4, undefined);
});

test('apagar partida de um mês antigo só muda aquele mês', () => {
  const res = resumirTudo(PARTIDAS, [], []), set = JSON.stringify(res['2026-09']), out = JSON.stringify(res['2026-10']);
  aplicar(res['2026-08'], camposPartida(PARTIDAS[0], PARTIDAS[0].rid, PARTIDAS[0].date, -1));
  assert.deepEqual(ranking([res['2026-08']]), []);
  assert.equal(JSON.stringify(res['2026-09']), set); assert.equal(JSON.stringify(res['2026-10']), out);
});

test('basquete: pontos somam o valor da cesta (+1, +2, +3)', () => {
  const m = P('b1', '2026-10-01', 6, 0, [{ t: 'a', pid: 'a', pts: 3 }, { t: 'a', pid: 'a', pts: 2 }, { t: 'a', pid: 'b', pts: 1 }]);
  const l = ranking(Object.values(resumirTudo([m], [], [])));
  assert.equal(l.find(x => x.id === 'a').gols, 5); assert.equal(l.find(x => x.id === 'b').gols, 1);
});

test('gol contra não conta para quem fez', () => {
  const l = ranking(Object.values(resumirTudo([PARTIDAS[2]], [], [])));
  assert.equal(l.find(x => x.id === 'c').gols, 1);
});

test('caixa: entradas, saídas e saldo batem com a soma dos lançamentos (em centavos)', () => {
  const lanc = [{ k: 'mensal', v: 80, d: '2026-10-02' }, { k: 'diaria', v: 20.1, d: '2026-10-05' }, { k: 'despesa', v: 0.2, d: '2026-10-06' }, { k: 'entrada', v: 50, d: '2026-09-10' }];
  const res = resumirTudo([], lanc, []);
  assert.deepEqual(caixaDoMes(res['2026-10']), { ent: 100.1, sai: 0.2 });
  assert.equal(saldo(Object.values(res)), 149.9);
  const doc = res['2026-10']; aplicar(doc, camposLancamento(lanc[1], -1));
  assert.deepEqual(caixaDoMes(doc), { ent: 80, sai: 0.2 });
});

test('destaques e bagres das votações encerradas, no mês da rodada', () => {
  const v = { open: false, rdate: '2026-10-05', cats: [{ id: 'mvp' }, { id: 'bagre', neg: true }], resultado: { mvp: { winners: ['a', 'c'] }, bagre: { winners: ['d'] } } };
  const res = resumirTudo([], [], [v, Object.assign({}, v, { open: true })]);
  const l = ranking([res['2026-10']]);
  assert.equal(l.find(x => x.id === 'a').mvp, 1); assert.equal(l.find(x => x.id === 'd').bagre, 1);
  const doc = res['2026-10']; aplicar(doc, camposVotacao(v, -1));
  assert.deepEqual(ranking([doc]), []);
});

test('histórico de placares: rodada mais recente primeiro, partidas na ordem', () => {
  const ps = [P('x2', '2026-10-05', 1, 0, [], { at: 2 }), P('x1', '2026-10-05', 0, 2, [], { at: 1 }), P('y', '2026-09-07', 3, 3)];
  const h = placares(Object.values(resumirTudo(ps, [], [])));
  assert.deepEqual(h.map(r => r.date), ['2026-10-05', '2026-09-07']);
  assert.deepEqual(h[0].jogos.map(j => j.id), ['x1', 'x2']);
});

test('Recalcular de um mês sem dados devolve ficha vazia', () => {
  assert.deepEqual(resumirTudo(PARTIDAS, [], [], '2026-11')['2026-11'], vazio('2026-11'));
});
