/* Resumo das partidas de uma rodada (KAN-232): jogos na ordem, quem marcou em cada um, a artilharia somada
   e, com mais de 2 times, a classificação da rodada. Regra pura, sem tela; o texto do WhatsApp fica em
   ui/zap-partidas.ts. */
export type GolResumo = { t: 'a' | 'b'; pid?: string | null; og?: boolean; pts?: number };
export type PartidaResumo = { ga: number; gb: number; goals?: GolResumo[] };
export type LinhaTabela = {
  time: string;
  pts: number;
  j: number;
  v: number;
  e: number;
  d: number;
  gp: number;
  gc: number;
};

/* Vitória 3, empate 1 (como no ranking). */
const PONTOS = { v: 3, e: 1 };

/* Quem marcou numa partida, na ordem dos gols, com os pontos de cada lance (gol contra não conta para ninguém). */
export function autores(m: PartidaResumo): [string, number][] {
  return (m.goals || []).filter(g => g.pid && !g.og).map(g => [g.pid as string, g.pts || 1]);
}

/* Artilharia da rodada: soma das partidas e do que foi lançado só como total (KAN-178). Do maior para o menor;
   empate em ordem alfabética do nome. */
export function artilharia(
  ms: PartidaResumo[],
  nome: (pid: string) => string,
  lancada?: Record<string, number> | null,
  local = 'pt-BR'
): [string, number][] {
  const soma: Record<string, number> = {};
  ms.forEach(m => autores(m).forEach(([p, n]) => (soma[p] = (soma[p] || 0) + n)));
  Object.entries(lancada || {}).forEach(([p, n]) => {
    if (n > 0) soma[p] = (soma[p] || 0) + n;
  });
  return Object.entries(soma).sort((x, y) => y[1] - x[1] || nome(x[0]).localeCompare(nome(y[0]), local));
}

/* Classificação da rodada por time: pontos, saldo, gols pró e, por fim, o nome. */
export function tabela(ms: PartidaResumo[], nomeDoTime: (m: PartidaResumo, lado: 'a' | 'b') => string): LinhaTabela[] {
  const t: Record<string, LinhaTabela> = {};
  const linha = (k: string) => (t[k] = t[k] || { time: k, pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 });
  ms.forEach(m => {
    const a = linha(nomeDoTime(m, 'a')),
      b = linha(nomeDoTime(m, 'b'));
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
  return Object.values(t).sort(
    (x, y) => y.pts - x.pts || y.gp - y.gc - (x.gp - x.gc) || y.gp - x.gp || x.time.localeCompare(y.time)
  );
}
