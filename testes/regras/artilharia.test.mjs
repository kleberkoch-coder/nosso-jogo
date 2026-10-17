/* KAN-178: artilharia da rodada (só gols, sem resultado). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicar, camposEdicao, ranking, resumirTudo } from '../../src/dominio/resumos.ts';

const ART = gols => ({ id: 'art', tipo: 'art', rid: 'r1', date: '2026-10-17', gols });
const PART = { id: 'm1', rid: 'r1', date: '2026-10-17', ca: 0, cb: 1, pa: ['a'], pb: ['b'], ga: 1, gb: 0, goals: [{ t: 'a', pid: 'a' }], at: 1 };
const linha = (doc, id) => ranking([doc]).find(l => l.id === id) || {};

test('lançar 3 gols: a artilharia sobe 3 e não conta jogo nem vitória (critério 1)', () => {
  const doc = resumirTudo([ART({ c: 3 })], [], [])['2026-10'];
  const l = linha(doc, 'c');
  assert.equal(l.gols, 3);
  assert.deepEqual([l.j || 0, l.v || 0, l.e || 0, l.d || 0], [0, 0, 0, 0]);
  assert.deepEqual(doc.jogos, {});
});

test('corrigir de 3 para 2: a artilharia desce 1 (critério 2)', () => {
  const doc = resumirTudo([ART({ c: 3, d: 1 })], [], [])['2026-10'];
  camposEdicao(ART({ c: 3, d: 1 }), ART({ c: 2 }), 'r1', '2026-10-17').forEach(c => aplicar(doc, c));
  assert.equal(linha(doc, 'c').gols, 2);
  assert.equal(linha(doc, 'd').gols || 0, 0);
});

test('com partidas na mesma rodada, os gols somam e o resultado vem só das partidas', () => {
  const doc = resumirTudo([PART, ART({ a: 2 })], [], [])['2026-10'];
  const l = linha(doc, 'a');
  assert.equal(l.gols, 3);
  assert.equal(l.j, 1);
  assert.equal(l.v, 1);
});
