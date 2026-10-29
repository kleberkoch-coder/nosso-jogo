/* KAN-214: avaliação de notas por link. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aberta,
  erroAvaliacao,
  media,
  mediana,
  meioPonto,
  NOTAS,
  notaValida,
  resultado,
  responderam,
} from '../../src/dominio/avaliacao.ts';

test('notas de 1 a 10, de meio em meio ponto', () => {
  assert.equal(NOTAS.length, 19);
  assert.ok(notaValida(7.5) && notaValida(1) && notaValida(10));
  assert.ok(!notaValida(7.3) && !notaValida(0) && !notaValida('7'));
  assert.equal(meioPonto(6.75), 7);
  assert.equal(meioPonto(6.7), 6.5);
});

test('média e mediana (5, 6, 7 e 9: média 6,75 e mediana 6,5)', () => {
  assert.equal(media([5, 6, 7, 9]), 6.75);
  assert.equal(mediana([9, 5, 7, 6]), 6.5);
  assert.equal(mediana([7, 5, 9]), 7);
  assert.equal(media([]), null);
});

test('resultado: mesmo peso para todos; mesmo nome duas vezes vale a mais recente; administradores contam cada um', () => {
  const r = resultado(
    { jogs: ['a', 'b'] },
    {
      u1: { pid: 'a', n: { a: 8, b: 5 }, t: 1 },
      u2: { pid: 'a', n: { a: 6, b: 6 }, t: 5 },
      u3: { pid: 'b', n: { a: 7 }, t: 2 },
      adm1: { pid: '', n: { a: 9, b: 7 }, t: 3 },
      adm2: { pid: '', n: { b: 8 }, t: 4 },
      vazio: null,
    }
  );
  assert.deepEqual(r[0], { pid: 'a', media: 7.33, mediana: 7, qtd: 3 });
  assert.deepEqual(r[1], { pid: 'b', media: 7, mediana: 7, qtd: 3 });
  assert.deepEqual(responderam({ u1: { pid: 'a', n: {} }, a1: { pid: '', n: {} } }), { nomes: ['a'], adm: 1 });
});

test('aberta até o fim do prazo e enquanto não encerrada', () => {
  assert.ok(aberta({ ate: 100, open: true }, 50));
  assert.ok(!aberta({ ate: 100, open: true }, 100));
  assert.ok(!aberta({ ate: 100, open: false }, 50));
});

test('criação: título, data a partir de hoje e mensalistas', () => {
  assert.equal(erroAvaliacao({ t: '', data: '2026-11-05', jogs: ['a'] }, '2026-10-29'), 'aval.erroTitulo');
  assert.equal(erroAvaliacao({ t: 'X', data: '2026-10-28', jogs: ['a'] }, '2026-10-29'), 'aval.erroData');
  assert.equal(erroAvaliacao({ t: 'X', data: '2026-10-29', jogs: [] }, '2026-10-29'), 'aval.erroMensalistas');
  assert.equal(erroAvaliacao({ t: 'X', data: '2026-10-29', jogs: ['a'] }, '2026-10-29'), '');
});
