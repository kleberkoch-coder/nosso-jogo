/* Regra da votação (destaques da rodada; uma das 5 da D12): contagem dos votos e candidatos de cada categoria.
   Pura: não lê a memória do app (KAN-220). Testada em testes/regras/votacao.test.mjs.
   - Cada aparelho vota uma vez por categoria; voto com id inválido ou em categoria que não existe não conta.
   - Ganha quem tem mais votos; empate: todos os empatados. Sem votos, ninguém ganha.
   - Candidatos: quem jogou a rodada (titulares e reservas); categoria com posição, só quem é dessa posição. */
const idOk = (s: unknown) => typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s);

export type Categoria = { id: string; name?: string; pos?: string };
export type Votacao = { rid: string; cats: Categoria[] };
export type Votos = Record<string, { v?: Record<string, string> } | null | undefined>;
export type Resultado = Record<string, { counts: Record<string, number>; total: number; winners: string[] }>;

/* Conta os votos de cada categoria; quem tem mais votos ganha (empate: todos os empatados). */
export function tally(v: Votacao, votos: Votos): Resultado {
  const res: Resultado = {};
  v.cats.forEach(c => (res[c.id] = { counts: {}, total: 0, winners: [] }));
  Object.values(votos || {}).forEach(d =>
    Object.entries((d && d.v) || {}).forEach(([cid, pid]) => {
      const r = res[cid];
      if (r && idOk(pid)) {
        r.counts[pid] = (r.counts[pid] || 0) + 1;
        r.total++;
      }
    })
  );
  Object.values(res).forEach(x => {
    const mx = Math.max(0, ...Object.values(x.counts));
    x.winners = mx ? Object.keys(x.counts).filter(k => x.counts[k] === mx) : [];
  });
  return res;
}

/* Quem pode ser votado numa categoria, em ordem alfabética do nome. */
export function candidatos(
  times: { players: string[] }[] | undefined,
  c: Categoria,
  pos: (id: string) => string | undefined,
  nome: (id: string) => string,
  local = 'pt-BR'
): string[] {
  if (!times) return [];
  let ids = times.flatMap(t => t.players);
  if (c.pos) ids = ids.filter(id => pos(id) === c.pos);
  return ids.sort((a, b) => nome(a).localeCompare(nome(b), local));
}
