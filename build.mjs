/* Monta o site na pasta dist/: junta os módulos de src/ num único index.html (CSS e código embutidos)
   e copia os arquivos fixos de site/ (service worker, manifesto e ícones).
   Uso: npm run build */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = 'dist';
const LEGIVEL = 'montagem-legivel'; // cópia sem compactar, para os agentes (vai para app/index.html no projeto)
const t0 = Date.now();
/* Versão do app: vem do VERSION do site/sw.js (fonte única) e aparece nas telas (pelada-v19). */
const VERSAO = (/VERSION\s*=\s*'([^']+)'/.exec(fs.readFileSync('site/sw.js', 'utf8')) || [])[1];
if (!VERSAO) throw new Error('Não achei o VERSION em site/sw.js.');
const montar = minify => esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  outdir: OUT,
  write: false,
  /* Publicado compactado (KAN-105); a cópia legível sai em montagem-legivel/ para os agentes de Segurança e UX. */
  minify,
  sourcemap: minify ? 'linked' : false, // mapa de origem (main.js.map) para depurar o código compactado
  define: { __VERSAO__: JSON.stringify(VERSAO) },
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
/* Endereço oficial do app desde a pelada-v24: Firebase Hosting (decisão D15 em docs/ARQUITETURA.md).
   O Netlify (nossosjogos.netlify.app) deixou de ser a hospedagem. Se ele voltar a publicar a main
   (produção), publica só um site de mudança de endereço: a página manda para o endereço novo,
   mantendo o link (#/p/...), e o service worker antigo se desliga sozinho nos celulares. */
const ENDERECO = 'https://nosso-jogo-f4762.web.app';
if (process.env.NETLIFY === 'true' && process.env.CONTEXT === 'production') {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Nosso Jogo mudou de endereço</title>
<script>location.replace(${JSON.stringify(ENDERECO + '/')} + location.search + location.hash);</script>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:32px 16px;background:#F4F6F2;color:#16241C;text-align:center}a{color:#1F5A40;font-weight:700}</style>
</head><body><h1>O Nosso Jogo mudou de endereço</h1><p>Abrindo o endereço novo… Se não abrir, toque aqui:</p>
<p><a id="ir" href="${ENDERECO}/">${ENDERECO.replace('https://', '')}</a></p>
<script>document.getElementById('ir').href=${JSON.stringify(ENDERECO + '/')}+location.search+location.hash;</script></body></html>
`);
  /* Service worker de despedida: substitui o antigo, apaga o cache, se desliga e recarrega as abas (que vão para o endereço novo). */
  fs.writeFileSync(path.join(OUT, 'sw.js'), `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));
