/* Falhas no uso (KAN-239, 1ª parte, pelada-v105): o que o coletor grava (nucleo/falhas.ts) e como o portal agrupa.
   Regra pura, testada em testes/regras/falhas.test.mjs.
   - Tipos: "appcheck" (o comprovante do App Check não veio, KAN-88), "erro" (erro de código) e "gravacao" (o Firebase
     recusou uma gravação). Desde a pelada-v116 (KAN-242), o servidor também grava "aviso" (falha dos avisos no celular:
     envio recusado, erro na função ou teto do mês), com "servidor" no lugar dos dados de navegação.
   - Dados de navegação, sem nada pessoal: navegador e versão, sistema e versão, tipo de aparelho, se o app está
     instalado, idioma, versão do app e tela. Nunca nome, e-mail, telefone, IP, notas ou caixa.
   - No máximo 20 registros por aparelho por dia; a mesma falha na mesma visita vira um registro só, com a contagem. */
export type Tipo = 'appcheck' | 'erro' | 'gravacao';
export const TIPOS: Tipo[] = ['appcheck', 'erro', 'gravacao'];
export const MAX_DIA = 20;
export type Navegacao = { nav: string; so: string; disp: 'celular' | 'tablet' | 'computador' };

const ver = (ua: string, re: RegExp) => {
  const m = ua.match(re);
  return m ? m[1]!.split(/[._]/)[0] : '';
};
const junto = (nome: string, v: string) => (v ? nome + ' ' + v : nome);

/* Navegador, sistema e tipo de aparelho a partir do "user agent" (só o nome e a versão principal). */
export function navegacao(ua: string, toque = false): Navegacao {
  const u = ua || '';
  const ipad = /iPad/.test(u) || (/Macintosh/.test(u) && toque);
  const so = /iPhone|iPod/.test(u)
    ? junto('iOS', ver(u, /OS (\d+)[_.]/))
    : ipad
      ? junto('iPadOS', ver(u, /OS (\d+)[_.]/) || ver(u, /Version\/(\d+)/))
      : /Android/.test(u)
        ? junto('Android', ver(u, /Android (\d+)/))
        : /Windows/.test(u)
          ? 'Windows'
          : /CrOS/.test(u)
            ? 'ChromeOS'
            : /Mac OS X|Macintosh/.test(u)
              ? 'macOS'
              : /Linux/.test(u)
                ? 'Linux'
                : 'outro';
  const nav = /Instagram/.test(u)
    ? 'Instagram'
    : /FBAN|FBAV/.test(u)
      ? 'Facebook'
      : /WhatsApp/.test(u)
        ? 'WhatsApp'
        : /SamsungBrowser\//.test(u)
          ? junto(['Samsung', 'Internet'].join(' '), ver(u, /SamsungBrowser\/(\d+)/))
          : /Edg(A|iOS)?\//.test(u)
            ? junto('Edge', ver(u, /Edg(?:A|iOS)?\/(\d+)/))
            : /OPR\/|Opera/.test(u)
              ? junto('Opera', ver(u, /OPR\/(\d+)/))
              : /Firefox\/|FxiOS\//.test(u)
                ? junto('Firefox', ver(u, /(?:Firefox|FxiOS)\/(\d+)/))
                : /CriOS\//.test(u)
                  ? junto('Chrome', ver(u, /CriOS\/(\d+)/))
                  : /Chrome\//.test(u)
                    ? junto(/; wv\)/.test(u) ? 'Chrome (app)' : 'Chrome', ver(u, /Chrome\/(\d+)/))
                    : /Safari\//.test(u)
                      ? junto('Safari', ver(u, /Version\/(\d+)/))
                      : /iPhone|iPad/.test(u)
                        ? 'Safari (app)'
                        : 'outro';
  const disp =
    ipad || (/Android/.test(u) && !/Mobile/.test(u))
      ? 'tablet'
      : /Mobi|iPhone|Android/.test(u)
        ? 'celular'
        : 'computador';
  return { nav: nav.slice(0, 60), so: so.slice(0, 40), disp };
}

/* Mensagem e pilha curtas, sem quebras: cabe nas regras do Firebase (300 e 1.500 letras). */
export const corta = (s: unknown, n: number) =>
  String(s == null ? '' : s)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);

/* Erros que não são do app: extensões do navegador, scripts de fora e avisos inofensivos. */
export function ignorar(m: string, arquivo = ''): boolean {
  return (
    /^Script error\.?$/i.test(m) ||
    /ResizeObserver loop/i.test(m) ||
    /(chrome|moz|safari(-web)?)-extension:/.test(arquivo) ||
    !m
  );
}

