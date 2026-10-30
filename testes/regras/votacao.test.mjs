/* Regra "votação dos destaques" (uma das 5 da D12; KAN-220). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidatos, tally } from '../../src/dominio/votacao.ts';

const vot = { rid: 'r1', cats: [{ id: 'best' }, { id: 'worst' }, { id: 'pGOL', pos: 'GOL' }] };

test('conta um voto por aparelho em cada categoria e aponta quem ganhou', () => {
  const r = tally(vot, {
    u1: { v: { best: 'ana', worst: 'beto' } },
    u2: { v: { best: 'ana', worst: 'caio' } },
    u3: { v: { best: 'dani' } },
  });
  assert.deepEqual(r.best, { counts: { ana: 2, dani: 1 }, total: 3, winners: ['ana'] });
  assert.equal(r.worst.total, 2);
});

test('empate: todos os empatados ganham', () => {
  const r = tally(vot, { u1: { v: { worst: 'beto' } }, u2: { v: { worst: 'caio' } } });
  assert.deepEqual(r.worst.winners.sort(), ['beto', 'caio']);
});

test('sem votos, ninguém ganha (e toda categoria aparece no resultado)', () => {
  const r = tally(vot, {});
  assert.deepEqual(Object.keys(r).sort(), ['best', 'pGOL', 'worst']);
  assert.deepEqual(r.best, { counts: {}, total: 0, winners: [] });
});

test('voto com id inválido, em categoria que não existe ou de aparelho vazio não conta', () => {
  const r = tally(vot, {
    u1: { v: { best: '<script>' } },
    u2: { v: { naoExiste: 'ana' } },
    u3: null,
    u4: {},
    u5: { v: { best: 'ana' } },
  });
  assert.deepEqual(r.best, { counts: { ana: 1 }, total: 1, winners: ['ana'] });
  assert.equal(r.naoExiste, undefined);
});

test('candidatos: quem jogou a rodada, em ordem alfabética; categoria com posição, só dessa posição', () => {
  const times = [{ players: ['z', 'a'] }, { players: ['g', 'm'] }],
    nome = id => ({ z: 'Zeca', a: 'Ana', g: 'Gui', m: 'Márcio' })[id],
    pos = id => ({ g: 'GOL', z: 'GOL' })[id];
  assert.deepEqual(candidatos(times, { id: 'best' }, pos, nome), ['a', 'g', 'm', 'z']);
  assert.deepEqual(candidatos(times, { id: 'pGOL', pos: 'GOL' }, pos, nome), ['g', 'z']);
  assert.deepEqual(candidatos(undefined, { id: 'best' }, pos, nome), []);
});
