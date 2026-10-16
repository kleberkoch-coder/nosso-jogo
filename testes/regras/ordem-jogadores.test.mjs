/* KAN-168: ordem da lista de jogadores. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordemValida, ordenarJogadores } from '../../src/dominio/ordem-jogadores.ts';

const L = [
  { id: 'a', nome: 'Bruno', pos: 'ATA', nota: 7, tipo: 'mensalista', criado: 3 },
  { id: 'b', nome: 'Ana', pos: 'GOL', nota: 9, tipo: 'diarista', criado: 1 },
  { id: 'c', nome: 'Caio', pos: 'GOL', nota: 7, tipo: 'mensalista', criado: 2 },
  { id: 'd', nome: 'Davi', nota: 5, tipo: 'diarista' },
];
const ctx = { posicoes: ['GOL', 'ZAG', 'MEI', 'ATA'], local: 'pt-BR' };
const ids = o =>
  ordenarJogadores(L, o, ctx)
    .map(x => x.id)
    .join('');

test('nome (A–Z) é o padrão', () => assert.equal(ids('nome'), 'bacd'));
test('posição: na ordem do esporte, sem posição no fim, empate por nome', () => assert.equal(ids('posicao'), 'bcad'));
test('nota: maior primeiro, empate por nome', () => assert.equal(ids('nota'), 'bacd'));
test('tipo: mensalistas primeiro', () => assert.equal(ids('tipo'), 'acbd'));
test('mais recentes: quem entrou por último primeiro', () => assert.equal(ids('recentes'), 'acbd'));
test('ordem guardada inválida ou posição num esporte sem posição volta para nome', () => {
  assert.equal(ordemValida('xyz', true), 'nome');
  assert.equal(ordemValida('posicao', false), 'nome');
  assert.equal(ordemValida('nota', false), 'nota');
});
