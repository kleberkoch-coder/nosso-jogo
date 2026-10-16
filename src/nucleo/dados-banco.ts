/* Lista dentro de lista no banco (KAN-167). O Firestore recusa gravar uma lista que tem outra lista dentro
   ("Nested arrays are not supported"), e o app guarda duas assim: as posições criadas pelo grupo (posx: [[sigla, nome]])
   e os pares que não jogam juntos (sep: [[a, b]]). Antes, a gravação falhava e a posição sumia ao recarregar.
   Na gravação, cada lista interna vira { __lista: [...] }; na leitura, volta a ser lista. O resto do app não muda.
   O modo demonstração passa pelo mesmo caminho e recusa o que o Firestore recusaria (testes/regras/dados-banco.test.mjs). */

const { isArray } = Array;
const simples = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

/* Para gravar: lista dentro de lista vira { __lista: [...] }, em qualquer nível. */
export function paraBanco(v: unknown, dentroDeLista = false): unknown {
  if (isArray(v)) {
    const lista = v.map(x => paraBanco(x, true));
    return dentroDeLista ? { __lista: lista } : lista;
  }
  if (simples(v)) {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v)) o[k] = paraBanco(v[k]);
    return o;
  }
  return v;
}

/* Ao ler: { __lista: [...] } volta a ser lista. Dado gravado do jeito antigo passa igual. */
export function doBanco(v: unknown): unknown {
  if (isArray(v)) return v.map(doBanco);
  if (simples(v)) {
    const ks = Object.keys(v);
    if (ks.length === 1 && ks[0] === '__lista' && isArray(v.__lista)) return v.__lista.map(doBanco);
    const o: Record<string, unknown> = {};
    for (const k of ks) o[k] = doBanco(v[k]);
    return o;
  }
  return v;
}

/* O que o Firestore recusa: alguma lista com outra lista diretamente dentro. */
export function temListaDentroDeLista(v: unknown): boolean {
  if (isArray(v)) return v.some(x => isArray(x) || temListaDentroDeLista(x));
  if (simples(v)) return Object.keys(v).some(k => temListaDentroDeLista(v[k]));
  return false;
}
