/* KAN-161: valor muito fora do padrão do grupo pede confirmação. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FATOR_FORA, foraDoPadrao, referenciaDoGrupo } from '../../src/dominio/caixa-regras.ts';

const ref = (mensal, diaria, lan = []) => referenciaDoGrupo({ mensal, diaria, lancamentos: lan, hoje: '2026-10-17' });

test('com mensalidade 80: 800 passa, 801 e 99.999.999.999 perguntam (CT-01, CT-04)', () => {
  const r = ref(80, 20);
  assert.equal(r, 80);
  assert.equal(foraDoPadrao(80, r), false);
  assert.equal(foraDoPadrao(800, r), false);
  assert.equal(foraDoPadrao(801, r), true);
  assert.equal(foraDoPadrao(99999999999, r), true);
});

test('outro país, mensalidade 100.000: 500.000 passa, 1.500.000 pergunta (CT-05)', () => {
  const r = ref(100000, 0);
  assert.equal(foraDoPadrao(500000, r), false);
  assert.equal(foraDoPadrao(1500000, r), true);
});

test('sem mensalidade e diária: vale o maior lançamento dos últimos 3 meses (CT-06)', () => {
  const lan = [
    { k: 'despesa', v: 200, d: '2026-08-10' },
    { k: 'entrada', v: 5000, d: '2026-06-30' },
  ];
  const r = ref(0, 0, lan);
  assert.equal(r, 200);
  assert.equal(foraDoPadrao(3000, r), true);
  assert.equal(foraDoPadrao(2000, r), false);
});

test('sem nenhuma referência: nunca pergunta (CT-06)', () => {
  assert.equal(foraDoPadrao(3000, ref(0, 0, [])), false);
});

test('o fator fica num lugar só', () => assert.equal(FATOR_FORA, 10));
