/* KAN-249 e KAN-66: quem marcou numa partida, em texto ("Marcão (Caio), Japa (3, Léo)").
   Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assistencias, autoresTexto } from '../../src/dominio/partida-texto.ts';

const nome = id => ({ m: 'Marcão', c: 'Caio', j: 'Japa', l: 'Léo' })[id] || id;

test('CT-KAN-66-02: autor com a assistência entre parênteses; pontos e assistência juntos', () => {
  assert.equal(
    autoresTexto(
      [
        { t: 'a', pid: 'm', as: 'c' },
        { t: 'a', pid: 'j' },
        { t: 'b', pid: 'l', pts: 3, as: 'c' },
        { t: 'b', pid: 'j', pts: 2 },
      ],
      nome,
      '(contra)'
    ),
    'Marcão (Caio), Japa, Léo (3, Caio), Japa (2)'
  );
});
test('CT-KAN-66-10: sem autor e "Caio (Caio)" ficam de fora', () => {
  assert.equal(
    autoresTexto(
      [
        { t: 'a', pid: 'c', as: 'c' },
        { t: 'a', pid: null, as: 'c' },
        { t: 'a', pid: null, og: true },
      ],
      nome,
      '(contra)'
    ),
    'Caio'
  );
  assert.equal(autoresTexto(null, nome, '(contra)'), '');
});
test('CT-KAN-306-01: gol contra aparece com a marca, sem pontos nem assistência', () => {
  assert.equal(
    autoresTexto(
      [
        { t: 'a', pid: 'm', as: 'c' },
        { t: 'a', pid: 'j', og: true, as: 'c', pts: 2 },
      ],
      nome,
      '(own goal)'
    ),
    'Marcão (Caio), Japa (own goal)'
  );
});
test('CT-KAN-66-07: assistências somadas por jogador, uma por ponto', () => {
  assert.deepEqual(
    assistencias([
      {
        goals: [
          { pid: 'm', as: 'c' },
          { pid: 'j', pts: 3, as: 'c' },
          { pid: 'c', as: 'c' },
        ],
      },
      {
        goals: [
          { pid: 'm', as: 'l' },
          { pid: 'm', og: true, as: 'l' },
        ],
      },
      { goals: null },
    ]),
    { c: 2, l: 1 }
  );
});
