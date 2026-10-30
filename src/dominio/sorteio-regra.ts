/* Regra do sorteio de times (uma das 5 da D12; KAN-220). Pura: recebe tudo o que precisa (notas, posições, pares
   separados, histórico e o sorteador) e não lê a memória do app. Testada em testes/regras/sorteio.test.mjs.
   Quem liga a regra ao app é dominio/sorteio.js.
   - Equilíbrio: a diferença da nota média entre os times pesa muito; craques (nota 9 ou mais) se espalham.
   - Posições: cada posição se divide entre os times; a posição-chave (ex.: goleiro) pesa mais.
   - Pares separados ("não colocar no mesmo time") quase nunca ficam juntos (custo 500).
   - Variar parceiros (0 a 3): quem jogou junto nas rodadas recentes pesa mais, com peso menor para rodadas antigas.
   - Entre as melhores soluções (até 8% acima da melhor), uma é escolhida ao acaso, para o sorteio não repetir. */
export type Jogadores = string[];
export type Historico = Record<string, number>;
export type Sorteio = {
  nota: (id: string) => number; // de 1 a 10
  pos: (id: string) => string | undefined;
  posicoes: string[]; // siglas das posições do esporte
  chave?: string | null; // posição-chave (ex.: GOL)
  separados?: [string, string][];
  historico?: Historico;
  variar?: number; // 0 (não) a 3 (muito)
  aleatorio?: () => number; // Math.random (nos testes, um sorteador fixo)
};

export const par = (a: string, b: string) => (a < b ? a + '|' + b : b + '|' + a);

/* Tamanhos dos times: o mais parecido possível (os primeiros ficam com um a mais). */
export function tamanhos(total: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.floor(total / n) + (i < total % n ? 1 : 0));
}

/* Quantas vezes cada par jogou junto, com peso 0,8 por rodada mais antiga (a mais recente primeiro). */
export function historico(rodadas: { times?: { players: string[] }[] }[]): Historico {
  const h: Historico = {};
  rodadas
    .filter(r => r.times)
    .forEach((r, i) => {
      const peso = Math.pow(0.8, i);
      r.times!.forEach(t => {
        const p = t.players;
        for (let x = 0; x < p.length; x++)
          for (let y = x + 1; y < p.length; y++) h[par(p[x]!, p[y]!)] = (h[par(p[x]!, p[y]!)] || 0) + peso;
      });
    });
  return h;
}

/* Custo de uma divisão: quanto menor, melhor. */
export function custo(T: string[][], o: Sorteio, total = T.reduce((s, t) => s + t.length, 0)): number {
  const n = T.length,
    sep = new Set((o.separados || []).map(([a, b]) => par(a, b))),
    hist = o.historico || {},
    pesoHist = [0, 1.5, 4, 9][o.variar ?? 2] ?? 4,
    st = (id: string) => o.nota(id) / 2;
  let c = 0;
  const media = T.map(t => (t.reduce((s, id) => s + st(id), 0) / t.length) * (total / n));
  c += (Math.max(...media) - Math.min(...media)) ** 2 * 6;
  for (const p of o.posicoes) {
    const cn = T.map(t => t.filter(id => o.pos(id) === p).length),
      d = Math.max(...cn) - Math.min(...cn),
      chave = p === o.chave;
    c += d * (chave ? 6 : 2) + (d > 1 ? (d - 1) ** 2 * (chave ? 60 : 10) : 0);
  }
  const craques = T.map(t => t.filter(id => o.nota(id) >= 9).length);
  if (Math.max(...craques) - Math.min(...craques) > 1) c += 25;
  for (const t of T)
    for (let x = 0; x < t.length; x++)
      for (let y = x + 1; y < t.length; y++) {
        const k = par(t[x]!, t[y]!);
        if (sep.has(k)) c += 500;
        if (hist[k]) c += hist[k]! * pesoHist;
      }
  return c;
}

function embaralhar<T>(a: T[], aleatorio: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/* Divide os jogadores em n times. */
export function sortear(ids: Jogadores, n: number, o: Sorteio): string[][] {
  const aleatorio = o.aleatorio || Math.random,
    total = ids.length,
    tam = tamanhos(total, n),
    solucoes: { T: string[][]; c: number }[] = [],
    vistas = new Set<string>(),
    tentativas = total > 20 ? 50 : 120;
  for (let r = 0; r < tentativas; r++) {
    const sh = embaralhar(ids.slice(), aleatorio),
      T: string[][] = [];
    let k = 0;
    tam.forEach(s => {
      T.push(sh.slice(k, k + s));
      k += s;
    });
    /* Troca dois jogadores de times diferentes enquanto melhorar. */
    let c = custo(T, o, total),
      melhorou = true,
      voltas = 0;
    while (melhorou && voltas++ < 40) {
      melhorou = false;
      for (let a = 0; a < n; a++)
        for (let b = a + 1; b < n; b++)
          for (let i = 0; i < T[a]!.length; i++)
            for (let j = 0; j < T[b]!.length; j++) {
              [T[a]![i], T[b]![j]] = [T[b]![j]!, T[a]![i]!];
              const c2 = custo(T, o, total);
              if (c2 < c - 1e-9) {
                c = c2;
                melhorou = true;
              } else [T[a]![i], T[b]![j]] = [T[b]![j]!, T[a]![i]!];
            }
    }
    const assinatura = T.map(t => t.slice().sort().join(','))
      .sort()
      .join('/');
    if (!vistas.has(assinatura)) {
      vistas.add(assinatura);
      solucoes.push({ T: T.map(t => t.slice()), c });
    }
  }
  solucoes.sort((a, b) => a.c - b.c);
  const melhor = solucoes[0]!.c,
    boas = solucoes.filter(s => s.c <= melhor + Math.max(2, melhor * 0.08)).slice(0, 6);
  return boas[Math.floor(aleatorio() * boas.length)]!.T;
}

/* Qualidade de um sorteio já feito (o painel "Como ficou o sorteio"). */
export function qualidade(
  times: { players: string[] }[],
  o: Pick<Sorteio, 'nota' | 'pos' | 'chave' | 'separados'>,
  anterior: { players: string[] }[] | null
) {
  const media = times.map(t => t.players.reduce((s, id) => s + o.nota(id), 0) / Math.max(1, t.players.length)),
    sep = new Set((o.separados || []).map(([a, b]) => par(a, b))),
    antes = new Set<string>();
  (anterior || []).forEach(t => {
    const p = t.players;
    for (let x = 0; x < p.length; x++) for (let y = x + 1; y < p.length; y++) antes.add(par(p[x]!, p[y]!));
  });
  let viol = 0,
    pares = 0,
    rep = 0;
  times.forEach(t => {
    const p = t.players;
    for (let x = 0; x < p.length; x++)
      for (let y = x + 1; y < p.length; y++) {
        const k = par(p[x]!, p[y]!);
        pares++;
        if (sep.has(k)) viol++;
        if (antes.has(k)) rep++;
      }
  });
  return {
    diff: Math.max(...media) - Math.min(...media),
    viol,
    nsep: (o.separados || []).length,
    newPct: anterior && pares ? Math.round((1 - rep / pares) * 100) : null,
    gk: o.chave ? times.map(t => t.players.filter(id => o.pos(id) === o.chave).length) : null,
  };
}
