/* Textos da tela por idioma.
   tx('chave') devolve o texto do idioma atual; tx('chave', {nome: 'Ana'}) troca {nome} no texto.
   tp('chave', n) escolhe a forma de singular ou plural (chave.um / chave.outros) e troca {n}.
   tc('Goleiro') traduz um nome do catálogo (esportes, cores, planos), que no código fica em português.
   O português vem embutido; os outros idiomas (KAN-164: inglês e espanhol) chegam depois, em pedaços sob demanda
   (src/i18n/idiomas.ts). Sem a tradução de uma chave, vale o português.
   Valores vindos do banco devem ser passados já escapados (esc) quando forem para HTML. */
import ptBR from './pt-BR.js';
import { LOCAL } from './formatos.js';

const DIC = { 'pt-BR': ptBR };
/* Chaves sem tradução no idioma escolhido, para os testes conferirem (CT-KAN-164-01). */
const semTraducao = new Set();

function tx(chave, vars) {
  const d = DIC[LOCAL];
  let s = d && d[chave];
  if (s == null) {
    s = ptBR[chave];
    if (LOCAL !== 'pt-BR' && s != null) semTraducao.add(chave);
  }
  if (s == null) {
    console.warn('Texto sem tradução:', chave);
    s = chave;
  }
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s;
}
/* Nome do catálogo no idioma atual (o próprio nome, em português ou se não houver tradução). */
function tc(nome) {
  const d = DIC[LOCAL];
  return (d && d['cat.' + nome]) || nome;
}
/* Textos que chegam depois (ex.: os da gestão, com src/admin.js). Sem trocar os que já existem. */
function juntarTextos(textos) {
  for (const [k, v] of Object.entries(textos)) if (!(k in ptBR)) ptBR[k] = v;
}
/* Tradução que chegou (um pedaço de um idioma). */
function juntarIdioma(id, textos) {
  DIC[id] = Object.assign(DIC[id] || {}, textos);
}
const tp = (chave, n, vars) => tx(chave + (n === 1 ? '.um' : '.outros'), Object.assign({ n }, vars));
if (typeof window !== 'undefined') window.__njSemTraducao = () => [...semTraducao];

export { juntarIdioma, juntarTextos, tc, tx, tp };
