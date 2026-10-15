/* KAN-156: telefone (WhatsApp) nacional e internacional, e e-mail com formato mínimo. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailValido, linkWhatsApp, normalizarTelefone, telefoneParaLer } from '../../src/dominio/contato.ts';

test('telefone brasileiro: DDD + número, com ou sem máscara, vira +55', () => {
  assert.deepEqual(normalizarTelefone('(11) 98765-4321'), { ok: true, valor: '+5511987654321' });
  assert.deepEqual(normalizarTelefone('11 3456-7890'), { ok: true, valor: '+551134567890' });
  assert.deepEqual(normalizarTelefone('5511987654321'), { ok: true, valor: '+5511987654321' });
});

test('telefone de outro país: começa com + ou 00 e o código do país', () => {
  assert.deepEqual(normalizarTelefone('+351 912 345 678'), { ok: true, valor: '+351912345678' });
  assert.deepEqual(normalizarTelefone('+1 (415) 555-0100'), { ok: true, valor: '+14155550100' });
  assert.deepEqual(normalizarTelefone('0044 7911 123456'), { ok: true, valor: '+447911123456' });
});

test('telefone inválido: letras, curto demais ou longo demais', () => {
  assert.equal(normalizarTelefone('11 9876x4321').ok, false);
  assert.deepEqual(normalizarTelefone('98765-4321'), { ok: false, erro: 'curto' });
  assert.deepEqual(normalizarTelefone('+1234567890123456'), { ok: false, erro: 'longo' });
  assert.deepEqual(normalizarTelefone(''), { ok: true, valor: '' });
});

test('link do WhatsApp: internacional certo e números antigos (sem +) continuam brasileiros', () => {
  assert.equal(linkWhatsApp('+14155550100'), 'https://wa.me/14155550100');
  assert.equal(linkWhatsApp('(11) 98765-4321'), 'https://wa.me/5511987654321');
  assert.equal(linkWhatsApp(''), '');
});

test('telefone para ler', () => {
  assert.equal(telefoneParaLer('+5511987654321'), '(11) 98765-4321');
  assert.equal(telefoneParaLer('+351912345678'), '+351912345678');
});

test('e-mail precisa de nome, @, domínio e terminação', () => {
  for (const ok of ['ana@clube.com', 'ana.souza+fut@clube.com.br', '']) assert.equal(emailValido(ok), true, ok);
  for (const ruim of ['ana', 'ana@', 'ana@clube', '@clube.com', 'ana @clube.com', 'ana@clube.c']) assert.equal(emailValido(ruim), false, ruim);
});
