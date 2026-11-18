/* Material do grupo (KAN-190, parte 2, pelada-v109): bolas, coletes e afins, e com quem cada um fica entre as
   rodadas. Regra pura, com teste em testes/regras/material.test.mjs. Fica no grupo (cfg.mat), não na rodada; só
   administradores mudam (as regras do Firebase deixam o dia a dia mexer em cfg.mat e cfg.matHist). O caso real:
   3 bolas, cada uma com uma pessoa, e o risco de nenhuma delas ir ao jogo. */
import type { Item } from './material-link.ts';
export type { Item } from './material-link.ts';
export type Troca = { nome: string; de: string | null; para: string | null; em: number };
export type Resposta = { s?: 'in' | 'out' } | undefined;

export const HIST_MAX = 10;

/* Os itens válidos e o que está com uma pessoa ficam em material-link.ts, porque vão no link do jogador (KAN-274). */
import { itens } from './material-link.ts';
export { comPessoa, itens } from './material-link.ts';

/* Situação de cada material na rodada, agrupado pelo nome ("Bola" × 3): quem guarda e já confirmou, quem disse que
   não vai e quem ainda não respondeu. "nenhum" = nenhum de quem guarda confirmou (o aviso em destaque). */
export function situacao(mat: unknown, pres: Record<string, Resposta>) {
  const por = new Map<string, Item[]>();
  for (const x of itens(mat)) {
    const k = x.nome.trim();
    por.set(k, (por.get(k) || []).concat(x));
  }
  return [...por].map(([nome, xs]) => {
    const com = [...new Set(xs.map(x => x.com).filter((p): p is string => !!p))],
      vao = com.filter(p => pres[p]?.s === 'in'),
      naoVao = com.filter(p => pres[p]?.s === 'out'),
      semResposta = com.filter(p => !pres[p]?.s);
    return { nome, total: xs.length, com, vao, naoVao, semResposta, nenhum: !vao.length };
  });
}

/* Novos itens: "Bola" × 3 vira 3 itens com ids próprios, todos com a mesma pessoa (ou ninguém). */
export function adicionar(mat: unknown, nome: string, qtd: number, com: string | null, novoId: () => string): Item[] {
  const n = Math.max(1, Math.min(10, Math.floor(qtd) || 1)),
    limpo = nome.trim().slice(0, 30);
  if (!limpo) return itens(mat);
  return itens(mat).concat(Array.from({ length: n }, () => ({ id: novoId(), nome: limpo, com: com || null })));
}

/* Passar um item para outra pessoa: muda com quem está e guarda a troca no histórico (as 10 mais recentes). */
export function passar(mat: unknown, hist: unknown, id: string, para: string | null, agora: number) {
  const xs = itens(mat),
    x = xs.find(i => i.id === id),
    h = Array.isArray(hist) ? (hist as Troca[]) : [];
  if (!x || (x.com || null) === (para || null)) return null;
  return {
    mat: xs.map(i => (i.id === id ? { ...i, com: para || null } : i)),
    matHist: [{ nome: x.nome, de: x.com || null, para: para || null, em: agora }].concat(h).slice(0, HIST_MAX),
  };
}

export const remover = (mat: unknown, id: string): Item[] => itens(mat).filter(x => x.id !== id);
