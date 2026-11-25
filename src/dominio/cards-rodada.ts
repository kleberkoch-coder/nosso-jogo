/* Cards da rodada (KAN-295, 2ª parte, pelada-v131): quem ganha card depois da rodada e com quais números. Regra pura,
   testada em testes/regras/cards-rodada.test.mjs. Usada na aba Partida e no detalhe do Histórico.
   - Craque: quem venceu cada categoria da votação encerrada que não é negativa (o "bagre" nunca ganha card).
   - Artilheiro: quem mais marcou na rodada (partidas, sem gol contra, mais o total lançado); empate, todos.
   - Garçom: quem mais deu assistências (só em esporte com assistência); empate, todos.
   - Campeão: cada jogador do time campeão do campeonato da rodada (decisão do Kleber de 25/11: um card por jogador).
   Os números da rodada (golsRod, asRod, vitRod, votos, votosPct) vão junto; os da temporada vêm da cópia pública. */
import type { Numeros, TipoCard } from './cards';

type Gol = { pid?: string | null; og?: boolean; pts?: number; as?: string | null };
export type PartidaRod = { ga: number; gb: number; pa?: string[]; pb?: string[]; goals?: Gol[] | null };
export type VotacaoRod = {
  open?: boolean;
  cats?: { id: string; name?: string; neg?: boolean }[];
  resultado?: Record<string, { counts?: Record<string, number>; total?: number; winners?: string[] }> | null;
};
export type Destaque = { tipo: TipoCard; pid: string; rod: Numeros; titulo?: string };

/* Gols, assistências e vitórias de cada jogador na rodada. */
export function numerosDaRodada(
  ms: PartidaRod[],
  lancada?: Record<string, number> | null
): Record<string, { golsRod: number; asRod: number; vitRod: number }> {
  const out: Record<string, { golsRod: number; asRod: number; vitRod: number }> = {};
  const de = (p: string) => (out[p] = out[p] || { golsRod: 0, asRod: 0, vitRod: 0 });
  ms.forEach(m => {
    (m.goals || []).forEach(g => {
      if (!g.pid || g.og) return;
      de(g.pid).golsRod += g.pts || 1;
      if (g.as && g.as !== g.pid) de(g.as).asRod += 1;
    });
    const venc = m.ga > m.gb ? m.pa : m.gb > m.ga ? m.pb : null;
    (venc || []).forEach(p => (de(p).vitRod += 1));
  });
  Object.entries(lancada || {}).forEach(([p, n]) => {
    if (n > 0) de(p).golsRod += n;
  });
  return out;
}

function maiores(nums: Record<string, number>): string[] {
  const max = Math.max(0, ...Object.values(nums));
  return max > 0
    ? Object.keys(nums)
        .filter(p => nums[p] === max)
        .sort()
    : [];
}

export function destaquesDaRodada(o: {
  ms: PartidaRod[];
  lancada?: Record<string, number> | null;
  votacoes?: VotacaoRod[];
  campeoes?: string[] | null;
  temAst: boolean;
}): Destaque[] {
  const rod = numerosDaRodada(o.ms, o.lancada);
  const nums = (p: string, extra: Numeros = {}): Numeros => ({
    ...(rod[p] || { golsRod: 0, asRod: 0, vitRod: 0 }),
    ...extra,
  });
  const out: Destaque[] = [];
  /* Craque: categorias não negativas da votação encerrada. A primeira usa o título do card; as outras, o nome dela. */
  let primeira = true;
  (o.votacoes || [])
    .filter(v => !v.open && v.resultado)
    .forEach(v =>
      (v.cats || [])
        .filter(c => !c.neg)
        .forEach(c => {
          const r = (v.resultado || {})[c.id] || {},
            total = r.total || 0;
          const ws = r.winners || [];
          ws.forEach(p => {
            const votos = (r.counts || {})[p] || 0;
            out.push({
              tipo: 'craque',
              pid: p,
              rod: nums(p, { votos, votosPct: total ? (votos / total) * 100 : 0 }),
              ...(primeira ? {} : { titulo: String(c.name || '') }),
            });
          });
          if (ws.length) primeira = false;
        })
    );
  const gols: Record<string, number> = {},
    ast: Record<string, number> = {};
  Object.entries(rod).forEach(([p, n]) => {
    gols[p] = n.golsRod;
    ast[p] = n.asRod;
  });
  maiores(gols).forEach(p => out.push({ tipo: 'artilheiro', pid: p, rod: nums(p) }));
  if (o.temAst) maiores(ast).forEach(p => out.push({ tipo: 'garcom', pid: p, rod: nums(p) }));
  (o.campeoes || []).forEach(p => out.push({ tipo: 'campeao', pid: p, rod: nums(p) }));
  return out;
}
