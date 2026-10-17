/* KAN-64: quem ainda não respondeu e o link do WhatsApp com a mensagem. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkCobrar, semResposta } from '../../src/dominio/cobrar.ts';

test('só quem do elenco ainda não respondeu (nem Vou nem Não vou), na ordem do elenco', () => {
  const pres = { b: { s: 'in' }, c: { s: 'out' }, x: { s: 'in' } };
  assert.deepEqual(semResposta(['a', 'b', 'c', 'd'], pres), ['a', 'd']);
});

test('todo mundo respondeu: lista vazia', () => {
  assert.deepEqual(semResposta(['a'], { a: { s: 'out' } }), []);
});

test('link do WhatsApp leva a mensagem codificada; sem telefone, nada', () => {
  assert.equal(
    linkCobrar('https://wa.me/5511987654321', 'Oi, Ana! Vai?'),
    'https://wa.me/5511987654321?text=Oi%2C%20Ana!%20Vai%3F'
  );
  assert.equal(linkCobrar('', 'x'), '');
});