`);
  console.log('Netlify (produção): publicado só o aviso de mudança para ' + ENDERECO);
  process.exit(0);
}
let modelo = fs.readFileSync('site/index.html', 'utf8');
/* Prévias de proposta (CONTEXT=deploy-preview, canal de prévia do Firebase Hosting) rodam em modo demonstração:
   não tocam nos dados reais e não dependem da chave do App Check, que só vale no domínio oficial (KAN-88). */
if (process.env.CONTEXT === 'deploy-preview') {
  const n0 = modelo.length;
  modelo = modelo.replace(/window\.FIREBASE_CONFIG\s*=\s*\{[\s\S]*?\};/, 'window.FIREBASE_CONFIG = {};');
  if (modelo.length === n0) throw new Error('Não achei window.FIREBASE_CONFIG para a prévia.');
  modelo = modelo.replace(/(<div id="demo"[^>]*>)[^<]*(<\/div>)/, '$1Prévia da proposta em modo demonstração: nada aqui mexe nos dados reais do grupo.$2');
  console.log('Prévia: modo demonstração (sem dados reais).');
}
for (const mark of ['<!--ESTILOS-->', '<!--CODIGO-->']) if (!modelo.includes(mark)) throw new Error('Marcador ausente em site/index.html: ' + mark);
function pagina(r) {
  const pick = ext => r.outputFiles.find(f => f.path.endsWith(ext)).text;
  const js = pick('.js'), css = pick('.css');
  if (/<\/script/i.test(js)) throw new Error('O código contém "</script": não pode ser embutido no HTML.');
  return modelo.replace('<!--ESTILOS-->', () => '<style>\n' + css + '</style>').replace('<!--CODIGO-->', () => '<script>\n' + js + '</script>');
}
const [rMin, rLeg] = await Promise.all([montar(true), montar(false)]);
const html = pagina(rMin), legivel = pagina(rLeg);
const mapas = rMin.outputFiles.filter(f => f.path.endsWith('.map'));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
for (const m of mapas) fs.writeFileSync(path.join(OUT, path.basename(m.path)), m.text);
fs.rmSync(LEGIVEL, { recursive: true, force: true }); fs.mkdirSync(LEGIVEL, { recursive: true });
fs.writeFileSync(path.join(LEGIVEL, 'index.html'), legivel);
for (const f of ['sw.js', 'manifest.webmanifest']) fs.copyFileSync(path.join('site', f), path.join(OUT, f));
fs.cpSync('site/icons', path.join(OUT, 'icons'), { recursive: true });

/* Portal do Nosso Jogo (KAN-116): site separado, só para a administração. Vai para dist-portal/
   e é publicado em outro endereço do Firebase Hosting. Usa a mesma configuração do Firebase do app. */
const PORTAL = 'dist-portal';
{
  const cfgBloco = /<script>\s*window\.FIREBASE_CONFIG[\s\S]*?<\/script>/.exec(fs.readFileSync('site/index.html', 'utf8'));
  if (!cfgBloco) throw new Error('Não achei a configuração do Firebase em site/index.html para o portal.');
  let mp = fs.readFileSync('site/portal.html', 'utf8').replace('<!--CONFIG-->', () => cfgBloco[0]);
  const rp = await esbuild.build({ entryPoints: ['src/portal/main.js'], bundle: true, format: 'iife', target: ['es2020'], outdir: PORTAL, write: false,
    minify: true, legalComments: 'none', charset: 'utf8', logLevel: 'warning', define: { __VERSAO__: JSON.stringify(VERSAO) },
    jsx: 'automatic', jsxImportSource: 'preact', alias: process.env.PREACT_SRC ? { 'preact/jsx-runtime': process.env.PREACT_SRC + '/jsx-runtime/src/index.js', 'preact/hooks': process.env.PREACT_SRC + '/hooks/src/index.js', 'preact': process.env.PREACT_SRC + '/src/index.js' } : {} });
  const js = rp.outputFiles.find(f => f.path.endsWith('.js')).text, css = rp.outputFiles.find(f => f.path.endsWith('.css')).text;
  if (/<\/script/i.test(js)) throw new Error('O código do portal contém "</script".');
  mp = mp.replace('<!--ESTILOS-->', () => '<style>\n' + css + '</style>').replace('<!--CODIGO-->', () => '<script>\n' + js + '</script>');
  fs.rmSync(PORTAL, { recursive: true, force: true }); fs.mkdirSync(path.join(PORTAL, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(PORTAL, 'index.html'), mp);
  fs.copyFileSync('site/icons/favicon-32.png', path.join(PORTAL, 'icons', 'favicon-32.png'));
  console.log(`Portal montado em ${PORTAL}/ (${(Buffer.byteLength(mp) / 1024).toFixed(1)} KB)`);
}

const kb = n => (n / 1024).toFixed(1) + ' KB';
const gz = zlib.gzipSync(html, { level: 9 }).length;
const gzLeg = zlib.gzipSync(legivel, { level: 9 }).length;
console.log(`Site ${VERSAO} montado em ${OUT}/ em ${Date.now() - t0} ms · index.html ${kb(Buffer.byteLength(html))} (${kb(gz)} comprimido; sem compactar seria ${kb(gzLeg)}) · cópia legível em ${LEGIVEL}/`);

/* Painel da dívida técnica (docs/ARQUITETURA.md, D12): números que devem melhorar a cada versão. */
const arquivos = [];
(function varre(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const c = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== 'portal') varre(c) } else if (/\.(js|ts|tsx)$/.test(f.name)) arquivos.push(c); } })('src');
const emTS = arquivos.filter(f => /\.tsx?$/.test(f)).length;
const telas = arquivos.filter(f => f.includes(path.join('src', 'telas')) && !f.endsWith('publico-rodada.js'));
const telasComp = telas.filter(f => f.endsWith('.tsx')).length;
const innerHTML = arquivos.reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/innerHTML/g) || []).length, 0);
// Conta só as 5 regras previstas na D12 (outros testes de regra são bem-vindos, mas não entram nesta conta).
const REGRAS = /^(sorteio|ranking|caixa|rodadas-fixas|votacao)\.test\./;
const testesRegra = fs.existsSync('testes/regras') ? fs.readdirSync('testes/regras').filter(f => REGRAS.test(f)).length : 0;
console.log(`Dívida técnica: ${emTS} de ${arquivos.length} arquivos em TypeScript · ${telasComp} de ${telas.length} telas como componente · innerHTML em ${innerHTML} pontos · ${testesRegra} de 5 regras de negócio com teste próprio`);

/* Orçamento de desempenho (docs/ARQUITETURA.md, D7): até 80 KB comprimido, sem contar a biblioteca do Firebase. */
const LIMITE = 80 * 1024;
if (gz > LIMITE) { console.error(`Passou do orçamento de desempenho: ${kb(gz)} comprimido (limite ${kb(LIMITE)}).`); process.exit(1); }
