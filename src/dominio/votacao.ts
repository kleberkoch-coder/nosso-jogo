/* Regra da votação (destaques da rodada; uma das 5 da D12): contagem dos votos e candidatos de cada categoria.
   Pura: não lê a memória do app (KAN-220). Testada em testes/regras/votacao.test.mjs.
   - Cada aparelho vota uma vez por categoria; voto com id inválido ou em categoria que não existe não conta.
   - Ganha quem tem mais votos; empate: todos os empatados. Sem votos, ninguém ganha.
   - Candidatos: quem jogou a rodada (titulares e reservas); categoria com posição, só quem é dessa posição. */
const idOk = (s: unknown) => typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s);

export type Categoria = { id: string; name?: string; pos?: string | null };
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

/* KAN-222: auditoria ("Quem votou"). Uma linha por aparelho que votou, com o nome que a pessoa escolheu, o voto
   final, a hora e as trocas. A hora é a do servidor (última troca gravada); em votação antiga, sem trocas, vale a
   hora do aparelho (t), marcada. O mesmo nome em mais de um aparelho fica marcado (repetido). */
/* KAN-224: no máximo 50 trocas gravadas por aparelho em cada votação (o Firebase recusa a 51ª). */
export const LIMITE_TROCAS = 50;
export type MeuVoto = { pid?: string; v?: Record<string, string>; t?: number; nt?: number };
/* KAN-223/224: o que gravar quando o aparelho toca no nome p da categoria c. Tocar de novo no nome já escolhido
   não grava nada; a primeira escolha ou a troca de nome sobe o contador e gera o registro {aparelho}_{nt}.
   Depois do limite, o voto continua valendo, só sem registro novo na auditoria. */
export function proximoVoto(
  antes: MeuVoto | null | undefined,
  pid: string,
  c: string,
  p: string,
  t: number
): { voto: MeuVoto; troca: number } | null {
  const a = antes || {};
  if ((a.v || {})[c] === p) return null;
  const nt = a.nt || 0,
    troca = nt < LIMITE_TROCAS ? nt + 1 : 0;
  const voto: MeuVoto = { pid, v: Object.assign({}, a.v, { [c]: p }), t };
  if (troca) voto.nt = troca;
  else if (nt) voto.nt = nt;
  return { voto, troca };
}

export type Troca = { u: string; pid: string; c: string; p: string; em: number | null };
export type LinhaAuditoria = {
  u: string;
  pid: string;
  v: Record<string, string>;
  quando: number | null;
  doServidor: boolean;
  trocas: Troca[];
  repetido: boolean;
};
export function auditoria(
  votos: Record<string, { pid?: string; v?: Record<string, string>; t?: number } | null | undefined>,
  trocas: Record<string, Troca | null | undefined>
): LinhaAuditoria[] {
  const porAparelho: Record<string, Troca[]> = {};
  for (const x of Object.values(trocas || {})) if (x && x.u) (porAparelho[x.u] ||= []).push(x);
  const linhas: LinhaAuditoria[] = [];
  for (const [u, d] of Object.entries(votos || {})) {
    if (!d || !d.pid) continue;
    const ts = (porAparelho[u] || []).slice().sort((a, b) => (a.em ?? Infinity) - (b.em ?? Infinity)),
      ult = ts.length ? ts[ts.length - 1]!.em : null;
    linhas.push({
      u,
      pid: d.pid,
      v: d.v || {},
      quando: ult ?? d.t ?? null,
      doServidor: ult != null,
      trocas: ts,
      repetido: false,
    });
  }
  const n: Record<string, number> = {};
  linhas.forEach(l => (n[l.pid] = (n[l.pid] || 0) + 1));
  linhas.forEach(l => (l.repetido = n[l.pid]! > 1));
  /* Mais recente primeiro. */
  return linhas.sort((a, b) => (b.quando || 0) - (a.quando || 0));
}
