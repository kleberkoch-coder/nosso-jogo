/* Jogadores por time e reservas (pelada-v16).
   Regra pura: não lê o estado do app nem o banco, por isso tem teste próprio em testes/regras/.

   Cada grupo define quantos jogadores tem um time (padrão do esporte; 2 = duplas).
   No sorteio o administrador escolhe quantos times; os sorteados são divididos por igual.
   Se um time ficar com mais gente que o tamanho do time, o excedente fica como reserva:
   quem confirmou por último naquele time. Ex.: 16 sorteados, 5 por time, 3 times → 6, 5 e 5,
   e no time de 6 uma pessoa é reserva. */

export type TimeSorteado = { c: number; players: string[]; res?: string[] };

/* Tamanhos dos times: o mais igual possível (16 em 3 → 6, 5, 5). */
export function tamanhos(total: number, times: number): number[] {
  return Array.from({ length: times }, (_, i) => Math.floor(total / times) + (i < total % times ? 1 : 0));
}

/* Quantos times sugerir: o que cabe com times completos, entre 2 e o máximo. */
export function sugerirTimes(total: number, porTime: number, max = 6): number {
  const n = Math.floor(total / Math.max(1, porTime));
  return Math.max(2, Math.min(max, n, Math.floor(total / 2) || 2));
}

/* Quem fica de reserva num time: o excedente, escolhendo quem confirmou por último. */
export function reservas(players: string[], porTime: number, confirmouEm: (id: string) => number): string[] {
  const extra = players.length - porTime;
  if (extra <= 0) return [];
  return players.slice().sort((a, b) => confirmouEm(b) - confirmouEm(a)).slice(0, extra);
}

/* Titulares (sem os reservas). */
export function titulares(t: TimeSorteado): string[] {
  const r = new Set(t.res || []);
  return t.players.filter(id => !r.has(id));
}

/* Texto da prévia do sorteio: "16 jogadores → 3 times (5 por time + 1 reserva)". */
export function resumo(total: number, times: number, porTime: number): { completos: boolean; porTimeReal: number[]; reservas: number } {
  const tz = tamanhos(total, times);
  const reservas = tz.reduce((s, x) => s + Math.max(0, x - porTime), 0);
  return { completos: tz.every(x => x >= porTime), porTimeReal: tz, reservas };
}
