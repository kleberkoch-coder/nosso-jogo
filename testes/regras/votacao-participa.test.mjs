/* Quem participa da votação (KAN-230). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PADRAO, ehPadrao, lerParticipa, quemParticipa } from '../../src/dominio/votacao-participa.ts';
import { candidatos } from '../../src/dominio/votacao.ts';

const times = [{ players: ['m1', 'd1', 'a1'] }, { players: ['m2', 'd2'] }];
const tipo = id => ({ m: 'mensalista', d: 'diarista', a: 'avulso', g: 'mensalista' })[id[0]];

test('CT-KAN-230-01: sem configuração, participam todos dos times, como antes', () => {
  assert.deepEqual(lerParticipa(undefined), PADRAO);
  assert.ok(ehPadrao(lerParticipa({ lixo: 1, avulso: 'x' })));
  assert.deepEqual(quemParticipa(times, ['m1', 'g1'], tipo, PADRAO), ['m1', 'd1', 'a1', 'm2', 'd2']);
});

test('CT-KAN-230-01: sem avulsos e diaristas, eles ficam de fora', () => {
  const p = lerParticipa({ diarista: false, avulso: false });
  assert.deepEqual(quemParticipa(times, [], tipo, p), ['m1', 'm2']);
});

test('CT-KAN-230-02: com "fora do sorteio", o goleiro fixo confirmado e fora dos times entra', () => {
  const p = lerParticipa({ diarista: false, avulso: false, fora: true });
  assert.deepEqual(quemParticipa(times, ['m1', 'g1', 'a9', 'g1'], tipo, p), ['m1', 'm2', 'g1']);
});

test('CT-KAN-230-02: a lista da votação vale para os candidatos; a posição continua filtrando', () => {
  const pos = id => (id === 'g1' ? 'GOL' : 'ATA'),
    nome = id => id;
  assert.deepEqual(candidatos(times, { id: 'best' }, pos, nome, 'pt-BR', ['m2', 'g1', 'm1']), ['g1', 'm1', 'm2']);
  assert.deepEqual(candidatos(times, { id: 'gk', pos: 'GOL' }, pos, nome, 'pt-BR', ['m2', 'g1']), ['g1']);
  assert.deepEqual(candidatos(times, { id: 'best' }, pos, nome), ['a1', 'd1', 'd2', 'm1', 'm2']);
});
