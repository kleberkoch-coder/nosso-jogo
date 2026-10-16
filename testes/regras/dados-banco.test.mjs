/* KAN-167: lista dentro de lista (posições criadas e pares separados) grava no Firestore e volta igual. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doBanco, paraBanco, temListaDentroDeLista } from '../../src/nucleo/dados-banco.ts';

test('posições criadas pelo grupo: gravam sem lista dentro de lista e voltam iguais', () => {
  const app = {
    name: 'Fut',
    posx: [
      ['VOL', 'Volante'],
      ['LAT', 'Lateral'],
    ],
    cfg: { fixos: [{ dow: 1, ini: '20:00' }] },
  };
  assert.equal(temListaDentroDeLista(app), true);
  const gravado = paraBanco(app);
  assert.equal(temListaDentroDeLista(gravado), false);
  assert.deepEqual(gravado.posx, [{ __lista: ['VOL', 'Volante'] }, { __lista: ['LAT', 'Lateral'] }]);
  assert.deepEqual(doBanco(gravado), app);
});

test('pares que não jogam juntos e operações de patch (união) também', () => {
  const r = { nivel: { a: 7 }, sep: [['a', 'b']] };
  assert.deepEqual(doBanco(paraBanco(r)), r);
  const patch = { sep: { $op: 'uniao', v: [['c', 'd']] } };
  assert.equal(temListaDentroDeLista(paraBanco(patch)), false);
  assert.deepEqual(doBanco(paraBanco(patch)), patch);
});

test('dados sem lista dentro de lista não mudam; o formato antigo é lido igual', () => {
  const t = { times: [{ players: ['a', 'b'], c: 0 }], n: 3, x: null, s: 'oi' };
  assert.deepEqual(paraBanco(t), t);
  assert.deepEqual(doBanco(t), t);
  assert.deepEqual(doBanco({ posx: [] }), { posx: [] });
});
