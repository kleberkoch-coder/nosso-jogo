/* Cor livre do colete (KAN-235): o valor gravado, o quadradinho do WhatsApp, o nome sugerido e as recentes.
   Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clara, ehCorLivre, lerCorLivre } from '../../src/dominio/cores.ts';
import { corLivre, emojiDaCor, familia, hsvParaHex } from '../../src/dominio/cores-paleta.ts';
import { recentes } from '../../src/dominio/cores-recentes.ts';

test('CT-KAN-235-01: a cor livre é "#rrggbb|quadradinho|Nome"; as 8 de sempre continuam números', () => {
  assert.equal(corLivre('#E91E63', '  Rosa   choque '), '#e91e63|🟪|Rosa choque');
  assert.equal(corLivre('#112233', 'a|b'), '#112233|⬛|a b');
  assert.ok(ehCorLivre('#e91e63|🟪|Rosa'));
  assert.ok(!ehCorLivre(3) && !ehCorLivre('3') && !ehCorLivre('#e91e63') && !ehCorLivre(null));
  assert.deepEqual(lerCorLivre('#e91e63|🟪|Rosa'), { n: 'Rosa', c: '#e91e63', e: '🟪', livre: true });
  assert.equal(corLivre('#abcdef', 'x'.repeat(30)).split('|')[2].length, 20);
});

test('CT-KAN-235-02: nome sugerido e quadradinho do WhatsApp pela família da cor', () => {
  const casos = {
    '#000000': ['preto', '⬛'],
    '#ffffff': ['branco', '⬜'],
    '#808080': ['cinza', '⬜'],
    '#e53935': ['vermelho', '🟥'],
    '#7b1f2b': ['vinho', '🟥'],
    '#ff8c1a': ['laranja', '🟧'],
    '#6d4c2f': ['marrom', '🟫'],
    '#ffd600': ['amarelo', '🟨'],
    '#2e9e4f': ['verde', '🟩'],
    '#20c4c4': ['turquesa', '🟦'],
    '#1e3a8a': ['marinho', '🟦'],
    '#2f7df6': ['azul', '🟦'],
    '#7e3fd8': ['roxo', '🟪'],
    '#f06292': ['rosa', '🟪'],
  };
  for (const [hex, [fam, e]] of Object.entries(casos)) {
    assert.equal(familia(hex), fam, hex);
    assert.equal(emojiDaCor(hex), e, hex);
  }
  assert.ok(clara('#fafafa') && !clara('#e91e63'));
});

test('CT-KAN-235-02: a paleta converte o ponto escolhido em cor', () => {
  assert.equal(hsvParaHex(0, 1, 1), '#ff0000');
  assert.equal(hsvParaHex(120, 1, 1), '#00ff00');
  assert.equal(hsvParaHex(240, 1, 0.5), '#000080');
  assert.equal(hsvParaHex(0, 0, 1), '#ffffff');
});

test('CT-KAN-235-03: as recentes são as cores livres das últimas rodadas, sem repetir, até 4', () => {
  const rs = [
    { date: '2026-10-01', times: [{ c: '#111111|Grafite' }, { c: 2 }] },
    { date: '2026-11-01', times: [{ c: 0 }, { c: 1 }], cores: { 0: '#e91e63|Rosa', 1: '#e91e63|Pink' } },
    { date: '2026-10-20', times: [{ c: '#00aa00|Verde-bandeira' }, { c: '#222222|Carvão' }, { c: '#333333|Chumbo' }] },
  ];
  assert.deepEqual(recentes(rs), ['#e91e63|Rosa', '#00aa00|Verde-bandeira', '#222222|Carvão', '#333333|Chumbo']);
  assert.deepEqual(recentes([]), []);
});
