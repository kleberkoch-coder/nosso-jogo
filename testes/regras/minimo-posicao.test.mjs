/* KAN-179: confirmados por posição e mínimo para o jogo, para qualquer esporte. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOTAL, faltaTotal, limparMinimos, minimoValido, porPosicao } from '../../src/dominio/posicoes.ts';

const pos = { a: 'GOL', b: 'DEF', c: 'DEF', d: 'ATA' };
const posDe = id => pos[id] || '';

test('futebol: conta por posição na ordem do esporte e mostra só quem tem gente ou mínimo', () => {
  assert.deepEqual(porPosicao(['GOL', 'DEF', 'MEI', 'ATA'], ['b', 'a', 'c'], posDe), [
    { k: 'GOL', n: 1, min: 0, falta: 0 },
    { k: 'DEF', n: 2, min: 0, falta: 0 },
  ]);
});

test('mínimo de 2 goleiros com 1 confirmado: falta 1; posição sem ninguém mas com mínimo aparece', () => {
  const l = porPosicao(['GOL', 'DEF', 'MEI'], ['a', 'b'], posDe, { GOL: 2, MEI: 1 });
  assert.deepEqual(l, [
    { k: 'GOL', n: 1, min: 2, falta: 1 },
    { k: 'DEF', n: 1, min: 0, falta: 0 },
    { k: 'MEI', n: 0, min: 1, falta: 1 },
  ]);
});

test('vôlei: as siglas vêm do esporte (nada fixo de goleiro)', () => {
  const v = { x: 'LEV', y: 'PON', z: 'PON' };
  assert.deepEqual(
    porPosicao(['LEV', 'PON', 'CEN', 'OPO', 'LIB'], ['x', 'y', 'z'], id => v[id], { LEV: 2 }).map(p => [
      p.k,
      p.n,
      p.falta,
    ]),
    [
      ['LEV', 1, 1],
      ['PON', 2, 0],
    ]
  );
});

test('esporte sem posição (beach tennis): só o mínimo total vale', () => {
  assert.deepEqual(
    porPosicao([], ['a', 'b'], () => ''),
    []
  );
  assert.deepEqual(faltaTotal(6, { [TOTAL]: 8 }), { min: 8, falta: 2 });
  assert.deepEqual(faltaTotal(9, { [TOTAL]: 8 }), { min: 8, falta: 0 });
  assert.deepEqual(faltaTotal(3), { min: 0, falta: 0 });
});

test('o que vai para o grupo: só posições que existem, inteiros de 1 a 99, e o total', () => {
  assert.deepEqual(limparMinimos(['GOL', 'DEF'], { GOL: '2', DEF: '0', XXX: 5, [TOTAL]: '16' }), {
    GOL: 2,
    [TOTAL]: 16,
  });
  assert.deepEqual(limparMinimos([], { [TOTAL]: '' }), {});
  assert.equal(minimoValido('-3'), 0);
  assert.equal(minimoValido('2.7'), 2);
  assert.equal(minimoValido(500), 99);
  assert.equal(minimoValido('abc'), 0);
});
