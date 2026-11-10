/* Resultado da votação para fora do app (KAN-231): os mais votados de cada categoria (WhatsApp) e a planilha de
   "Quem votou". Regra pura; fica fora de dominio/votacao.ts para não pesar no link do jogador. */
import type { Categoria } from './votacao';
import type { LinhaAuditoria } from './votacao-contagem';

/* KAN-231: os mais votados de uma categoria (até n), com os votos; empate na ordem alfabética do nome. */
export function maisVotados(
  r: { counts: Record<string, number> } | undefined,
  nome: (id: string) => string,
  n = 3,
  local = 'pt-BR'
): [string, number][] {
  return Object.entries((r && r.counts) || {})
    .filter(([, k]) => k > 0)
    .sort((a, b) => b[1] - a[1] || nome(a[0]).localeCompare(nome(b[0]), local))
    .slice(0, n);
}

/* KAN-231: a planilha de "Quem votou": cabeçalho e uma linha por aparelho (nome escolhido, cada categoria, hora e
   trocas), na ordem de "Quem votou". Os textos do cabeçalho e a hora formatada vêm de quem chama. */
export function linhasDaPlanilha(
  linhas: LinhaAuditoria[],
  cats: Categoria[],
  nome: (id: string) => string,
  cab: {
    quem: string;
    hora: string;
    trocas: string;
    repetido: string;
    origem?: string;
    rapida?: string;
    link?: string;
  },
  quando: (ms: number) => string
): string[][] {
  return [
    [cab.quem, ...cats.map(c => c.name || c.id), cab.hora, cab.trocas, ...(cab.origem ? [cab.origem] : [])],
    ...linhas.map(l => [
      nome(l.pid) + (l.repetido ? ' (' + cab.repetido + ')' : ''),
      ...cats.map(c => (l.v[c.id] ? nome(l.v[c.id]!) : '')),
      l.quando ? quando(l.quando) : '',
      String(l.trocas.length),
      /* KAN-254: origem do voto, quando quem chama pede a coluna. */
      ...(cab.origem ? [(l.roda ? cab.rapida : cab.link) || ''] : []),
    ]),
  ];
}

/* KAN-237 (pelada-v103): célula que começa com =, +, -, @, tab ou retorno o Excel e o Google Planilhas leem como
   fórmula (um nome como =HYPERLINK(...) viraria um link). Um apóstrofo na frente faz a célula abrir como texto. */
export const semFormula = (c: string) => (/^[=+\-@\t\r]/.test(c) ? "'" + c : c);
/* Texto em CSV: aspas em volta de cada célula (aspas internas dobradas); separador escolhido por quem chama. */
export const emCsv = (rows: string[][], sep: string) =>
  rows.map(r => r.map(c => '"' + semFormula(String(c)).replace(/"/g, '""') + '"').join(sep)).join('\r\n');

/* KAN-257 (pelada-v103): percentual de cada nome sobre os votos da categoria, arredondado (a soma pode dar 99 ou 101). */
export const percentual = (n: number, total: number) => (total > 0 ? Math.round((n * 100) / total) : 0);
export const textoPct = (p: number, local = 'pt-BR') =>
  (p / 100).toLocaleString(local, { style: 'percent', maximumFractionDigits: 0 });

/* KAN-257: quantas pessoas votaram (uma vez cada, mesmo com voto no link e na votação rápida) de quantas podiam
   votar (quem participa). Se aparecer mais gente votando do que a lista (votação antiga, mesmo nome em 2 aparelhos,
   lista vazia), devolve de = null: aí a tela mostra só "N votos". */
export function participacao(
  votos: Record<string, { pid?: string; v?: Record<string, string> } | null | undefined>,
  podem: string[]
): { n: number; de: number | null } {
  const quem = new Set<string>();
  for (const d of Object.values(votos || {})) if (d && d.pid && Object.values(d.v || {}).some(Boolean)) quem.add(d.pid);
  const lista = new Set(podem),
    fora = [...quem].some(p => !lista.has(p));
  return { n: quem.size, de: lista.size && !fora ? lista.size : null };
}
