/* Resultado da votação para fora do app (KAN-231): os mais votados de cada categoria (WhatsApp) e a planilha de
   "Quem votou". Regra pura; fica fora de dominio/votacao.ts para não pesar no link do jogador. */
import type { Categoria, LinhaAuditoria } from './votacao';

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
  cab: { quem: string; hora: string; trocas: string; repetido: string },
  quando: (ms: number) => string
): string[][] {
  return [
    [cab.quem, ...cats.map(c => c.name || c.id), cab.hora, cab.trocas],
    ...linhas.map(l => [
      nome(l.pid) + (l.repetido ? ' (' + cab.repetido + ')' : ''),
      ...cats.map(c => (l.v[c.id] ? nome(l.v[c.id]!) : '')),
      l.quando ? quando(l.quando) : '',
      String(l.trocas.length),
    ]),
  ];
}

/* Texto em CSV: aspas em volta de cada célula (aspas internas dobradas); separador escolhido por quem chama. */
export const emCsv = (rows: string[][], sep: string) =>
  rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(sep)).join('\r\n');
