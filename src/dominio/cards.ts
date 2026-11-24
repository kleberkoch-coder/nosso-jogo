/* Cards do grupo (KAN-294, pelada-v126): os modelos de desenho e o que cada tipo de card leva. Regra pura, sem tela.
   Decisões do Kleber (23/11/2026): Plano A; "quanto mais editável, melhor"; o app traz modelos prontos, que o
   administrador copia e edita (os do grupo, até 12); cada tipo de card escolhe o modelo e o que mostra; o número grande
   é uma estatística escolhida (nunca a nota privada).
   Gravado em grupos/{gid}.cfg.cards = { modelos: {id: Modelo}, usos: {tipo: Uso} }. As regras do Firebase conferem o
   formato básico e o Plano A; aqui o app limpa tudo o que lê (o documento do grupo é público). */

export type Base = 'classico' | 'destaque' | 'escudo' | 'metalico';
export type TipoFundo = 'cor' | 'grad' | 'listras' | 'pontos' | 'marmore' | 'pronto' | 'imagem';
/* img: nome do arquivo no Storage (grupos/{gid}/cards/fundo-{momento}.webp), só no tipo "imagem" (v127).
   p: qual desenho da galeria de fundos prontos, só no tipo "pronto" (KAN-303, v128). */
export type Fundo = { t: TipoFundo; c1: string; c2: string; img?: string; p?: string };
/* Clássico metálico (v127): o acabamento da moldura, o formato do escudo e, no "metal na cor do time", a cor base.
   KAN-305 (v130): os outros modelos também aceitam o acabamento; sem "metal", a moldura é a cor da linha. */
export type Metal = 'ouro' | 'prata' | 'bronze' | 'time';
export type Forma = 'coroa' | 'reto' | 'arco';
export type Modelo = {
  n: string;
  base: Base;
  fora: Fundo;
  dentro: Fundo;
  linha: string;
  letra: string;
  faixa: string;
  letraFaixa: string;
  placa: string;
  metal?: Metal;
  forma?: Forma;
  corMetal?: string;
};
export type TipoCard = 'perfil' | 'craque' | 'artilheiro' | 'garcom';
export type Periodo = 'ano' | 'mes' | 'tudo';
export type Uso = { m: string; titulo: string; grande: string; campos: string[]; per: Periodo };
export type Cards = { modelos: Record<string, Modelo>; usos: Partial<Record<TipoCard, Uso>> };

export const BASES: Base[] = ['classico', 'metalico', 'destaque', 'escudo'];
export const TIPOS_FUNDO: TipoFundo[] = ['cor', 'grad', 'listras', 'pontos', 'marmore', 'pronto', 'imagem'];
/* Galeria de fundos prontos (KAN-303, v128): desenhos próprios do Nosso Jogo, gerados pelo app nas duas cores do
   modelo (ui/fundos-prontos.tsx). Sem imagem de terceiros e sem arquivo para baixar. */
export const FUNDOS_PRONTOS = [
  'gramado',
  'quadra',
  'rede',
  'faixas',
  'raios',
  'holofotes',
  'hexagonos',
  'ondas',
  'velocidade',
  'xadrez',
  'concreto',
  'confete',
  'radar',
  'triangulos',
] as const;
export const METAIS: Metal[] = ['ouro', 'prata', 'bronze', 'time'];
export const FORMAS: Forma[] = ['coroa', 'reto', 'arco'];
export const nomeFundoValido = (n: unknown): n is string =>
  typeof n === 'string' && /^fundo-\d{10,16}\.(webp|png|jpg)$/.test(n);
export const TIPOS: TipoCard[] = ['perfil', 'craque', 'artilheiro', 'garcom'];
export const PERIODOS: Periodo[] = ['ano', 'mes', 'tudo'];
export const MAX_MODELOS = 12;
export const MAX_NOME = 30;
export const MAX_TITULO = 24;
/* Espaços de estatística de cada desenho. */
export const ESPACOS: Record<Base, number> = { classico: 6, destaque: 2, escudo: 6, metalico: 6 };

