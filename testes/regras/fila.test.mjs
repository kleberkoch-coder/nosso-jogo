/* KAN-175: sugestão do próximo jogo e fila de espera. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proximoJogo } from '../../src/dominio/fila.ts';

const j = (a, b, ga, gb) => ({ a, b, ga, gb });

test('primeiro jogo: os dois primeiros do sorteio; os outros esperam na ordem', () => {
  assert.deepEqual(proximoJogo(4, []), { a: 0, b: 1, espera: [2, 3] });
});
test('4 times: quem ganha fica e entra quem espera há mais tempo (critério 3)', () => {
  const j1 = [j(0, 1, 1, 0)];
  assert.deepEqual(proximoJogo(4, j1), { a: 0, b: 2, espera: [3, 1] });
  const j2 = j1.concat(j(0, 2, 0, 1));
  assert.deepEqual(proximoJogo(4, j2), { a: 2, b: 3, espera: [1, 0] });
});
test('3 times: empate depois do 1º jogo, fica quem entrou (critério 4)', () => {
  const js = [j(0, 1, 1, 0), j(0, 2, 1, 1)];
  assert.deepEqual(proximoJogo(3, js), { a: 2, b: 1, espera: [0] });
});
test('empate no 1º jogo: fica o primeiro do sorteio (critério 4)', () => {
  assert.deepEqual(proximoJogo(3, [j(0, 1, 0, 0)]), { a: 0, b: 2, espera: [1] });
  assert.deepEqual(proximoJogo(3, [j(1, 0, 2, 2)]), { a: 0, b: 2, espera: [1] });
});
test('jogo trocado à mão: a sugestão parte do que aconteceu (critério 5)', () => {
  // o responsável pôs 0 × 3 em vez de 0 × 2; 3 ganhou: entra 2, que nunca jogou
  const js = [j(0, 1, 1, 0), j(0, 3, 0, 2)];
  assert.deepEqual(proximoJogo(4, js), { a: 3, b: 2, espera: [1, 0] });
});
test('2 times: os mesmos de novo', () => {
  assert.deepEqual(proximoJogo(2, [j(0, 1, 3, 1)]), { a: 0, b: 1, espera: [] });
});
test('time B ganha: ele fica no lugar do A', () => {
  assert.deepEqual(proximoJogo(3, [j(0, 1, 0, 2)]), { a: 1, b: 2, espera: [0] });
});
