/* KAN-213: rateio (vaquinha) do caixa. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  camposDoRateio,
  dividirRateio,
  erroRateio,
  pendenciasDeRateio,
  situacao,
  soma,
  valorFixo,
} from '../../src/dominio/rateio.ts';

const sete = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

test('R$ 505 entre 7: R$ 72,14 cada, centavos no primeiro, e o total confere (critério 1)', () => {
  const p = dividirRateio(50500, sete);
  assert.equal(p.a, 7216);
  sete.slice(1).forEach(x => assert.equal(p[x], 7214));
  assert.equal(soma(p), 50500);
});

test('valor ajustado: quem pegou 2 camisas paga R$ 170, o resto divide o que sobra', () => {
  const p = dividirRateio(35000, ['a', 'b', 'c'], { a: 17000 });
  assert.deepEqual(p, { a: 17000, b: 9000, c: 9000 });
  const f = valorFixo(8500, ['a', 'b', 'c'], { a: 17000 });
  assert.deepEqual(f, { a: 17000, b: 8500, c: 8500 });
  assert.deepEqual(dividirRateio(1000, ['a', 'b'], { a: 5000 }), { a: 5000, b: 0 });
});

test('situação: entrou, falta, quem pagou e quem falta (pagamento parcial conta)', () => {
  const s = situacao({
    n: 'Churrasco',
    modo: 'total',
    base: 21000,
    part: { a: 7000, b: 7000, c: 7000 },
    pg: { a: 7000, b: 3000 },
    gasto: 20000,
  });
  assert.equal(s.total, 21000);
  assert.equal(s.entrou, 10000);
  assert.equal(s.falta, 11000);
  assert.deepEqual(s.pagaram, [['a', 7000]]);
  assert.deepEqual(s.faltam, [
    ['b', 4000],
    ['c', 7000],
  ]);
  assert.equal(s.gasto, 20000);
});

test('pendências: só rateios abertos marcados para aparecer', () => {
  const r = { n: 'Bola', modo: 'fixo', base: 1000, part: { a: 1000, b: 1000 }, pg: { a: 1000 } };
  const l = pendenciasDeRateio({
    r1: { ...r, pend: true },
    r2: { ...r, pend: false },
    r3: { ...r, pend: true, fim: 1 },
    r4: null,
  });
  assert.deepEqual(l, [{ rid: 'r1', n: 'Bola', pid: 'b', v: 1000 }]);
});

test('lançamento ligado: entrada com jogador soma em pg; despesa soma em gasto; apagar desconta', () => {
  assert.deepEqual(camposDoRateio({ k: 'entrada', v: 72.14, pid: 'a', rat: 'r1' }, 1), { 'rat.r1.pg.a': 7214 });
  assert.deepEqual(camposDoRateio({ k: 'entrada', v: 72.14, pid: 'a', rat: 'r1' }, -1), { 'rat.r1.pg.a': -7214 });
  assert.deepEqual(camposDoRateio({ k: 'despesa', v: 505, rat: 'r1' }, 1), { 'rat.r1.gasto': 50500 });
  assert.equal(camposDoRateio({ k: 'entrada', v: 10, pid: 'a' }, 1), null);
  assert.equal(camposDoRateio({ k: 'entrada', v: 10, rat: 'r1' }, 1), null);
});

test('janela: nome, participantes e valor obrigatórios', () => {
  assert.equal(erroRateio({ n: ' ', part: { a: 1 } }), 'rateio.erroNome');
  assert.equal(erroRateio({ n: 'X', part: {} }), 'rateio.erroParticipantes');
  assert.equal(erroRateio({ n: 'X', part: { a: 0 } }), 'rateio.erroValor');
  assert.equal(erroRateio({ n: 'X', part: { a: 100 } }), '');
});
