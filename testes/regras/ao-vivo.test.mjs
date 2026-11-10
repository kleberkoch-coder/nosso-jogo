/* Partida em andamento guardada no aparelho (KAN-236, pelada-v103). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveAoVivo, paraGuardar, paraVoltar } from '../../src/dominio/ao-vivo.ts';

const times = [{ players: ['a', 'b'] }, { players: ['c', 'd'] }, { players: ['e', 'f'] }];
const live = { rid: 'r1', a: 0, b: 2, goals: [{ t: 'a', pid: 'a' }], el: 30, run: true, st: 1000, dur: 600 };

test('CT-KAN-236-01: a partida com gols volta igual depois de recarregar, com o cronômetro', () => {
  const v = paraVoltar(paraGuardar(live, times), 'r1', times);
  assert.deepEqual(v, live);
  assert.equal(chaveAoVivo('g1'), 'nj-ao-vivo:g1');
});

test('CT-KAN-236-02: não volta com outra rodada, outro sorteio, partida que não começou ou texto estragado', () => {
  const g = paraGuardar(live, times);
  assert.equal(paraVoltar(g, 'r2', times), null);
  assert.equal(paraVoltar(g, 'r1', [{ players: ['a', 'c'] }, { players: ['b', 'd'] }, { players: ['e', 'f'] }]), null);
  assert.equal(paraVoltar(g, 'r1', times.slice(0, 2)), null);
  assert.equal(paraVoltar(paraGuardar({ ...live, goals: [], el: 0, run: false }, times), 'r1', times), null);
  assert.equal(paraVoltar('{quebrado', 'r1', times), null);
  assert.equal(paraVoltar(null, 'r1', times), null);
  assert.equal(paraGuardar(null, times), null);
});
