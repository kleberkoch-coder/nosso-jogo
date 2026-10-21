/* KAN-184: quando esperar o servidor e quando tentar de novo. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esperarServidor, proximaTentativa } from '../../src/nucleo/carga.ts';

test('documento ausente só na cópia do aparelho, online: espera o servidor', () => {
  assert.equal(esperarServidor({ existe: false, daCopia: true, online: true }), true);
});
test('o servidor confirmou que não existe, ou o aparelho está sem internet: vale o que veio', () => {
  assert.equal(esperarServidor({ existe: false, daCopia: false, online: true }), false);
  assert.equal(esperarServidor({ existe: false, daCopia: true, online: false }), false);
  assert.equal(esperarServidor({ existe: true, daCopia: true, online: true }), false);
});
test('erro de rede: tenta de novo depois de 1, 2 e 4 segundos, e então desiste', () => {
  assert.deepEqual(
    [0, 1, 2, 3].map(t => proximaTentativa('unavailable', t)),
    [1000, 2000, 4000, null]
  );
  assert.equal(proximaTentativa('firestore/deadline-exceeded', 0), 1000);
});
test('sem permissão ou erro desconhecido do app: não repete', () => {
  assert.equal(proximaTentativa('permission-denied', 0), null);
  assert.equal(proximaTentativa(undefined, 0), null);
  assert.equal(proximaTentativa('invalid-argument', 0), null);
});
