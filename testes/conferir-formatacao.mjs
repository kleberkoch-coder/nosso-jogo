/* Confere que a formatação não mudou o que o código faz (KAN-155).
   Compacta cada arquivo antes e depois (esbuild, sem espaços nem quebras) e compara: o resultado tem que ser igual.
   Uso: node testes/conferir-formatacao.mjs <commit-de-antes>
   Motivo: na v45, numa primeira passada, o Prettier transformou [2,3,4,5,6,7,8] em [8] dentro de um texto da janela
   do sorteio. Esta conferência pegou o erro. */
import * as esbuild from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const base = process.argv[2];
if (!base) {
  console.error('Informe o commit de antes.');
  process.exit(2);
}
const mudou = execSync(`git diff --name-only ${base} -- src build.mjs testes`, { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(f => /\.(js|ts|tsx|mjs|css)$/.test(f) && fs.existsSync(f));
const tipo = f => (f.endsWith('.tsx') ? 'tsx' : f.endsWith('.ts') ? 'ts' : f.endsWith('.css') ? 'css' : 'js');
const compacta = async (s, f) =>
  (
    await esbuild.transform(s, {
      loader: tipo(f),
      minify: true,
      jsx: 'automatic',
      jsxImportSource: 'preact',
      charset: 'utf8',
    })
  ).code;
/* No CSS, o Prettier troca #FFF por #fff e põe espaços depois de ":" e "," e em volta de "/": o navegador lê igual. */
const normaliza = (s, f) =>
  tipo(f) === 'css'
    ? s
        .toLowerCase()
        .replace(/:\s+/g, ':')
        .replace(/,\s+/g, ',')
        .replace(/\s*\/\s*/g, '/')
    : s;
const diferentes = [];
for (const f of mudou) {
  let antes;
  try {
    antes = execSync(`git show ${base}:${f}`, { encoding: 'utf8', maxBuffer: 1e8 });
  } catch {
    continue;
  }
  const a = normaliza(await compacta(antes, f), f),
    d = normaliza(await compacta(fs.readFileSync(f, 'utf8'), f), f);
  if (a !== d) diferentes.push(f);
}
if (diferentes.length) {
  console.log('A formatação mudou o código destes arquivos (confira à mão):\n' + diferentes.join('\n'));
  process.exit(1);
}
console.log(`Formatação conferida: ${mudou.length} arquivos, o código compactado ficou igual.`);
