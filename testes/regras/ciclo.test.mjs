/* KAN-209: ciclo da mensalidade (dia de início), competência e atrasadas. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anteriores, compComDia, competenciaDe, diaDe, dividir, mudarDia, periodo } from '../../src/dominio/ciclo.ts';

const c20 = [{ desde: '2000-01', dia: 20 }];

test('sem ciclo: dia 1, mês do calendário (como antes)', () => {
  assert.equal(diaDe(null, '2026-10'), 1);
  assert.deepEqual(periodo(null, '2026-02'), { ini: '2026-02-01', fim: '2026-02-28' });
  assert.equal(competenciaDe(null, '2026-10-31'), '2026-10');
});

test('ciclo no dia 20: a competência é o mês em que o período começa (decisão do Kleber)', () => {
  assert.deepEqual(periodo(c20, '2026-01'), { ini: '2026-01-20', fim: '2026-02-19' });
  assert.deepEqual(periodo(c20, '2026-12'), { ini: '2026-12-20', fim: '2027-01-19' });
  assert.equal(competenciaDe(c20, '2026-02-10'), '2026-01');
  assert.equal(competenciaDe(c20, '2026-02-20'), '2026-02');
  assert.equal(competenciaDe(c20, '2027-01-05'), '2026-12');
});

test('mudar o dia: "a partir da próxima" não mexe na atual; "já na atual" muda o período da atual', () => {
  const prox = mudarDia(null, 21, '2026-10', false);
  assert.deepEqual(prox, [{ desde: '2026-11', dia: 21 }]);
  assert.deepEqual(periodo(prox, '2026-10'), { ini: '2026-10-01', fim: '2026-11-20' });
  assert.deepEqual(periodo(prox, '2026-11'), { ini: '2026-11-21', fim: '2026-12-20' });
  const ja = mudarDia(null, 21, '2026-10', true);
  assert.deepEqual(periodo(ja, '2026-10'), { ini: '2026-10-21', fim: '2026-11-20' });
  assert.deepEqual(periodo(ja, '2026-09'), { ini: '2026-09-01', fim: '2026-10-20' });
  // Voltar ao mesmo dia que já vale: nada muda; regras futuras saem
  assert.deepEqual(mudarDia(prox, 1, '2026-10', false), []);
  assert.deepEqual(mudarDia([{ desde: '2026-01', dia: 10 }], 10, '2026-10', true), [{ desde: '2026-01', dia: 10 }]);
});

test('em atraso: as 6 competências anteriores, da mais recente para a mais antiga', () => {
  assert.deepEqual(anteriores('2026-02'), ['2026-01', '2025-12', '2025-11', '2025-10', '2025-09', '2025-08']);
});

test('vários meses de uma vez: divide o total, com os centavos no primeiro', () => {
  assert.deepEqual(dividir(170, ['2026-01', '2026-02']), [
    ['2026-01', 85],
    ['2026-02', 85],
  ]);
  assert.deepEqual(dividir(100, ['a', 'b', 'c']), [
    ['a', 33.34],
    ['b', 33.33],
    ['c', 33.33],
  ]);
});

test('"já na mensalidade atual": a atual é a que contém hoje com o dia novo', () => {
  // Hoje 10/03, dia 1 passa a 20: a atual vira fevereiro (20/02 a 19/03); janeiro vai até 19/02
  const comp = compComDia(20, '2026-03-10');
  assert.equal(comp, '2026-02');
  const c = mudarDia(null, 20, comp, true);
  assert.equal(competenciaDe(c, '2026-03-10'), '2026-02');
  assert.deepEqual(periodo(c, '2026-02'), { ini: '2026-02-20', fim: '2026-03-19' });
  assert.deepEqual(periodo(c, '2026-01'), { ini: '2026-01-01', fim: '2026-02-19' });
  // Hoje 25/03: a atual vira março (20/03 a 19/04)
  assert.equal(compComDia(20, '2026-03-25'), '2026-03');
});
