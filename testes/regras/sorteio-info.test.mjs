/* KAN-246: hora e número do sorteio. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comAjuste, horaDoSorteio, novoSorteio, sorteioValido } from '../../src/dominio/sorteio-info.ts';

test('CT-KAN-246-01 e 02: cada sorteio sobe 1, guarda a hora do toque e zera os ajustes', () => {
  const a = novoSorteio(undefined, 1000);
  assert.deepEqual(a, { n: 1, em: 1000, aj: 0 });
  const b = novoSorteio({ n: 2, em: 1000, aj: 4 }, 5000);
  assert.deepEqual(b, { n: 3, em: 5000, aj: 0 });
});

test('CT-KAN-246-03: ajuste manual soma 1, sem mudar o número nem a hora; sem sorteio, não conta', () => {
  assert.deepEqual(comAjuste({ n: 2, em: 1000, aj: 1 }), { n: 2, em: 1000, aj: 2 });
  assert.deepEqual(comAjuste({ n: 1, em: 1000 }), { n: 1, em: 1000, aj: 1 });
  assert.equal(comAjuste(undefined), null);
  assert.equal(comAjuste({ n: 0, em: 1 }), null);
});

test('a hora sai no fuso do grupo (São Paulo e Nova York); fuso inválido usa o aparelho', () => {
  const em = Date.UTC(2026, 10, 16, 22, 42); // 19:42 em São Paulo, 17:42 em Nova York
  assert.equal(horaDoSorteio(em, 'America/Sao_Paulo'), '19:42');
  assert.equal(horaDoSorteio(em, 'America/New_York'), '17:42');
  assert.match(horaDoSorteio(em, 'Lugar/Nenhum'), /^\d{2}:\d{2}$/);
});

test('rodadas antigas (sem sorteio registrado) não mostram a linha', () => {
  assert.ok(sorteioValido({ n: 1, em: 1 }));
  assert.ok(!sorteioValido(undefined));
  assert.ok(!sorteioValido({ n: 0, em: 1 }));
  assert.ok(!sorteioValido({ n: 1 }));
});
