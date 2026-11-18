/* KAN-273: logotipo do grupo (regra pura). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOGO_MAX_MB,
  arquivoLogo,
  enderecoLogo,
  nomeLogo,
  nomeLogoValido,
  recorteQuadrado,
} from '../../src/dominio/logo.ts';

test('CT-KAN-273-06: aceita JPG, PNG, WebP e GIF até 5 MB; SVG e arquivo grande não', () => {
  assert.equal(LOGO_MAX_MB, 5);
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
    assert.equal(arquivoLogo({ type, size: 1000 }), null, type);
  assert.equal(arquivoLogo({ type: 'image/svg+xml', size: 1000 }), 'tipo');
  assert.equal(arquivoLogo({ type: 'application/pdf', size: 1000 }), 'tipo');
  assert.equal(arquivoLogo({ type: 'image/heic', size: 1000 }), 'tipo');
  assert.equal(arquivoLogo({ type: 'image/png', size: 5 * 1024 * 1024 }), null);
  assert.equal(arquivoLogo({ type: 'image/png', size: 5 * 1024 * 1024 + 1 }), 'tamanho');
  assert.equal(arquivoLogo({ type: 'image/png', size: 0 }), 'tamanho');
});

test('CT-KAN-273-07: corta o quadrado do meio (retrato e paisagem)', () => {
  assert.deepEqual(recorteQuadrado(800, 600), { x: 100, y: 0, lado: 600 });
  assert.deepEqual(recorteQuadrado(600, 1000), { x: 0, y: 200, lado: 600 });
  assert.deepEqual(recorteQuadrado(256, 256), { x: 0, y: 0, lado: 256 });
});

test('CT-KAN-273-08: nome novo a cada troca e endereço público só para nome válido', () => {
  assert.equal(nomeLogo(1731600000000, 'image/webp'), 'logo-1731600000000.webp');
  assert.equal(nomeLogo(1731600000000.7, 'image/jpeg'), 'logo-1731600000000.jpg');
  assert.ok(nomeLogoValido('logo-1731600000000.webp'));
  assert.ok(!nomeLogoValido('logo-x.webp'));
  assert.ok(!nomeLogoValido('../logo-1731600000000.webp'));
  assert.equal(
    enderecoLogo('b.firebasestorage.app', 'g 1', 'logo-1731600000000.webp'),
    'https://firebasestorage.googleapis.com/v0/b/b.firebasestorage.app/o/grupos%2Fg%201%2Flogo-1731600000000.webp?alt=media'
  );
  assert.equal(enderecoLogo('b', 'g1', 'javascript:alert(1)'), '');
  assert.equal(enderecoLogo('', 'g1', 'logo-1731600000000.webp'), '');
});
