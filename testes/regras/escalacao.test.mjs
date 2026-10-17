/* KAN-177: escalação com empréstimo e troca. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desfazer, emQuadra, entrar, escVazia, podemEntrar } from '../../src/dominio/escalacao.ts';
import { camposPartida } from '../../src/dominio/resumos.ts';

const TIMES = [
  ['a1', 'a2'],
  ['b1', 'b2'],
  ['c1', 'c2'],
];

test('puxar de outro time completa o lado e ele joga (critério 1)', () => {
  const e = entrar(escVazia(), 'c1');
  assert.deepEqual(emQuadra(TIMES[0], e), { jogaram: ['a1', 'a2', 'c1'], atuais: ['a1', 'a2', 'c1'] });
});

test('troca: o lesionado sai, quem entra joga, e os dois contam o jogo (critério 2)', () => {
  const e = entrar(escVazia(), 'x9', 'a2');
  const q = emQuadra(TIMES[0], e);
  assert.deepEqual(q.jogaram, ['a1', 'a2', 'x9']);
  assert.deepEqual(q.atuais, ['a1', 'x9']);
  const c = camposPartida(
    { id: 'm', ca: 0, cb: 1, pa: q.jogaram, pb: TIMES[1], ga: 1, gb: 0, goals: [] },
    'r',
    '2026-10-17',
    1
  );
  for (const id of ['a2', 'x9']) {
    assert.equal(c.somar[`jog.${id}.j`], 1);
    assert.equal(c.somar[`jog.${id}.v`], 1);
  }
});

test('quem pode entrar: outros times e presentes sem time, sem quem já está na partida', () => {
  const p = podemEntrar(TIMES, ['a1', 'a2', 'b1', 'b2', 'c1'], ['a1', 'c2', 'x9', 'y8']);
  assert.deepEqual(p.deTimes, [[], [], ['c2']]);
  assert.deepEqual(p.semTime, ['x9', 'y8']);
});

test('desfazer tira quem entrou por engano e devolve quem saiu', () => {
  let e = entrar(escVazia(), 'x9', 'a2');
  e = desfazer(e, 'x9');
  e = desfazer(e, 'a2');
  assert.deepEqual(emQuadra(TIMES[0], e), { jogaram: ['a1', 'a2'], atuais: ['a1', 'a2'] });
});

test('quem saiu e volta a entrar fica em quadra de novo', () => {
  let e = entrar(escVazia(), 'x9', 'a2');
  e = entrar(e, 'a2', 'x9');
  assert.deepEqual(emQuadra(TIMES[0], e).atuais, ['a1', 'a2']);
  assert.deepEqual(emQuadra(TIMES[0], e).jogaram, ['a1', 'a2', 'x9']);
});