/* Limite do dia por aparelho: devolve se pode gravar e o novo estado (guardado no aparelho). */
export function cabeNoDia(estado: { d?: string; n?: number } | null, hoje: string, max = MAX_DIA) {
  const n = estado && estado.d === hoje ? estado.n || 0 : 0;
  return n < max ? { pode: true, estado: { d: hoje, n: n + 1 } } : { pode: false, estado: { d: hoje, n } };
}

export type Registro = {
  v?: string;
  t?: string;
  m?: string;
  r?: string;
  nav?: string;
  so?: string;
  disp?: string;
  inst?: boolean;
  n?: number;
  em?: number | null;
};
export type Grupo = {
  t: string;
  m: string;
  n: number;
  registros: number;
  versoes: string[];
  primeira: number | null;
  ultima: number | null;
  navs: [string, number][];
  telas: string[];
};

/* Portal: falhas agrupadas por tipo e mensagem, da que mais aconteceu para a que menos aconteceu. */
export function agrupar(regs: Record<string, Registro | null | undefined>): Grupo[] {
  const g = new Map<string, Grupo & { _navs: Map<string, number>; _v: Set<string>; _t: Set<string> }>();
  for (const x of Object.values(regs || {})) {
    if (!x || !x.t) continue;
    const k = x.t + '\u0000' + (x.m || ''),
      n = Math.max(1, x.n || 1);
    let a = g.get(k);
    if (!a) {
      a = {
        t: x.t,
        m: x.m || '',
        n: 0,
        registros: 0,
        versoes: [],
        primeira: null,
        ultima: null,
        navs: [],
        telas: [],
        _navs: new Map(),
        _v: new Set(),
        _t: new Set(),
      };
      g.set(k, a);
    }
    a.n += n;
    a.registros++;
    if (x.v) a._v.add(x.v);
    if (x.r) a._t.add(x.r);
    const nav = [x.nav, x.so, x.disp, x.inst ? 'instalado' : ''].filter(Boolean).join(' · ') || 'desconhecido';
    a._navs.set(nav, (a._navs.get(nav) || 0) + n);
    if (typeof x.em === 'number') {
      a.primeira = a.primeira == null ? x.em : Math.min(a.primeira, x.em);
      a.ultima = a.ultima == null ? x.em : Math.max(a.ultima, x.em);
    }
  }
  return [...g.values()]
    .map(({ _navs, _v, _t, ...a }) => ({
      ...a,
      versoes: [..._v].sort(),
      telas: [..._t].sort(),
      navs: [..._navs.entries()].sort((x, y) => y[1] - x[1]),
    }))
    .sort((x, y) => y.n - x.n || (y.ultima || 0) - (x.ultima || 0));
}

/* O registro que vai para falhas/{id}, montado na primeira falha (nucleo/falhas.ts). Erro que não é do app: nada. */
export function registro(
  t: Tipo,
  mensagem: string,
  pilha: unknown,
  n: number,
  ctx: { v: string; r: string; g?: string | null; hoje: string },
  agora: unknown
): Record<string, unknown> | null {
  const m = corta(mensagem, 300) || '?',
    p = corta(pilha, 1500);
  if (t === 'erro' && ignorar(m, p)) return null;
  const nv = navegacao(navigator.userAgent, (navigator.maxTouchPoints || 0) > 1);
  const inst =
    !!(typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
    !!(navigator as { standalone?: boolean }).standalone;
  const o: Record<string, unknown> = {
    v: corta(ctx.v, 20),
    t,
    m,
    r: corta(ctx.r, 20),
    ...nv,
    inst,
    lang: corta(navigator.language, 12),
    n: Math.max(1, Math.min(n, 1000)),
    em: agora,
    d: ctx.hoje,
  };
  if (p) o.p = p;
  if (ctx.g) o.g = corta(ctx.g, 64);
  return o;
}

/* O limite do dia, guardado no aparelho (sem armazenamento, grava assim mesmo). */
export function cabeNoAparelho(hoje: string): boolean {
  try {
    const r = cabeNoDia(JSON.parse(localStorage.getItem('nj-falhas-dia') || 'null'), hoje);
    localStorage.setItem('nj-falhas-dia', JSON.stringify(r.estado));
    return r.pode;
  } catch {
    return true;
  }
}
