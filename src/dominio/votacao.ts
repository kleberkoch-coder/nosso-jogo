/* Votação (destaques da rodada): contagem dos votos e candidatos de cada categoria (KAN-218: saiu de telas/, porque
   é regra, não tela). A contagem é pura e testada em testes/regras/votacao.test.mjs (KAN-220). */
import { pname, ppos, rodDoc } from './grupo.js';
import { idOk } from '../nucleo/util.js';
import { LOCAL } from '../i18n/formatos.js';

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

/* Quem pode ser votado numa categoria: quem jogou a rodada (e, se a categoria tem posição, só dessa posição). */
export function candidates(v: Votacao, c: Categoria): string[] {
  const r = rodDoc(v.rid) as { times?: { players: string[] }[] } | null;
  if (!r || !r.times) return [];
  let ids = r.times.flatMap(t => t.players);
  if (c.pos) ids = ids.filter(id => ppos(id) === c.pos);
  return ids.sort((a, b) => pname(a).localeCompare(pname(b), LOCAL));
}
