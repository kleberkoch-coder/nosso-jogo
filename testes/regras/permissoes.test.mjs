/* KAN-201: permissões dos administradores convidados. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERM_CONVIDADO, PERMISSOES, pode, permLimpa } from '../../src/dominio/permissoes.ts';

test('organizador pode tudo, mesmo com permissões gravadas', () => {
  PERMISSOES.forEach(k => assert.equal(pode({ role: 'owner', perm: PERM_CONVIDADO }, k), true));
});

test('administrador de antes das permissões (sem perm) continua com tudo', () => {
  PERMISSOES.forEach(k => assert.equal(pode({ role: 'admin' }, k), true));
});

test('convidado novo começa só com o dia a dia', () => {
  PERMISSOES.forEach(k => assert.equal(pode({ role: 'admin', perm: PERM_CONVIDADO }, k), false));
});

test('o organizador liga só o que quiser', () => {
  const m = { role: 'admin', perm: { caixa: true, notas: false } };
  assert.equal(pode(m, 'caixa'), true);
  assert.equal(pode(m, 'notas'), false);
  assert.equal(pode(m, 'elenco'), false);
});

test('sem cadastro de administrador, nada', () => {
  assert.equal(pode(null, 'caixa'), false);
});

test('o que vai para o banco: as quatro chaves, sempre sim ou não', () => {
  assert.deepEqual(permLimpa({ caixa: 1, outra: true }), { caixa: true, notas: false, elenco: false, config: false });
  assert.deepEqual(permLimpa(null), PERM_CONVIDADO);
});