/* Estatísticas que um card pode mostrar. "rodada" só nos cards da rodada; "ast" só em esporte com assistência. */
export type Estat = { k: string; rodada?: boolean; ast?: boolean };
export const ESTATS: Estat[] = [
  { k: 'gols' },
  { k: 'as', ast: true },
  { k: 'jogos' },
  { k: 'vit' },
  { k: 'aprov' },
  { k: 'premios' },
  { k: 'golsRod', rodada: true },
  { k: 'asRod', rodada: true, ast: true },
  { k: 'vitRod', rodada: true },
  { k: 'votos', rodada: true },
  { k: 'votosPct', rodada: true },
];
export const estatsDe = (tipo: TipoCard, temAst: boolean) =>
  ESTATS.filter(e => (tipo === 'perfil' ? !e.rodada : true) && (temAst || !e.ast)).map(e => e.k);
export const tiposDe = (temAst: boolean): TipoCard[] => TIPOS.filter(t => temAst || t !== 'garcom');

/* Os modelos prontos (não ficam gravados; o id começa com "p-"). Desenho próprio do Nosso Jogo. */
export const PRONTOS: Record<string, Modelo> = {
  'p-classico': {
    n: '',
    base: 'classico',
    fora: { t: 'listras', c1: '#d9d9d9', c2: '#ffffff' },
    dentro: { t: 'marmore', c1: '#f3f1ec', c2: '#9c978c' },
    linha: '#c9a15a',
    letra: '#4a3d25',
    faixa: '#ffffff',
    letraFaixa: '#4a3d25',
    placa: '#ffffff',
  },
  'p-metalico': {
    n: '',
    base: 'metalico',
    fora: { t: 'listras', c1: '#d7d7d7', c2: '#ffffff' },
    dentro: { t: 'marmore', c1: '#f4f1ea', c2: '#8e877a' },
    linha: '#c9a04a',
    letra: '#4a3b1f',
    faixa: '#ffffff',
    letraFaixa: '#4a3b1f',
    placa: '#ffffff',
    metal: 'ouro',
    forma: 'coroa',
    corMetal: '#3e72d0',
  },
  'p-destaque': {
    n: '',
    base: 'destaque',
    fora: { t: 'listras', c1: '#dadada', c2: '#ffffff' },
    dentro: { t: 'grad', c1: '#5c5c5c', c2: '#cfcfcf' },
    linha: '#d9ae4c',
    letra: '#1b1b1b',
    faixa: '#141414',
    letraFaixa: '#f7f1e1',
    placa: '#f1efea',
  },
  'p-escudo': {
    n: '',
    base: 'escudo',
    fora: { t: 'pontos', c1: '#efefef', c2: '#9a9a9a' },
    dentro: { t: 'grad', c1: '#2a2a2a', c2: '#0b0b0b' },
    linha: '#e2b54a',
    letra: '#fff4d6',
    faixa: '#2a2a2a',
    letraFaixa: '#fff4d6',
    placa: '#0b0b0b',
  },
};

/* O que cada tipo de card leva, quando o grupo ainda não escolheu. O título vazio usa o texto do tipo. */
export const USO_PADRAO: Record<TipoCard, Uso> = {
  perfil: {
    m: 'p-classico',
    titulo: '',
    grande: 'gols',
    campos: ['gols', 'as', 'jogos', 'vit', 'aprov', 'premios'],
    per: 'ano',
  },
  craque: { m: 'p-destaque', titulo: '', grande: 'votosPct', campos: ['golsRod', 'votos'], per: 'ano' },
  artilheiro: { m: 'p-destaque', titulo: '', grande: 'golsRod', campos: ['gols', 'premios'], per: 'ano' },
  garcom: { m: 'p-destaque', titulo: '', grande: 'asRod', campos: ['as', 'golsRod'], per: 'ano' },
};

