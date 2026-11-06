/* Campeonato da rodada (KAN-233, pelada-v96): todos contra todos em turno único e a classificação com os critérios
   de desempate escolhidos. Regra pura, sem tela (telas/Campeonato.tsx). O mata-mata entra na pelada-v97.
   Decisões do Kleber (05/11/2026): Plano A; sem tempo por fase (cada partida já tem o seu); só turno único.
   Times são as posições na lista de times da rodada (0 = primeiro do sorteio). */
export type Criterio = 'saldo' | 'gp' | 'cd' | 'sorteio';
export type Camp = {
  em: number; // quando começou: só as partidas salvas depois contam
  n: number; // quantos times havia ao montar (se o sorteio mudar, o campeonato precisa ser montado de novo)
  jogos: string[]; // "0-1", "2-3"… na ordem em que vão acontecer
  crit: Criterio[]; // depois dos pontos, na ordem
  sem: number; // número para o critério "sorteio" dar o mesmo resultado em todos os aparelhos
};
export type Jogo = { a: number; b: number; ga: number; gb: number; at?: number };
export type Linha = {
  t: number;
  pos: number;
  pts: number;
  j: number;
  v: number;
  e: number;
  d: number;
  gp: number;
  gc: number;
  sg: number;
};

/* Vitória 3, empate 1 (como no ranking e no resumo da rodada). */
export const PONTOS = { v: 3, e: 1 };
export const CRITERIOS: Criterio[] = ['saldo', 'gp', 'cd', 'sorteio'];
export const MIN_TIMES = 3;
export const MAX_TIMES = 16;

export const par = (a: number, b: number) => Math.min(a, b) + '-' + Math.max(a, b);
export const lerPar = (s: string): [number, number] => s.split('-').map(Number) as [number, number];

/* Ordem dos jogos: todos os pares uma vez, sem nenhum time jogar duas seguidas quando dá (com 3 ou 4 times
   não dá: com 4, dois jogos seguidos sem time repetido usam os 4, e o seguinte teria de repetir o primeiro).
   Procura uma ordem assim, tentando primeiro os jogos cujos times descansaram mais; se a busca passar do limite,
   fica a escolha gulosa, que só evita as seguidas quando consegue. Com 4 times: 1×2, 3×4, 1×3, 2×4, 1×4, 2×3. */
const BUSCA = 20000;
export function ordemDosJogos(n: number): string[] {
  const pares: [number, number][] = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pares.push([a, b]);
  const ultimo = Array(n).fill(-Infinity),
    usado = pares.map(() => false),
    feitos: number[] = [];
  let passos = 0;
  /* Candidatos do mais descansado para o menos (empate: a ordem dos pares). */
  const ranking = () =>
    pares
      .map(([a, b], i) => ({ i, x: Math.min(feitos.length - ultimo[a], feitos.length - ultimo[b]) }))
      .filter(c => !usado[c.i])
      .sort((p, q) => q.x - p.x || p.i - q.i);
  const tentar = (rigido: boolean): boolean => {
    if (feitos.length === pares.length) return true;
    for (const c of ranking()) {
      if (rigido && (c.x <= 1 || ++passos > BUSCA)) return false;
      const [a, b] = pares[c.i],
        ua = ultimo[a],
        ub = ultimo[b];
      usado[c.i] = true;
      ultimo[a] = ultimo[b] = feitos.length;
      feitos.push(c.i);
      if (tentar(rigido)) return true;
      feitos.pop();
      usado[c.i] = false;
      ultimo[a] = ua;
      ultimo[b] = ub;
      if (!rigido) return false;
    }
    return false;
  };
  if (!tentar(true)) {
    feitos.length = 0;
    usado.fill(false);
    ultimo.fill(-Infinity);
    tentar(false);
  }
  return feitos.map(i => pares[i].join('-'));
}

export function novoCampeonato(n: number, crit: Criterio[], agora: number, sem: number): Camp {
  return { em: agora, n, jogos: ordemDosJogos(n), crit: crit.filter(c => CRITERIOS.includes(c)), sem };
}

/* Campeonato gravado e ainda válido para estes times. */
export function lerCamp(c: unknown, nTimes: number): Camp | null {
  const x = c as Partial<Camp> | null | undefined;
  if (!x || typeof x.em !== 'number' || !Array.isArray(x.jogos) || x.n !== nTimes) return null;
  return {
    em: x.em,
    n: x.n,
    jogos: x.jogos.filter(j => typeof j === 'string'),
    crit: Array.isArray(x.crit) ? x.crit.filter(k => CRITERIOS.includes(k)) : [],
    sem: typeof x.sem === 'number' ? x.sem : 0,
  };
}

