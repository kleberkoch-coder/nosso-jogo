/* Confirmados por posição (KAN-179): quantos de cada posição vão e quantos faltam para o mínimo que o grupo
   definiu (ex.: 2 goleiros). Ajuda a decidir se precisa chamar alguém de fora antes do jogo.
   As posições vêm do esporte do grupo e das posições criadas pelo grupo, nunca fixas no código. */
/* Chave do mínimo total; não colide com sigla de posição (siglas são só letras e números). */
export const TOTAL = '_total';
export type PorPosicao = { k: string; n: number; min: number; falta: number };

/* Mínimo aceito por posição: inteiro de 0 a 99; o resto é ignorado. */
export function minimoValido(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 0;
}

/* Limpa o que vai para o grupo: só posições que existem e com mínimo maior que zero. */
export function limparMinimos(chaves: string[], m: Record<string, unknown>): Record<string, number> {
  const o: Record<string, number> = {};
  chaves.concat(TOTAL).forEach(k => {
    const n = minimoValido(m[k]);
    if (n) o[k] = n;
  });
  return o;
}

/* Contagem na ordem das posições do grupo. Aparece a posição com alguém confirmado ou com mínimo definido. */
export function porPosicao(
  chaves: string[],
  confirmados: string[],
  posDe: (id: string) => string,
  minimos: Record<string, unknown> = {}
): PorPosicao[] {
  const n: Record<string, number> = {};
  confirmados.forEach(id => {
    const k = posDe(id);
    if (k) n[k] = (n[k] || 0) + 1;
  });
  return chaves
    .map(k => {
      const min = minimoValido(minimos[k]),
        q = n[k] || 0;
      return { k, n: q, min, falta: Math.max(0, min - q) };
    })
    .filter(x => x.n || x.min);
}

/* Mínimo total de jogadores (o quórum do jogo), para qualquer esporte, com ou sem posição. */
export function faltaTotal(confirmados: number, minimos: Record<string, unknown> = {}): { min: number; falta: number } {
  const min = minimoValido(minimos[TOTAL]);
  return { min, falta: Math.max(0, min - confirmados) };
}
