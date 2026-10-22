/* KAN-163: relógio de 12 ou 24 horas e primeiro dia da semana. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faixa, mostrarHora, ordemDias, para12, para24, partes } from '../../src/dominio/relogio.ts';

const P = { am: 'AM', pm: 'PM' };

test('24h (Brasil e grupo antigo): nada muda', () => {
  assert.equal(mostrarHora('20:00', false, P), '20:00');
  assert.equal(faixa('20:00', '22:00', false, P), '20:00–22:00');
  assert.equal(faixa('20:00', '', false, P), '20:00');
});

test('12h: noite, meio-dia e meia-noite', () => {
  assert.equal(mostrarHora('20:00', true, P), '8:00 PM');
  assert.equal(mostrarHora('12:00', true, P), '12:00 PM');
  assert.equal(mostrarHora('00:30', true, P), '12:30 AM');
  assert.equal(mostrarHora('09:05', true, P), '9:05 AM');
});

test('12h: faixa no mesmo período mostra o período uma vez; passando da meia-noite, os dois', () => {
  assert.equal(faixa('19:00', '21:00', true, P), '7:00–9:00 PM');
  assert.equal(faixa('23:00', '01:00', true, P), '11:00 PM–1:00 AM');
  assert.equal(faixa('11:00', '13:00', true, P), '11:00 AM–1:00 PM');
  assert.equal(faixa('', '22:00', true, P), '');
});

test('conversão entre 12h e 24h, ida e volta', () => {
  assert.deepEqual(para12(0), { h: 12, pm: false });
  assert.deepEqual(para12(12), { h: 12, pm: true });
  assert.deepEqual(para12(23), { h: 11, pm: true });
  assert.equal(para24(12, false), 0);
  assert.equal(para24(12, true), 12);
  assert.equal(para24(8, true), 20);
  for (let h = 0; h < 24; h++) {
    const t = para12(h);
    assert.equal(para24(t.h, t.pm), h);
  }
});

test('texto fora do formato não quebra', () => {
  assert.equal(partes('25:00'), null);
  assert.equal(partes('abc'), null);
  assert.equal(mostrarHora('abc', true, P), 'abc');
});

test('semana: Brasil e EUA começam no domingo; Portugal também; Espanha e Argentina na segunda', () => {
  assert.deepEqual(ordemDias('BR'), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(ordemDias('US'), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(ordemDias(undefined), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(ordemDias('ES'), [1, 2, 3, 4, 5, 6, 0]);
  assert.deepEqual(ordemDias('AR'), [1, 2, 3, 4, 5, 6, 0]);
});
