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
/* Publicado (minify): módulos com divisão de código (KAN-149). O ponto de partida vai embutido no index.html;
   o código comum vai em chunks/ e a parte de gestão (src/admin.js) só baixa quando alguém entra com conta.
   Os nomes levam um código do conteúdo: versão nova = arquivo novo, sem misturar com cópia antiga guardada no celular.
   Cópia legível: um arquivo só, para os agentes lerem. */
const montar = minify =>
  esbuild.build({
    entryPoints: ['src/main.js'],
    bundle: true,
    format: minify ? 'esm' : 'iife',
    splitting: minify,
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
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
    alias: process.env.PREACT_SRC
      ? {
          'preact/jsx-runtime': process.env.PREACT_SRC + '/jsx-runtime/src/index.js',
          'preact/hooks': process.env.PREACT_SRC + '/hooks/src/index.js',
          preact: process.env.PREACT_SRC + '/src/index.js',
        }
      : {},
  });
let modelo = fs.readFileSync('site/index.html', 'utf8');
/* Prévias de proposta (CONTEXT=deploy-preview, canal de prévia do Firebase Hosting) rodam em modo demonstração:
   não tocam nos dados reais e não dependem da chave do App Check, que só vale no domínio oficial (KAN-88). */
if (process.env.CONTEXT === 'deploy-preview') {
  const n0 = modelo.length;
  modelo = modelo.replace(/window\.FIREBASE_CONFIG\s*=\s*\{[\s\S]*?\};/, 'window.FIREBASE_CONFIG = {};');
  if (modelo.length === n0) throw new Error('Não achei window.FIREBASE_CONFIG para a prévia.');
  modelo = modelo.replace(
    /(<div id="demo"[^>]*>)[^<]*(<\/div>)/,
    '$1Prévia da proposta em modo demonstração: nada aqui mexe nos dados reais do grupo.$2'
  );
  console.log('Prévia: modo demonstração (sem dados reais).');
}
for (const mark of ['<!--ESTILOS-->', '<!--CODIGO-->'])
  if (!modelo.includes(mark)) throw new Error('Marcador ausente em site/index.html: ' + mark);
const rel = f => path.relative(OUT, f.path).split(path.sep).join('/');
/* Arquivos que um módulo importa direto (não os que ele só carrega quando precisa, com import()). */
const importsDiretos = txt => [...txt.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)].map(m => m[1]);
function pagina(r, modulos) {
  const pick = ext => r.outputFiles.find(f => rel(f) === 'main' + ext).text;
  const js = pick('.js'),
    css = pick('.css');
  if (/<\/script/i.test(js)) throw new Error('O código contém "</script": não pode ser embutido no HTML.');
  let pre = '';
  if (modulos) pre = modulos.map(c => `<link rel="modulepreload" href="${c}">\n`).join('');
  return modelo
    .replace('<!--ESTILOS-->', () => pre + '<style>\n' + css + '</style>')
    .replace('<!--CODIGO-->', () => '<script' + (modulos ? ' type="module"' : '') + '>\n' + js + '</script>');
}
const [rMin, rLeg] = await Promise.all([montar(true), montar(false)]);
/* Pedaços que o link público precisa logo (o que main.js importa direto, e o que eles importam) e os da gestão. */
const pedacos = new Map(rMin.outputFiles.filter(f => /^chunks\/.*\.js$/.test(rel(f))).map(f => [rel(f), f.text]));
const nucleo = [],
  fila = importsDiretos(rMin.outputFiles.find(f => rel(f) === 'main.js').text);
while (fila.length) {
  const c = fila.shift();
  if (nucleo.includes(c)) continue;
  nucleo.push(c);
  const t = pedacos.get(c);
  if (!t) throw new Error('Pedaço não encontrado: ' + c);
  importsDiretos(t).forEach(x => fila.push('chunks/' + x));
}
const gestao = [...pedacos.keys()].filter(c => !nucleo.includes(c));
const html = pagina(rMin, nucleo),
  legivel = pagina(rLeg, null);
