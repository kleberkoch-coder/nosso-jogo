/* KAN-293: foto do jogador (regra pura). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOTO_LADO,
  FOTO_MAX_MB,
  arquivoFoto,
  enderecoFoto,
  formatoSemWebp,
  nomeFoto,
  nomeFotoValido,
  tamanhoReduzido,
} from '../../src/dominio/foto.ts';

test('CT-KAN-293-06: aceita JPG, PNG e WebP até 5 MB; GIF, SVG, HEIC e arquivo vazio ou grande não', () => {
  assert.equal(FOTO_MAX_MB, 5);
  for (const type of ['image/jpeg', 'image/png', 'image/webp'])
    assert.equal(arquivoFoto({ type, size: 1000 }), null, type);
  for (const type of ['image/gif', 'image/svg+xml', 'image/heic', 'application/pdf', ''])
    assert.equal(arquivoFoto({ type, size: 1000 }), 'tipo', type);
  assert.equal(arquivoFoto({ type: 'image/png', size: 5 * 1024 * 1024 }), null);
  assert.equal(arquivoFoto({ type: 'image/png', size: 5 * 1024 * 1024 + 1 }), 'tamanho');
  assert.equal(arquivoFoto({ type: 'image/png', size: 0 }), 'tamanho');
});

test('CT-KAN-293-07: reduz o lado maior para 800 px sem cortar e sem aumentar foto pequena', () => {
  assert.equal(FOTO_LADO, 800);
  assert.deepEqual(tamanhoReduzido(3000, 4000), { w: 600, h: 800 });
  assert.deepEqual(tamanhoReduzido(4000, 3000), { w: 800, h: 600 });
  assert.deepEqual(tamanhoReduzido(400, 500), { w: 400, h: 500 });
  assert.deepEqual(tamanhoReduzido(0, 500), { w: 0, h: 0 });
});

test('CT-KAN-293-08: nome do arquivo e endereço público; só nomes de foto e jogadores válidos', () => {
  assert.equal(nomeFoto(1732370000123.7, 'image/webp'), 'foto-1732370000123.webp');
  assert.equal(nomeFoto(1732370000123, 'image/png'), 'foto-1732370000123.png');
  assert.equal(nomeFoto(1732370000123, 'image/jpeg'), 'foto-1732370000123.jpg');
  assert.ok(nomeFotoValido('foto-1732370000123.webp'));
  for (const ruim of ['foto-1.webp', 'logo-1732370000123.webp', 'foto-1732370000123.gif', '../x', null, 3])
    assert.equal(nomeFotoValido(ruim), false, String(ruim));
  assert.equal(
    enderecoFoto('b.appspot.com', 'g1', 'p_1', 'foto-1732370000123.webp'),
    'https://firebasestorage.googleapis.com/v0/b/b.appspot.com/o/grupos%2Fg1%2Fjogadores%2Fp_1%2Ffoto-1732370000123.webp?alt=media'
  );
  assert.equal(enderecoFoto('b', 'g1', 'p/../x', 'foto-1732370000123.webp'), '');
  assert.equal(enderecoFoto('', 'g1', 'p1', 'foto-1732370000123.webp'), '');
});

test('CT-KAN-293-02: sem WebP, a foto com transparência vai em PNG; sem transparência, em JPEG', () => {
  assert.equal(formatoSemWebp(true), 'image/png');
  assert.equal(formatoSemWebp(false), 'image/jpeg');
});