/* Qual partida salva vale para cada jogo do campeonato: a primeira, depois do início, entre os dois times. */
export function resultados(c: Camp, ms: Jogo[]): (Jogo | null)[] {
  const usadas = new Set<number>();
  return c.jogos.map(j => {
    const [a, b] = lerPar(j);
    const i = ms.findIndex((m, k) => !usadas.has(k) && (m.at == null || m.at >= c.em) && par(m.a, m.b) === par(a, b));
    if (i < 0) return null;
    usadas.add(i);
    const m = ms[i];
    /* Sempre do ponto de vista do jogo da tabela (a × b), mesmo que tenham entrado trocados. */
    return m.a === a ? m : { a, b, ga: m.gb, gb: m.ga, at: m.at };
  });
}

/* Próximo jogo do campeonato (o primeiro da ordem sem resultado), ou null se acabou. */
export function proximo(c: Camp, ms: Jogo[]): { i: number; a: number; b: number } | null {
  const r = resultados(c, ms),
    i = r.findIndex(x => !x);
  if (i < 0) return null;
  const [a, b] = lerPar(c.jogos[i]);
  return { i, a, b };
}

function somar(n: number, js: Jogo[], so?: Set<number>): Linha[] {
  const l: Linha[] = Array.from({ length: n }, (_, t) => ({
    t,
    pos: 0,
    pts: 0,
    j: 0,
    v: 0,
    e: 0,
    d: 0,
    gp: 0,
    gc: 0,
    sg: 0,
  }));
  js.forEach(m => {
    if (so && !(so.has(m.a) && so.has(m.b))) return;
    const a = l[m.a],
      b = l[m.b];
    if (!a || !b) return;
    a.j++;
    b.j++;
    a.gp += m.ga;
    a.gc += m.gb;
    b.gp += m.gb;
    b.gc += m.ga;
    if (m.ga > m.gb) {
      a.v++;
      b.d++;
      a.pts += PONTOS.v;
    } else if (m.ga < m.gb) {
      b.v++;
      a.d++;
      b.pts += PONTOS.v;
    } else {
      a.e++;
      b.e++;
      a.pts += PONTOS.e;
      b.pts += PONTOS.e;
    }
  });
  l.forEach(x => (x.sg = x.gp - x.gc));
  return l;
}

/* Número do sorteio de cada time: o mesmo em todos os aparelhos (vem de "sem"). */
function sorte(sem: number, t: number): number {
  let h = (sem ^ (t * 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/* Classificação: pontos primeiro, depois cada critério na ordem escolhida. Confronto direto conta os pontos só nos
   jogos entre os times empatados. Se ainda empatar, vale a ordem do sorteio dos times. */
export function classificacao(c: Camp, ms: Jogo[]): Linha[] {
  const js = resultados(c, ms).filter((x): x is Jogo => !!x),
    l = somar(c.n, js);
  const desempatar = (grupo: Linha[], k: number): Linha[] => {
    if (grupo.length < 2 || k > c.crit.length) return grupo.sort((x, y) => x.t - y.t);
    let valor: (x: Linha) => number;
    if (k === 0) valor = x => x.pts;
    else {
      const cr = c.crit[k - 1];
      if (cr === 'saldo') valor = x => x.sg;
      else if (cr === 'gp') valor = x => x.gp;
      else if (cr === 'sorteio') valor = x => sorte(c.sem, x.t);
      else {
        const mini = somar(c.n, js, new Set(grupo.map(x => x.t)));
        valor = x => mini[x.t].pts;
      }
    }
    const blocos = new Map<number, Linha[]>();
    grupo.forEach(x => {
      const v = valor(x);
      blocos.set(v, (blocos.get(v) || []).concat(x));
    });
    return [...blocos.entries()].sort((x, y) => y[0] - x[0]).flatMap(([, g]) => desempatar(g, k + 1));
  };
  return desempatar(l, 0).map((x, i) => ({ ...x, pos: i + 1 }));
}

/* Quantos jogos faltam (0 = fase de todos contra todos encerrada). */
export const faltam = (c: Camp, ms: Jogo[]) => resultados(c, ms).filter(x => !x).length;