const mapas = rMin.outputFiles.filter(f => f.path.endsWith('.map'));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'chunks'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
for (const [c, t] of pedacos) fs.writeFileSync(path.join(OUT, c), t);
for (const m of mapas) fs.writeFileSync(path.join(OUT, rel(m)), m.text);
fs.rmSync(LEGIVEL, { recursive: true, force: true });
fs.mkdirSync(LEGIVEL, { recursive: true });
fs.writeFileSync(path.join(LEGIVEL, 'index.html'), legivel);
/* O service worker recebe a lista dos pedaços: os do link público são guardados na instalação; os da gestão,
   só nos aparelhos que já usaram a gestão (o celular do jogador não baixa o que não usa). */
{
  let sw = fs.readFileSync('site/sw.js', 'utf8');
  for (const [nome, lista] of [
    ['CHUNKS', nucleo],
    ['GESTAO', gestao],
  ]) {
    const n0 = sw.length;
    sw = sw.replace(`const ${nome} = [];`, `const ${nome} = ${JSON.stringify(lista.map(c => './' + c))};`);
    if (sw.length === n0) throw new Error(`Não achei "const ${nome} = [];" em site/sw.js.`);
  }
  fs.writeFileSync(path.join(OUT, 'sw.js'), sw);
}
fs.copyFileSync(path.join('site', 'manifest.webmanifest'), path.join(OUT, 'manifest.webmanifest'));
fs.cpSync('site/icons', path.join(OUT, 'icons'), { recursive: true });

/* Portal do Nosso Jogo (KAN-116): site separado, só para a administração. Vai para dist-portal/
   e é publicado em outro endereço do Firebase Hosting. Usa a mesma configuração do Firebase do app. */
const PORTAL = 'dist-portal';
{
  const cfgBloco = /<script>\s*window\.FIREBASE_CONFIG[\s\S]*?<\/script>/.exec(
    fs.readFileSync('site/index.html', 'utf8')
  );
  if (!cfgBloco) throw new Error('Não achei a configuração do Firebase em site/index.html para o portal.');
  let mp = fs.readFileSync('site/portal.html', 'utf8').replace('<!--CONFIG-->', () => cfgBloco[0]);
  const rp = await esbuild.build({
    entryPoints: ['src/portal/main.js'],
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    outdir: PORTAL,
    write: false,
    minify: true,
    legalComments: 'none',
    charset: 'utf8',
    logLevel: 'warning',
    define: { __VERSAO__: JSON.stringify(VERSAO) },
    jsx: 'automatic',
    jsxImportSource: 'preact',
    alias: process.env.PREACT_SRC
      ? {
          'preact/jsx-runtime': process.env.PREACT_SRC + '/jsx-runtime/src/index.js',
          'preact/hooks': process.env.PREACT_SRC + '/hooks/src/index.js',
          preact: process.env.PREACT_SRC + '/src/index.js',
        }
      : {},
  });
  const js = rp.outputFiles.find(f => f.path.endsWith('.js')).text,
    css = rp.outputFiles.find(f => f.path.endsWith('.css')).text;
  if (/<\/script/i.test(js)) throw new Error('O código do portal contém "</script".');
  mp = mp
    .replace('<!--ESTILOS-->', () => '<style>\n' + css + '</style>')
    .replace('<!--CODIGO-->', () => '<script>\n' + js + '</script>');
  fs.rmSync(PORTAL, { recursive: true, force: true });
  fs.mkdirSync(path.join(PORTAL, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(PORTAL, 'index.html'), mp);
  fs.copyFileSync('site/icons/favicon-32.png', path.join(PORTAL, 'icons', 'favicon-32.png'));
  console.log(`Portal montado em ${PORTAL}/ (${(Buffer.byteLength(mp) / 1024).toFixed(1)} KB)`);
}

const kb = n => (n / 1024).toFixed(1) + ' KB';
const z = t => zlib.gzipSync(t, { level: 9 }).length;
const gzPub = z(html) + nucleo.reduce((n, c) => n + z(pedacos.get(c)), 0);
const gzGest = gestao.reduce((n, c) => n + z(pedacos.get(c)), 0);
const gz = gzPub + gzGest;
const gzLeg = z(legivel);
console.log(
  `Site ${VERSAO} montado em ${OUT}/ em ${Date.now() - t0} ms · link do jogador ${kb(gzPub)} comprimido · com a gestão ${kb(gz)} (sem compactar seria ${kb(gzLeg)}) · ${pedacos.size} pedaços · cópia legível em ${LEGIVEL}/`
);

/* Painel da dívida técnica (docs/ARQUITETURA.md, D12): números que devem melhorar a cada versão. */
const arquivos = [];
(function varre(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const c = path.join(d, f.name);
    if (f.isDirectory()) {
      if (f.name !== 'portal') varre(c);
    } else if (/\.(js|ts|tsx)$/.test(f.name)) arquivos.push(c);
  }
})('src');
const emTS = arquivos.filter(f => /\.tsx?$/.test(f)).length;
const telas = arquivos.filter(
  f => f.includes(path.join('src', 'telas')) && !f.endsWith('publico-rodada.js') && !f.endsWith('-partes.js')
);
const telasComp = telas.filter(f => f.endsWith('.tsx')).length;
const innerHTML = arquivos.reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/innerHTML/g) || []).length, 0);
// Conta só as 5 regras previstas na D12 (outros testes de regra são bem-vindos, mas não entram nesta conta).
const REGRAS = /^(sorteio|ranking|caixa|rodadas-fixas|votacao)\.test\./;
const testesRegra = fs.existsSync('testes/regras')
  ? fs.readdirSync('testes/regras').filter(f => REGRAS.test(f)).length
  : 0;
