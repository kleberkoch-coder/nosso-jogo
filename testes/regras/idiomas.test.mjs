/* Idiomas (KAN-164): inglês e espanhol têm todas as chaves do português, com os mesmos marcadores ({n}, {data}…) e as
   mesmas marcas de negrito, e o catálogo (esportes, posições, pontuação, cores e planos) tem tradução. Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DIR = 'src/i18n';
const carregar = async f => (await import(pathToFileURL(path.resolve(DIR, f)).href)).default;
const pt = {};
for (const f of fs.readdirSync(DIR).filter(f => /^pt-BR.*\.(js|ts)$/.test(f))) Object.assign(pt, await carregar(f));
const IDIOMAS = {};
for (const id of ['en', 'es'])
  IDIOMAS[id] = Object.assign({}, await carregar(id + '/base.ts'), await carregar(id + '/gestao.ts'));
const marcas = s => [...String(s).matchAll(/\{\w+\}|<\/?\w+>/g)].map(m => m[0]).sort();

for (const [id, d] of Object.entries(IDIOMAS)) {
  test(`CT-KAN-164-02: ${id} tem todas as chaves do português, nenhuma a mais`, () => {
    const faltam = Object.keys(pt).filter(k => !(k in d));
    const sobram = Object.keys(d).filter(k => !(k in pt) && !k.startsWith('cat.'));
    assert.deepEqual(faltam, [], 'faltam: ' + faltam.join(', '));
    assert.deepEqual(sobram, [], 'sobram: ' + sobram.join(', '));
  });
  test(`CT-KAN-164-02: ${id} com os mesmos marcadores e sem texto vazio`, () => {
    const erradas = Object.keys(pt).filter(k => !String(d[k] || '').trim() || marcas(d[k]).join() !== marcas(pt[k]).join());
    assert.deepEqual(erradas, []);
  });
  test(`CT-KAN-164-02: ${id} tem a parte "base" separada da "gestao" como no português do link`, async () => {
    const base = await carregar(id + '/base.ts');
    const doLink = await carregar('pt-BR.js');
    assert.deepEqual(
      Object.keys(doLink).filter(k => !(k in base)),
      [],
      'o link do jogador precisa de todas as chaves de pt-BR.js na parte base'
    );
  });
}

test('CT-KAN-164-03: catálogo (esportes, posições, pontuação, palavra do placar, cores e planos) traduzido', async () => {
  const fonte = fs.readFileSync('src/dominio/esportes.js', 'utf8');
  const nomes = new Set();
  for (const m of fonte.matchAll(/\b(?:n|word|unit|art):\s*'([^']+)'/g)) nomes.add(m[1]);
  for (const m of fonte.matchAll(/\['([^']+)',\s*(?:'([^']+)'|\d+)\]/g)) {
    if (m[2]) nomes.add(m[2]);
    else nomes.add(m[1]);
  }
  nomes.add('Pontos');
  const { PLANOS_PADRAO } = await import(pathToFileURL(path.resolve('src/dominio/planos.ts')).href);
  for (const p of Object.values(PLANOS_PADRAO)) nomes.add(p.nome);
  const semSigla = [...nomes].filter(n => !/^\+\d$/.test(n) && n !== 'Nosso Jogo');
  for (const [id, d] of Object.entries(IDIOMAS)) {
    const faltam = semSigla.filter(n => !d['cat.' + n]);
    assert.deepEqual(faltam, [], id + ': ' + faltam.join(', '));
  }
});
