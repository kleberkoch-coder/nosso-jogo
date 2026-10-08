/* Regra "lista × times sorteados" (pelada-v15). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { divergencia, foraDosTimes, fotoDoSorteio } from '../../src/dominio/divergencia.ts';

const rod = (extra = {}) => ({ times: [{ c: 0, players: ['a', 'b'] }, { c: 1, players: ['c', 'd'] }], base: ['a', 'b', 'c', 'd', 'e'], ...extra });
const vao = (...ids) => Object.fromEntries(ids.map((id, i) => [id, { s: 'in', t: i }]));

test('sem sorteio não há divergência', () => {
  assert.deepEqual(divergencia({ times: null }, vao('a')), { saiu: [], entrou: [] });
  assert.deepEqual(divergencia(null, {}), { saiu: [], entrou: [] });
});

test('lista igual à foto do sorteio: sem aviso', () => {
  assert.deepEqual(divergencia(rod(), vao('a', 'b', 'c', 'd', 'e')), { saiu: [], entrou: [] });
});

test('quem foi desmarcado de propósito no sorteio não gera aviso', () => {
  // "e" estava confirmado, ficou fora dos times e continua confirmado
  assert.deepEqual(divergencia(rod(), vao('a', 'b', 'c', 'd', 'e')).entrou, []);
});

test('quem está num time e desmarcou aparece em "saiu"', () => {
  const p = vao('a', 'c', 'd'); p.b = { s: 'out', t: 9 };
  assert.deepEqual(divergencia(rod(), p).saiu, ['b']);
});

test('quem confirmou depois do sorteio aparece em "entrou", na ordem de confirmação', () => {
  const p = { ...vao('a', 'b', 'c', 'd'), g: { s: 'in', t: 20 }, f: { s: 'in', t: 10 } };
  assert.deepEqual(divergencia(rod(), p).entrou, ['f', 'g']);
});

test('"Manter os times assim" (nova foto) apaga o aviso', () => {
  const p = vao('a', 'c', 'd', 'f');
  assert.deepEqual(divergencia(rod({ base: ['a', 'c', 'd', 'f'] }), p), { saiu: [], entrou: [] });
});

test('quem foi posto direto num time não gera aviso', () => {
  const r = rod(); r.times[0].players.push('f'); r.base.push('f');
  assert.deepEqual(divergencia(r, vao('a', 'b', 'c', 'd', 'f')), { saiu: [], entrou: [] });
});

test('rodada sorteada antes da v15 (sem foto) usa quem entrou no sorteio', () => {
  const r = { times: [{ c: 0, players: ['a', 'b'] }], info: { a: {}, b: {}, x: {} } };
  assert.deepEqual([...fotoDoSorteio(r)].sort(), ['a', 'b', 'x']);
  assert.deepEqual(divergencia(r, vao('a', 'b', 'x', 'y')).entrou, ['y']);
});

test('foraDosTimes lista só quem ainda não está em nenhum time', () => {
  assert.deepEqual(foraDosTimes(rod(), ['a', 'e', 'f']), ['e', 'f']);
});
