/* KAN-263: pilha legível pelo mapa de origem (regra pura). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformSync } from 'esbuild';
import { arquivoCurto, original, pontosDaPilha, vlq } from '../../src/dominio/mapa-origem.ts';

test('CT-KAN-263-05: os pontos da pilha do Chrome, do Safari e do Firefox, sem repetir', () => {
  const p = pontosDaPilha(
    [
      'TypeError: x is null',
      '    at abrir (https://nosso-jogo-f4762.web.app/chunks/admin-AB12.js:1:23456)',
      '    at https://nosso-jogo-f4762.web.app/chunks/admin-AB12.js:1:23456',
      'salvar@https://nosso-jogo-f4762.web.app/chunks/chunk-ZZ.js:2:15',
    ].join('\n')
  );
  assert.deepEqual(p, [
    { url: 'https://nosso-jogo-f4762.web.app/chunks/admin-AB12.js', linha: 1, coluna: 23456 },
    { url: 'https://nosso-jogo-f4762.web.app/chunks/chunk-ZZ.js', linha: 2, coluna: 15 },
  ]);
  assert.deepEqual(pontosDaPilha(''), []);
});

test('CT-KAN-263-06: VLQ e o ponto original num código compactado de verdade (esbuild)', () => {
  assert.deepEqual(vlq('AAAA'), [0, 0, 0, 0]);
  assert.deepEqual(vlq('gBAAC'), [16, 0, 0, 1]);
  const fonte = [
    'function soma(a, b) {',
    '  return a + b;',
    '}',
    'function quebra() {',
    '  throw new Error("x");',
    '}',
    'quebra(soma(1, 2));',
  ].join('\n');
  const r = transformSync(fonte, { minify: true, sourcemap: true, sourcefile: 'src/telas/Exemplo.ts', loader: 'ts' });
  const mapa = JSON.parse(r.map);
  const lin = r.code.split('\n'),
    i = lin.findIndex(l => l.includes('throw')),
    col = lin[i].indexOf('throw') + 1;
  const o = original(mapa, i + 1, col);
  assert.equal(arquivoCurto(o.arquivo), 'src/telas/Exemplo.ts');
  assert.equal(o.linha, 5);
  assert.equal(original(mapa, 99, 1), null);
  assert.equal(arquivoCurto('../node_modules/preact/dist/preact.module.js'), 'preact/dist/preact.module.js');
});
