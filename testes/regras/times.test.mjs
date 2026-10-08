/* Regra "jogadores por time e reservas" (pelada-v16). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reservas, resumo, sugerirTimes, tamanhos, titulares } from '../../src/dominio/times.ts';

test('divide por igual entre os times escolhidos', () => {
  assert.deepEqual(tamanhos(16, 4), [4, 4, 4, 4]);
  assert.deepEqual(tamanhos(16, 3), [6, 5, 5]);
});

test('16 confirmados, time de 5, 4 times: 4 times de 4, sem reserva', () => {
  const r = resumo(16, 4, 5);
  assert.equal(r.reservas, 0); assert.equal(r.completos, false);
});

test('16 confirmados, time de 5, 3 times: 6, 5 e 5, com 1 reserva', () => {
  const r = resumo(16, 3, 5);
  assert.deepEqual(r.porTimeReal, [6, 5, 5]); assert.equal(r.reservas, 1);
});

test('sugere quantos times completos cabem, entre 2 e 6', () => {
  assert.equal(sugerirTimes(16, 5), 3);
  assert.equal(sugerirTimes(10, 11), 2);
  assert.equal(sugerirTimes(40, 2), 6);
  assert.equal(sugerirTimes(4, 2), 2);
});

test('reserva é quem confirmou por último no time', () => {
  const t = { a: 1, b: 5, c: 3, d: 9, e: 2, f: 7 };
  assert.deepEqual(reservas(['a', 'b', 'c', 'd', 'e', 'f'], 5, id => t[id]), ['d']);
  assert.deepEqual(reservas(['a', 'b', 'c'], 5, id => t[id]), []);
});

test('duplas: com 3 numa dupla, o terceiro fica de reserva', () => {
  assert.deepEqual(reservas(['a', 'b', 'c'], 2, id => ({ a: 1, b: 2, c: 3 })[id]), ['c']);
});

test('titulares não incluem reservas', () => {
  assert.deepEqual(titulares({ c: 0, players: ['a', 'b', 'c'], res: ['b'] }), ['a', 'c']);
  assert.deepEqual(titulares({ c: 0, players: ['a'] }), ['a']);
});
