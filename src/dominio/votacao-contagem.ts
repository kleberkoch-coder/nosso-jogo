/* Contagem e auditoria da votação (saiu de dominio/votacao.ts na pelada-v102, KAN-254): só a aba Votação da gestão
   usa, então não pesa no link do jogador. Pura; testada em testes/regras/votacao.test.mjs e votacao-rapida.test.mjs.
   - Cada aparelho vota uma vez por categoria; voto com id inválido ou em categoria que não existe não conta.
   - Ganha quem tem mais votos; empate: todos os empatados. Sem votos, ninguém ganha. */
import type { Votacao, Votos } from './votacao.ts';

const idOk = (s: unknown) => typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s);
export type Resultado = Record<string, { counts: Record<string, number>; total: number; winners: string[] }>;

/* KAN-254: votação rápida. O voto dado no aparelho do administrador fica em votos/r_{jogador}. Quando a mesma pessoa
   tem voto na votação rápida e pelo link, vale só o mais recente dela (os outros votos com outro nome não mudam). */
export const ehRoda = (u: string) => u.startsWith('r_');
type VotoDoc = { pid?: string; v?: Record<string, string>; t?: number } | null | undefined;
export function votosQueValem<T extends VotoDoc>(votos: Record<string, T>): Record<string, T> {
  const ult: Record<string, string> = {};
  const roda = new Set(
    Object.keys(votos || {})
      .filter(u => ehRoda(u) && votos[u] && votos[u]!.pid)
      .map(u => votos[u]!.pid!)
  );
  for (const [u, d] of Object.entries(votos || {}))
    if (d && d.pid && roda.has(d.pid) && (!ult[d.pid] || (d.t || 0) > (votos[ult[d.pid]!]!.t || 0))) ult[d.pid] = u;
  const out: Record<string, T> = {};
  for (const [u, d] of Object.entries(votos || {})) if (!(d && d.pid && ult[d.pid] && ult[d.pid] !== u)) out[u] = d;
  return out;
}

/* Conta os votos de cada categoria; quem tem mais votos ganha (empate: todos os empatados). */
export function tally(v: Votacao, votos: Votos): Resultado {
  const res: Resultado = {};
  v.cats.forEach(c => (res[c.id] = { counts: {}, total: 0, winners: [] }));
  Object.values(votosQueValem(votos || {})).forEach(d =>
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

export type Troca = { u: string; pid: string; c: string; p: string; em: number | null };
export type LinhaAuditoria = {
  u: string;
  pid: string;
  v: Record<string, string>;
  quando: number | null;
  doServidor: boolean;
  trocas: Troca[];
  repetido: boolean;
  /* KAN-254: voto dado na votação rápida (r_{jogador}) e quantas vezes a pessoa votou nela. */
  roda: boolean;
  n: number;
};
export function auditoria(
  votos: Record<
    string,
    { pid?: string; v?: Record<string, string>; t?: number; em?: number; n?: number } | null | undefined
  >,
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
      quando: ult ?? (typeof d.em === 'number' ? d.em : null) ?? d.t ?? null,
      doServidor: ult != null || typeof d.em === 'number',
      trocas: ts,
      repetido: false,
      roda: ehRoda(u),
      n: d.n || 0,
    });
  }
  const n: Record<string, number> = {};
  linhas.forEach(l => (n[l.pid] = (n[l.pid] || 0) + 1));
  linhas.forEach(l => (l.repetido = n[l.pid]! > 1));
  /* Mais recente primeiro. */
  return linhas.sort((a, b) => (b.quando || 0) - (a.quando || 0));
}
