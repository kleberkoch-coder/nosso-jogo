/* Ficha do cliente no portal (KAN-117, pelada-v99). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANOS_PADRAO,
  camposDaMudanca,
  diaDaValidade,
  erroDaMudanca,
  fimDoDia,
  mesmaMudanca,
  mudancaAtual,
  planoDaConta,
  ultimoDia,
} from '../../src/dominio/planos.ts';

const AGORA = Date.UTC(2026, 10, 6, 19); // 06/11/2026 16h em Brasília

test('CT-KAN-117-01: a validade escolhida vale até o fim do dia em Brasília', () => {
  const ate = fimDoDia('2026-11-30');
  assert.equal(ate, Date.UTC(2026, 11, 1, 3));
  assert.equal(diaDaValidade(ate), '2026-11-30');
  assert.equal(new Date(ultimoDia(ate) - 3 * 36e5).toISOString().slice(0, 10), '2026-11-30');
  assert.equal(fimDoDia(''), null);
  assert.equal(diaDaValidade(null), '');
});

test('CT-KAN-117-01: plano pago pede motivo; validade no passado e plano fora do catálogo são recusados', () => {
  const cat = PLANOS_PADRAO;
  assert.equal(erroDaMudanca({ plano: 'A', ate: fimDoDia('2026-11-30'), motivo: 'cortesia' }, cat, AGORA), null);
  assert.equal(erroDaMudanca({ plano: 'B', ate: null, motivo: 'pago' }, cat, AGORA), null);
  assert.equal(erroDaMudanca({ plano: 'A', ate: null, motivo: null }, cat, AGORA), 'ficha.erroMotivo');
  assert.equal(
    erroDaMudanca({ plano: 'A', ate: fimDoDia('2026-11-01'), motivo: 'teste' }, cat, AGORA),
    'ficha.erroValidade'
  );
  assert.equal(erroDaMudanca({ plano: 'Z', ate: null, motivo: 'pago' }, cat, AGORA), 'ficha.erroPlano');
  assert.equal(erroDaMudanca({ plano: 'gratis', ate: null, motivo: null }, cat, AGORA), null);
});

test('CT-KAN-117-02: Grátis limpa validade e motivo; a observação é cortada em 200 letras', () => {
  assert.deepEqual(camposDaMudanca({ plano: 'gratis', ate: 5, motivo: 'pago' }, ' x '), {
    plano: 'gratis',
    planoAte: null,
    motivo: null,
    obs: 'x',
  });
  assert.equal(camposDaMudanca({ plano: 'A', ate: 1, motivo: 'pago' }, 'a'.repeat(300)).obs.length, 200);
});

test('CT-KAN-117-03: plano dado pelo portal vale no app até a validade e depois volta ao Grátis', () => {
  const conta = camposDaMudanca({ plano: 'A', ate: fimDoDia('2026-11-30'), motivo: 'cortesia' }, '');
  assert.equal(planoDaConta(conta, PLANOS_PADRAO, AGORA).id, 'A');
  assert.equal(planoDaConta(conta, PLANOS_PADRAO, Date.UTC(2026, 11, 1, 4)).id, 'gratis');
});

test('CT-KAN-117-04: o histórico guarda de onde veio a mudança', () => {
  assert.deepEqual(mudancaAtual(null), { plano: 'gratis', ate: null, motivo: null });
  assert.deepEqual(mudancaAtual({ plano: 'B', planoAte: 9, motivo: 'parceria' }), {
    plano: 'B',
    ate: 9,
    motivo: 'parceria',
  });
  assert.deepEqual(mudancaAtual({ plano: 'A', motivo: 'xx' }).motivo, null);
  assert.ok(mesmaMudanca({ plano: 'A', ate: 1, motivo: 'pago' }, { plano: 'A', ate: 1, motivo: 'pago' }));
  assert.ok(!mesmaMudanca({ plano: 'A', ate: 1, motivo: 'pago' }, { plano: 'A', ate: 1, motivo: 'cortesia' }));
});
