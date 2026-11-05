/* Resumo das partidas da rodada para o WhatsApp (KAN-232): artilharia somada e classificação da rodada.
   Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { artilharia, autores, tabela } from '../../src/dominio/resumo-rodada.ts';

/* As 8 partidas da foto do Kleber (05/11), com os times como nome e os gols por jogador. */
const g = (t, pid, n = 1) => Array.from({ length: n }, () => ({ t, pid }));
const J = (a, ga, gb, b, goals) => ({ a, b, ga, gb, goals });
const MS = [
  J('Time 1', 1, 0, 'Time 2', g('a', 'leandro')),
  J('Time 4', 1, 0, 'Time 3', g('a', 'thiago')),
  J('Time 3', 0, 5, 'Time 1', [...g('b', 'pero', 4), ...g('b', 'leandro')]),
  J('Time 4', 1, 1, 'Time 2', [...g('a', 'denis'), ...g('b', 'kleber')]),
  J('Time 4', 3, 0, 'Time 1', [...g('a', 'thiago'), ...g('a', 'kleber', 2)]),
  J('Time 2', 4, 1, 'Time 3', [...g('a', 'gabriel'), ...g('a', 'diegao', 2), ...g('a', 'cristian'), ...g('b', 'well')]),
  J('Time 2', 1, 2, 'Time 3', [...g('a', 'cris'), ...g('b', 'cris'), ...g('b', 'diegao')]),
  J('Time 4', 1, 2, 'Time 1', [...g('a', 'daniel'), ...g('b', 'leandro'), ...g('b', 'gustavao')]),
];
const nomeDoTime = (m, l) => m[l];
const nome = p => p;

test('CT-KAN-232-02: a classificação da rodada soma 3 por vitória e 1 por empate, com saldo e gols pró', () => {
  const t = tabela(MS, nomeDoTime);
  assert.deepEqual(
    t.map(l => [l.time, l.pts, l.v, l.e, l.d, l.gp - l.gc]),
    [
      ['Time 1', 9, 3, 0, 1, 4],
      ['Time 4', 7, 2, 1, 1, 3],
      ['Time 2', 4, 1, 1, 2, 1],
      ['Time 3', 3, 1, 0, 3, -8],
    ]
  );
});

test('CT-KAN-232-02: a artilharia soma as partidas, do maior para o menor, empate em ordem alfabética', () => {
  const a = artilharia(MS, nome);
  assert.deepEqual(a.slice(0, 4), [
    ['pero', 4],
    ['diegao', 3],
    ['kleber', 3],
    ['leandro', 3],
  ]);
  assert.equal(
    a.reduce((s, [, n]) => s + n, 0),
    MS.reduce((s, m) => s + m.ga + m.gb, 0)
  );
});

test('CT-KAN-232-02: gol contra não conta para ninguém; pontos de cesta valem o lance; a artilharia lançada soma', () => {
  const ms = [{ ga: 4, gb: 1, goals: [{ t: 'a', pid: 'x', pts: 3 }, { t: 'a', pid: 'y', og: true }, { t: 'b' }] }];
  assert.deepEqual(autores(ms[0]), [['x', 3]]);
  assert.deepEqual(artilharia(ms, nome, { z: 2, w: 0 }), [
    ['x', 3],
    ['z', 2],
  ]);
});
