/* Textos da tela por idioma.
   tx('chave') devolve o texto do idioma atual; tx('chave', {nome: 'Ana'}) troca {nome} no texto.
   tp('chave', n) escolhe a forma de singular ou plural (chave.um / chave.outros) e troca {n}.
   Valores vindos do banco devem ser passados já escapados (esc) quando forem para HTML. */
import ptBR from './pt-BR.js';
import { LOCAL } from './formatos.js';

const DIC = { 'pt-BR': ptBR };

function tx(chave, vars) {
  const d = DIC[LOCAL] || ptBR;
  let s = d[chave] ?? ptBR[chave];
  if (s == null) { console.warn('Texto sem tradução:', chave); s = chave; }
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s;
}
const tp = (chave, n, vars) => tx(chave + (n === 1 ? '.um' : '.outros'), Object.assign({ n }, vars));

export { tx, tp };
