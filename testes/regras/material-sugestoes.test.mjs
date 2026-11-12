/* KAN-267: sugestões de material do catálogo dos esportes (viram atalhos na aba Grupo).
   Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fonte = fs.readFileSync('src/dominio/esportes.js', 'utf8');
const listas = [...fonte.matchAll(/\bmat:\s*\[([^\]]*)\]/g)].map(m => [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]));

test('CT-KAN-267-02: cronômetro e primeiros socorros em todos os esportes; luvas só no futebol (campo, society e futsal)', () => {
  assert.equal(listas.length, 7);
  for (const l of listas) assert.ok(l.includes('Cronômetro') && l.includes('Kit de primeiros socorros'), l.join(', '));
  /* A primeira lista é a do futebol (FUT, dividida por campo, society e futsal). */
  assert.deepEqual(listas[0], ['Bola', 'Coletes', 'Luvas', 'Cronômetro', 'Kit de primeiros socorros']);
  assert.equal(listas.filter(l => l.includes('Luvas')).length, 1);
});

test('CT-KAN-267-04: toda sugestão de material tem tradução em inglês e espanhol', () => {
  const nomes = [...new Set(listas.flat())];
  for (const id of ['en', 'es']) {
    const base = fs.readFileSync(`src/i18n/${id}/base.ts`, 'utf8');
    const faltam = nomes.filter(n => !base.includes(`'cat.${n}':`));
    assert.deepEqual(faltam, [], id + ': ' + faltam.join(', '));
  }
});
