/* Monta as funções do servidor (KAN-242): junta funcoes/src e as regras de src/dominio num arquivo só,
   funcoes/lib/index.js. A biblioteca do Firebase fica de fora (instalada pelo package.json das funções).
   Roda com: node funcoes/montar.mjs */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('.', import.meta.url));
await build({
  entryPoints: [raiz + 'src/index.ts'],
  outfile: raiz + 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['firebase-functions', 'firebase-functions/*', 'firebase-admin', 'firebase-admin/*'],
  legalComments: 'none',
  logLevel: 'warning',
});
console.log('Funções montadas em funcoes/lib/index.js');
