/* KAN-154: a montagem barra a piora da dívida técnica (D12). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('docs/divida.json tem os tetos de todas as medidas', () => {
  const teto = JSON.parse(fs.readFileSync('docs/divida.json', 'utf8'));
  for (const k of ['innerHTML', 'textosFixos', 'arquivosSemTipos', 'telasComponente', 'testesRegra']) assert.equal(typeof teto[k], 'number', k);
});

test('a montagem compara cada medida com o teto e falha se piorar', () => {
  const b = fs.readFileSync('build.mjs', 'utf8');
  assert.match(b, /docs\/divida\.json/);
  assert.match(b, /A dívida técnica piorou/);
  assert.match(b, /if \(piorou\.length\) process\.exit\(1\)/);
});
