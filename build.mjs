/* Monta o site na pasta dist/: junta os módulos de src/ num único index.html (CSS e código embutidos)
   e copia os arquivos fixos de site/ (service worker, manifesto e ícones).
   Uso: npm run build */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = 'dist';
const t0 = Date.now();
const r = await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  outdir: OUT,
  write: false,
  minify: false,          // código legível no index.html: os agentes de Segurança e UX leem este arquivo
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'warning',
  // Componentes em TypeScript + Preact (arquivos .tsx): JSX vira chamadas do Preact.
  jsx: 'automatic',
  jsxImportSource: 'preact',
  // Só para montar sem acesso ao npm: PREACT_SRC aponta para o código-fonte do Preact (mesma versão do package.json).
  alias: process.env.PREACT_SRC ? {
    'preact/jsx-runtime': process.env.PREACT_SRC + '/jsx-runtime/src/index.js',
    'preact/hooks': process.env.PREACT_SRC + '/hooks/src/index.js',
    'preact': process.env.PREACT_SRC + '/src/index.js',
  } : {},
});
const pick = ext => r.outputFiles.find(f => f.path.endsWith(ext)).text;
const js = pick('.js'), css = pick('.css');
if (/<\/script/i.test(js)) throw new Error('O código contém "</script": não pode ser embutido no HTML.');

let html = fs.readFileSync('site/index.html', 'utf8');
for (const mark of ['<!--ESTILOS-->', '<!--CODIGO-->']) if (!html.includes(mark)) throw new Error('Marcador ausente em site/index.html: ' + mark);
html = html.replace('<!--ESTILOS-->', () => '<style>\n' + css + '</style>')
           .replace('<!--CODIGO-->', () => '<script>\n' + js + '</script>');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
for (const f of ['sw.js', 'manifest.webmanifest']) fs.copyFileSync(path.join('site', f), path.join(OUT, f));
fs.cpSync('site/icons', path.join(OUT, 'icons'), { recursive: true });

const kb = n => (n / 1024).toFixed(1) + ' KB';
const gz = zlib.gzipSync(html, { level: 9 }).length;
console.log(`Site montado em ${OUT}/ em ${Date.now() - t0} ms · index.html ${kb(Buffer.byteLength(html))} (${kb(gz)} comprimido)`);

/* Painel da dívida técnica (docs/ARQUITETURA.md, D12): números que devem melhorar a cada versão. */
const arquivos = [];
(function varre(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const c = path.join(d, f.name); if (f.isDirectory()) varre(c); else if (/\.(js|ts|tsx)$/.test(f.name)) arquivos.push(c); } })('src');
const emTS = arquivos.filter(f => /\.tsx?$/.test(f)).length;
const telas = arquivos.filter(f => f.includes(path.join('src', 'telas')) && !f.endsWith('publico-rodada.js'));
const telasComp = telas.filter(f => f.endsWith('.tsx')).length;
const innerHTML = arquivos.reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/innerHTML/g) || []).length, 0);
const testesRegra = fs.existsSync('testes/regras') ? fs.readdirSync('testes/regras').filter(f => /\.test\./.test(f)).length : 0;
console.log(`Dívida técnica: ${emTS} de ${arquivos.length} arquivos em TypeScript · ${telasComp} de ${telas.length} telas como componente · innerHTML em ${innerHTML} pontos · ${testesRegra} de 5 regras de negócio com teste próprio`);

/* Orçamento de desempenho (docs/ARQUITETURA.md, D7): até 80 KB comprimido, sem contar a biblioteca do Firebase. */
const LIMITE = 80 * 1024;
if (gz > LIMITE) { console.error(`Passou do orçamento de desempenho: ${kb(gz)} comprimido (limite ${kb(LIMITE)}).`); process.exit(1); }
