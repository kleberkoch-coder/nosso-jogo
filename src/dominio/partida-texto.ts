/* Quem marcou numa partida, em texto (KAN-249 e KAN-66, pelada-v107). Regra pura, testada em
   testes/regras/partida-texto.test.mjs. Usada na linha da partida (aba Partida, Histórico, link) e na mensagem do
   WhatsApp: "Marcão (Caio), Japa, Léo (3, Caio)". Entre parênteses, os pontos (quando o ponto vale mais de 1) e
   quem deu a assistência. Gol contra não entra; a assistência do próprio autor é ignorada. */
export type GolTexto = { pid?: string | null; og?: boolean; pts?: number; as?: string | null };

export const assistenciaValida = (g: GolTexto) => !!(g.as && g.pid && !g.og && g.as !== g.pid);

export function autoresTexto(goals: GolTexto[] | null | undefined, nome: (pid: string) => string): string {
  return (goals || [])
    .filter(g => g.pid && !g.og)
    .map(g => {
      const extra = [(g.pts || 1) > 1 ? String(g.pts) : '', assistenciaValida(g) ? nome(g.as as string) : '']
        .filter(Boolean)
        .join(', ');
      return nome(g.pid as string) + (extra ? ' (' + extra + ')' : '');
    })
    .join(', ');
}

/* Assistências por jogador numa lista de partidas (uma por ponto com assistência, não pelos pontos). */
export function assistencias(ms: { goals?: GolTexto[] | null }[]): Record<string, number> {
  const out: Record<string, number> = {};
  ms.forEach(m =>
    (m.goals || []).forEach(g => {
      if (assistenciaValida(g)) out[g.as as string] = (out[g.as as string] || 0) + 1;
    })
  );
  return out;
}
