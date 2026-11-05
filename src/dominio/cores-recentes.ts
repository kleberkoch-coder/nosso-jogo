/* Atalho da cor livre do colete (KAN-235): as cores livres usadas nas últimas rodadas do grupo. Fica num arquivo
   à parte para a janela do colete (gestão) não levar a paleta inteira. */
import { ehCorLivre } from './cores.ts';

/* Cores livres das rodadas, da mais recente para a mais antiga, sem repetir a mesma cor (até n). */
export function recentes(
  rodadas: { date?: string; times?: { c?: unknown }[] | null; cores?: Record<string, unknown> | null }[],
  n = 4
): string[] {
  const vistas = new Set<string>(),
    lista: string[] = [];
  rodadas
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .forEach(r => {
      const cs = [...(r.times || []).map(t => t.c), ...Object.values(r.cores || {})];
      cs.forEach(c => {
        if (!ehCorLivre(c)) return;
        const hex = c.slice(0, 7);
        if (vistas.has(hex) || lista.length >= n) return;
        vistas.add(hex);
        lista.push(c);
      });
    });
  return lista;
}