const COR = /^#[0-9a-f]{6}$/;
export const corOk = (c: unknown): c is string => typeof c === 'string' && COR.test(c);
const cor = (c: unknown, padrao: string) =>
  typeof c === 'string' && COR.test(c.toLowerCase()) ? c.toLowerCase() : padrao;
const texto = (v: unknown, max: number) =>
  typeof v === 'string'
    ? v
        .replace(/[\u0000-\u001f]/g, ' ')
        .trim()
        .slice(0, max)
    : '';
const idOk = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id);

function fundo(v: unknown, padrao: Fundo): Fundo {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  let t = TIPOS_FUNDO.includes(o.t as TipoFundo) ? (o.t as TipoFundo) : padrao.t;
  /* Imagem só com um nome de arquivo válido; sem ele, volta à cor lisa. */
  if (t === 'imagem' && !nomeFundoValido(o.img)) t = 'cor';
  const f: Fundo = { t, c1: cor(o.c1, padrao.c1), c2: cor(o.c2, padrao.c2) };
  if (t === 'imagem') f.img = o.img as string;
  if (t === 'pronto')
    f.p = (FUNDOS_PRONTOS as readonly string[]).includes(o.p as string) ? (o.p as string) : FUNDOS_PRONTOS[0];
  return f;
}

/* KAN-302 (v128): imagens enviadas que cada versão dos cards usa, para apagar do Storage as que sobraram. */
export function imagensUsadas(c: Cards | null | undefined): string[] {
  const r = new Set<string>();
  for (const m of Object.values((c && c.modelos) || {}))
    for (const f of [m.fora, m.dentro]) if (f && f.t === 'imagem' && nomeFundoValido(f.img)) r.add(f.img);
  return [...r];
}
/* Ao salvar (depois = o que vai ser gravado): as de antes e as enviadas agora que ninguém usa mais. Ao fechar sem
   salvar (depois = null): só as enviadas agora que não estavam em uso antes. */
export function imagensParaApagar(antes: Cards, depois: Cards | null, enviadas: string[]): string[] {
  const ficam = new Set(imagensUsadas(depois || antes));
  const candidatas = depois ? [...imagensUsadas(antes), ...enviadas] : enviadas;
  return [...new Set(candidatas)].filter(n => nomeFundoValido(n) && !ficam.has(n));
}

/* Um modelo lido do banco: tudo conferido, com o pronto da mesma base como padrão. */
export function limparModelo(v: unknown): Modelo | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!BASES.includes(o.base as Base)) return null;
  const p = PRONTOS['p-' + o.base]!;
  return {
    n: texto(o.n, MAX_NOME),
    base: o.base as Base,
    fora: fundo(o.fora, p.fora),
    dentro: fundo(o.dentro, p.dentro),
    linha: cor(o.linha, p.linha),
    letra: cor(o.letra, p.letra),
    faixa: cor(o.faixa, p.faixa),
    letraFaixa: cor(o.letraFaixa, p.letraFaixa),
    placa: cor(o.placa, p.placa),
    ...(o.base === 'metalico'
      ? {
          metal: METAIS.includes(o.metal as Metal) ? (o.metal as Metal) : p.metal!,
          forma: FORMAS.includes(o.forma as Forma) ? (o.forma as Forma) : p.forma!,
          corMetal: cor(o.corMetal, p.corMetal!),
        }
      : METAIS.includes(o.metal as Metal)
        ? { metal: o.metal as Metal, corMetal: cor(o.corMetal, '#3e72d0') }
        : {}),
  };
}

