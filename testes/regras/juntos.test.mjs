/* KAN-200: quem mais joga junto. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rodadasComTimes, vezesJuntos } from '../../src/dominio/juntos.ts';

const R = [
  { times: [{ players: ['ana', 'beto', 'caio'] }, { players: ['duda', 'eli'] }] },
  { times: null },
  { times: [{ players: ['ana', 'beto'] }, { players: ['caio', 'duda'] }] },
  { times: [{ players: ['beto', 'ana'] }, { players: ['eli', 'caio'] }] },
];

test('conta quantas vezes cada par jogou no mesmo time', () => {
  const v = vezesJuntos(R);
  assert.deepEqual(v[0], { a: 'ana', b: 'beto', n: 3 });
  assert.equal(v.find(p => p.a === 'caio' && p.b === 'duda').n, 1);
  assert.equal(v.find(p => p.a === 'caio' && p.b === 'eli').n, 1);
});

test('no empate, vem primeiro quem jogou junto mais recentemente', () => {
  const v = vezesJuntos(R).filter(p => p.n === 1);
  assert.deepEqual(
    v.slice(0, 3).map(p => p.a + '+' + p.b),
    ['ana+caio', 'beto+caio', 'duda+eli']
  );
});

test('rodada sem times não conta; sem sorteio, lista vazia', () => {
  assert.equal(rodadasComTimes(R), 3);
  assert.deepEqual(vezesJuntos([{ times: null }]), []);
});

test('o mesmo nome repetido no time não vira par com ele mesmo', () => {
  assert.deepEqual(vezesJuntos([{ times: [{ players: ['ana', 'ana', 'beto'] }] }]), [{ a: 'ana', b: 'beto', n: 1 }]);
});
