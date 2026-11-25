/* KAN-295 (2ª parte): cards da rodada (regra pura). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destaquesDaRodada, numerosDaRodada } from '../../src/dominio/cards-rodada.ts';

const MS = [
  {
    ga: 2,
    gb: 1,
    pa: ['a', 'b', 'c'],
    pb: ['x', 'y'],
    goals: [
      { pid: 'a', as: 'b' },
      { pid: 'a', as: 'c' },
      { pid: 'x', og: true },
      { pid: 'y', as: 'x' },
    ],
  },
  { ga: 0, gb: 1, pa: ['a', 'b'], pb: ['x', 'y'], goals: [{ pid: 'y', as: 'x' }] },
];
const VOT = {
  open: false,
  cats: [
    { id: 'c1', name: 'Craque', neg: false },
    { id: 'c2', name: 'Melhor goleiro' },
    { id: 'c3', name: 'Bagre', neg: true },
  ],
  resultado: {
    c1: { counts: { a: 3, y: 1 }, total: 4, winners: ['a'] },
    c2: { counts: { x: 2 }, total: 2, winners: ['x'] },
    c3: { counts: { c: 4 }, total: 4, winners: ['c'] },
  },
};

test('CT-KAN-295-09: números da rodada: gols sem gol contra, assistências e vitórias, mais o total lançado', () => {
  const n = numerosDaRodada(MS, { c: 1, z: 0 });
  assert.deepEqual(n.a, { golsRod: 2, asRod: 0, vitRod: 1 });
  assert.deepEqual(n.x, { golsRod: 0, asRod: 2, vitRod: 1 });
  assert.deepEqual(n.c, { golsRod: 1, asRod: 1, vitRod: 1 });
  assert.equal(n.z, undefined);
});

test('CT-KAN-295-10: craque por categoria (a 2ª com o nome dela), artilheiros e garçons empatados, nada para o bagre', () => {
  const d = destaquesDaRodada({ ms: MS, votacoes: [VOT], temAst: true });
  assert.deepEqual(
    d.map(x => [x.tipo, x.pid, x.titulo || '']),
    [
      ['craque', 'a', ''],
      ['craque', 'x', 'Melhor goleiro'],
      ['artilheiro', 'a', ''],
      ['artilheiro', 'y', ''],
      ['garcom', 'x', ''],
    ]
  );
  assert.equal(d[0].rod.votos, 3);
  assert.equal(d[0].rod.votosPct, 75);
  assert.ok(!d.some(x => x.pid === 'c' && x.tipo === 'craque'));
});

test('CT-KAN-295-11: votação aberta não dá craque; sem assistência no esporte, sem garçom; campeão um card por jogador', () => {
  const d = destaquesDaRodada({
    ms: MS,
    votacoes: [{ ...VOT, open: true }],
    campeoes: ['a', 'b'],
    temAst: false,
  });
  assert.deepEqual(
    d.map(x => x.tipo + ':' + x.pid),
    ['artilheiro:a', 'artilheiro:y', 'campeao:a', 'campeao:b']
  );
  assert.deepEqual(destaquesDaRodada({ ms: [], temAst: true }), []);
});