export function limparUso(v: unknown, tipo: TipoCard, modelos: Record<string, Modelo>, temAst = true): Uso {
  const pad = USO_PADRAO[tipo];
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const ok = estatsDe(tipo, temAst);
  const m = typeof o.m === 'string' && (PRONTOS[o.m] || modelos[o.m]) ? o.m : pad.m;
  const campos = Array.isArray(o.campos)
    ? o.campos.slice(0, 6).map(c => (typeof c === 'string' && ok.includes(c) ? c : ''))
    : pad.campos.filter(c => ok.includes(c));
  return {
    m,
    titulo: texto(o.titulo, MAX_TITULO),
    grande:
      typeof o.grande === 'string' && ok.includes(o.grande) ? o.grande : ok.includes(pad.grande) ? pad.grande : ok[0]!,
    campos,
    per: PERIODOS.includes(o.per as Periodo) ? (o.per as Periodo) : pad.per,
  };
}

/* Tudo o que o grupo gravou, limpo. Modelos a mais que o limite ficam de fora. */
export function lerCards(v: unknown, temAst = true): Cards {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const modelos: Record<string, Modelo> = {};
  const ms = (o.modelos && typeof o.modelos === 'object' ? o.modelos : {}) as Record<string, unknown>;
  for (const id of Object.keys(ms).sort()) {
    if (Object.keys(modelos).length >= MAX_MODELOS) break;
    const m = idOk(id) && !id.startsWith('p-') ? limparModelo(ms[id]) : null;
    if (m) modelos[id] = m;
  }
  const us = (o.usos && typeof o.usos === 'object' ? o.usos : {}) as Record<string, unknown>;
  const usos: Partial<Record<TipoCard, Uso>> = {};
  for (const t of TIPOS) usos[t] = limparUso(us[t], t, modelos, temAst);
  return { modelos, usos };
}

export const modeloDe = (c: Cards, id: string): Modelo => c.modelos[id] || PRONTOS[id] || PRONTOS['p-classico']!;
export const pronto = (id: string) => id.startsWith('p-');

/* Copiar um modelo (pronto ou do grupo): a cópia ganha o nome dado (quem chama monta "… (cópia)") e um id novo.
   Os prontos não têm nome gravado: o nome vem do dicionário (card.base.*). */
export function copiar(c: Cards, deId: string, novoId: string, nome: string): { cards: Cards; id: string } | null {
  if (Object.keys(c.modelos).length >= MAX_MODELOS || !idOk(novoId) || novoId.startsWith('p-')) return null;
  const m = modeloDe(c, deId);
  const n = texto(nome, MAX_NOME);
  const copia: Modelo = JSON.parse(JSON.stringify({ ...m, n }));
  return { cards: { ...c, modelos: { ...c.modelos, [novoId]: copia } }, id: novoId };
}

/* Apagar um modelo do grupo: quem o usava volta ao pronto da mesma base. */
export function apagar(c: Cards, id: string): Cards {
  if (!c.modelos[id]) return c;
  const base = c.modelos[id]!.base;
  const modelos = { ...c.modelos };
  delete modelos[id];
  const usos: Cards['usos'] = {};
  for (const t of TIPOS) {
    const u = c.usos[t];
    if (u) usos[t] = u.m === id ? { ...u, m: 'p-' + base } : u;
  }
  return { modelos, usos };
}

/* O que vai para o banco (sem os prontos, que ficam no código). */
export function paraGravar(c: Cards): Cards {
  return JSON.parse(JSON.stringify(c));
}