/* Textos de tela escritos direto no código, fora do dicionário (D3). Conta frases que começam com maiúscula
   dentro de textos e HTML, sem os comentários. É uma medida aproximada, mas sempre igual: serve para ver se sobe ou desce. */
const RX_TEXTO = /(?<=['"`]|>\s*|\$\{[^}]*\}\s?)([A-ZÁÉÍÓÚÂÊÔÃÕ][a-zà-úç]+(?:[ ,.:?!][ ]?[A-Za-zà-úçÁÉÍÓÚ]+){1,})/g;
const semComentario = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const textosFixos = arquivos
  .filter(f => !f.includes(path.join('src', 'i18n')))
  .reduce((n, f) => n + (semComentario(fs.readFileSync(f, 'utf8')).match(RX_TEXTO) || []).length, 0);
console.log(
  `Dívida técnica: ${emTS} de ${arquivos.length} arquivos em TypeScript · ${telasComp} de ${telas.length} telas como componente · innerHTML em ${innerHTML} pontos · ${textosFixos} textos fora do dicionário · ${testesRegra} de 5 regras de negócio com teste próprio`
);

/* KAN-154: a dívida não pode piorar (D12). Os tetos ficam em docs/divida.json; quando um número melhora, o teto desce na mesma entrega. */
{
  const teto = JSON.parse(fs.readFileSync('docs/divida.json', 'utf8'));
  const medidas = [
    ['innerHTML', innerHTML, 'pontos com innerHTML (monte a tela como componente; ver docs/DESIGN-SYSTEM.md)', 'max'],
    ['textosFixos', textosFixos, 'textos de tela fora do dicionário (use tx() e src/i18n/pt-BR.js)', 'max'],
    ['arquivosSemTipos', arquivos.length - emTS, 'arquivos sem TypeScript (arquivo novo nasce .ts ou .tsx)', 'max'],
    ['telasComponente', telasComp, 'telas como componente', 'min'],
    ['testesRegra', testesRegra, 'regras de negócio com teste próprio', 'min'],
  ];
  const piorou = medidas.filter(([k, v, , t]) => (t === 'max' ? v > teto[k] : v < teto[k]));
  for (const [k, v, txt, t] of piorou)
    console.error(
      `A dívida técnica piorou: ${v} ${txt}; o limite é ${teto[k]} (${t === 'max' ? 'máximo' : 'mínimo'}, docs/divida.json).`
    );
  const melhorou = medidas.filter(([k, v, , t]) => (t === 'max' ? v < teto[k] : v > teto[k]));
  if (melhorou.length)
    console.log(
      'Melhorou: ' +
        melhorou.map(([k, v]) => `${k} ${teto[k]} → ${v}`).join(' · ') +
        '. Atualize docs/divida.json nesta entrega.'
    );
  if (piorou.length) process.exit(1);
}

/* Orçamento de desempenho (docs/ARQUITETURA.md, D7): até 80 KB comprimido, sem contar a biblioteca do Firebase. */
// KAN-149: o link do jogador (página + pedaços que ela carrega logo) tem limite próprio.
// Desde a v43 o total vai até 85 KB: a divisão em pedaços e os componentes custam um pouco no total, que só quem administra baixa (D7).
const LIMITE = 85 * 1024,
  LIMITE_LINK = 50 * 1024;
if (gz > LIMITE) {
  console.error(`Passou do orçamento de desempenho: ${kb(gz)} comprimido (limite ${kb(LIMITE)}).`);
  process.exit(1);
}
if (gzPub > LIMITE_LINK) {
  console.error(`O link do jogador passou do orçamento: ${kb(gzPub)} comprimido (limite ${kb(LIMITE_LINK)}).`);
  process.exit(1);
}
