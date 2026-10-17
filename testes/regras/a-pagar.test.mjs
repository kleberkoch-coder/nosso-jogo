/* Regra "isento e a pagar por jogo" (KAN-172). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aPagar, pendenciasDoMes } from '../../src/dominio/caixa-regras.ts';

const RODS = [
  { id: 'r1', date: '2026-10-05', times: [{ players: ['ana', 'gol1'] }, { players: ['beto', 'gol2'] }] },
  { id: 'r2', date: '2026-10-12', times: null },
  { id: 'r3', date: '2026-10-19', times: [{ players: ['ana', 'gol1'] }, { players: ['beto', 'caio'] }] },
  { id: 'r0', date: '2026-09-28', times: [{ players: ['gol1'] }, { players: ['ana'] }] },
];
const TIPOS = { ana: 'mensalista', beto: 'diarista', gol1: 'isento', gol2: 'isento', caio: 'mensalista' };

test('isento que jogou não deve mensalidade nem diária', () => {
  const p = pendenciasDoMes({
    mes: '2026-10',
    lancamentos: [],
    elenco: Object.keys(TIPOS),
    tipo: id => TIPOS[id] || 'avulso',
    rodadas: RODS.filter(r => r.date.startsWith('2026-10')),
    valores: { mensal: 80, diaria: 20 },
  });
  assert.ok(!p.some(x => x.pid === 'gol1' || x.pid === 'gol2'));
  assert.ok(p.some(x => x.pid === 'ana' && x.k === 'mensal'));
  assert.ok(p.some(x => x.pid === 'beto' && x.k === 'diaria'));
});

test('a pagar: rodadas em que jogou desde que passou a receber, sem as que só confirmou', () => {
  const r = aPagar({ lancamentos: [], recebe: { gol1: { v: 50, desde: '2026-10-01' } }, rodadas: RODS });
  assert.equal(r.length, 1);
  assert.deepEqual(
    r[0].jogos.map(j => j.rid),
    ['r1', 'r3']
  );
  assert.equal(r[0].total, 100);
});

test('a pagar: sem data de início conta todas; valor zero ou vazio não entra', () => {
  const r = aPagar({ lancamentos: [], recebe: { gol1: { v: 50 }, gol2: { v: 0 }, caio: { v: '' } }, rodadas: RODS });
  assert.deepEqual(
    r.map(x => [x.pid, x.jogos.length]),
    [['gol1', 3]]
  );
});

test('pagamento de parte dos jogos tira só esses do a pagar', () => {
  const lan = [{ k: 'despesa', pid: 'gol1', v: 50, d: '2026-10-20', ref: 'jogos', refs: ['r1'] }];
  const r = aPagar({ lancamentos: lan, recebe: { gol1: { v: 50, desde: '2026-10-01' } }, rodadas: RODS });
  assert.deepEqual(
    r[0].jogos.map(j => j.rid),
    ['r3']
  );
  assert.equal(r[0].total, 50);
});

test('tudo pago: a pessoa some do a pagar; despesa de outro jogador não conta', () => {
  const lan = [
    { k: 'despesa', pid: 'gol1', v: 100, d: '2026-10-20', ref: 'jogos', refs: ['r1', 'r3'] },
    { k: 'despesa', pid: 'gol2', v: 50, d: '2026-10-20', ref: 'jogos', refs: ['r1'] },
    { k: 'entrada', pid: 'gol1', v: 1, d: '2026-10-20', ref: 'x', refs: ['r1'] },
  ];
  const r = aPagar({ lancamentos: lan, recebe: { gol1: { v: 50, desde: '2026-10-01' } }, rodadas: RODS });
  assert.equal(r.length, 0);
});