/* Contraste entre duas cores (WCAG). Abaixo de 3:1, o texto grande fica ruim de ler: o editor avisa. */
function lum(c: string) {
  const n = parseInt(c.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
export function contraste(a: string, b: string) {
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/* A cor de fundo que fica atrás das letras principais do card (a média do fundo de dentro, ou a placa). */
export function fundoDasLetras(m: Modelo): string {
  if (m.base === 'destaque') return m.placa;
  if (m.dentro.t === 'cor' || m.dentro.t === 'imagem') return m.dentro.c1;
  const a = parseInt(m.dentro.c1.slice(1), 16),
    b = parseInt(m.dentro.c2.slice(1), 16);
  const peso = m.dentro.t === 'grad' ? 0.5 : 0.2;
  const mix = (s: number) => Math.round(((a >> s) & 255) * (1 - peso) + ((b >> s) & 255) * peso);
  return '#' + [16, 8, 0].map(s => mix(s).toString(16).padStart(2, '0')).join('');
}
export const poucoContraste = (m: Modelo) =>
  contraste(m.letra, fundoDasLetras(m)) < 3 || (m.base === 'destaque' && contraste(m.letraFaixa, m.faixa) < 3);

/* Valores de uma estatística para mostrar no card (números já prontos em texto). */
export type Numeros = Partial<Record<string, number>>;
export function valor(k: string, n: Numeros): string {
  const v = n[k];
  if (v == null || !isFinite(v)) return '—';
  if (k === 'aprov' || k === 'votosPct') return Math.round(v) + '%';
  if (k === 'premios') return Math.round(v) + 'x';
  return String(Math.round(v));
}

/* Números da temporada a partir dos resumos do mês (resumos/{AAAA-MM}.jog.{pid}). */
type Linha = { j?: number; v?: number; e?: number; g?: number; as?: number; mvp?: number };
export function numerosDoPeriodo(
  resumos: Record<string, { jog?: Record<string, Linha> } | undefined>,
  pid: string,
  per: Periodo,
  hoje: string
): Numeros {
  const ano = hoje.slice(0, 4),
    mes = hoje.slice(0, 7);
  const t = { j: 0, v: 0, e: 0, g: 0, as: 0, mvp: 0 };
  for (const [m, r] of Object.entries(resumos || {})) {
    if (per === 'ano' && !m.startsWith(ano)) continue;
    if (per === 'mes' && m !== mes) continue;
    const l = (r && r.jog && r.jog[pid]) || null;
    if (!l) continue;
    t.j += +(l.j || 0);
    t.v += +(l.v || 0);
    t.e += +(l.e || 0);
    t.g += +(l.g || 0);
    t.as += +(l.as || 0);
    t.mvp += +(l.mvp || 0);
  }
  return {
    gols: t.g,
    as: t.as,
    jogos: t.j,
    vit: t.v,
    aprov: t.j ? ((t.v * 3 + t.e) / (t.j * 3)) * 100 : 0,
    premios: t.mvp,
  };
}

/* Números de exemplo, para a prévia do editor. */
export const EXEMPLO: Numeros = {
  gols: 85,
  as: 12,
  jogos: 40,
  vit: 25,
  aprov: 62,
  premios: 5,
  golsRod: 3,
  asRod: 2,
  vitRod: 4,
  votos: 8,
  votosPct: 62,
};

/* Clássico metálico (v127): as cores do degradê da moldura (escuro, claro, médio, brilho, escuro). "time" gera o metal
   a partir de uma cor (a do time): mais escura nas pontas, mais clara no meio e um brilho quase branco. */
const METAL_FIXO: Record<Exclude<Metal, 'time'>, string[]> = {
  ouro: ['#7a5a1e', '#f6e3a1', '#c9a04a', '#fff4cf', '#8a6420'],
  prata: ['#5e6670', '#f4f6f8', '#a9b1ba', '#ffffff', '#6b737c'],
  bronze: ['#5a3018', '#f0c39a', '#b36e3c', '#ffe1c4', '#6e3a1c'],
};
function misturar(c: string, alvo: number, peso: number) {
  const n = parseInt(c.slice(1), 16);
  return (
    '#' +
    [16, 8, 0]
      .map(s => Math.round(((n >> s) & 255) * (1 - peso) + alvo * peso))
      .map(v => v.toString(16).padStart(2, '0'))
      .join('')
  );
}
export function coresDoMetal(m: Modelo): string[] {
  const metal = m.metal || 'ouro';
  if (metal !== 'time') return METAL_FIXO[metal];
  const c = m.corMetal && corOk(m.corMetal) ? m.corMetal : '#3e72d0';
  return [misturar(c, 0, 0.55), misturar(c, 255, 0.75), c, '#ffffff', misturar(c, 0, 0.4)];
}
