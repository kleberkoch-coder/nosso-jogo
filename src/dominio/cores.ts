/* Cor de colete livre (KAN-235). As 8 cores de sempre são números (0 a 7, COL em dominio/esportes.js); uma cor
   escolhida na paleta é o texto "#rrggbb|quadradinho|Nome" (o quadradinho do WhatsApp, ex.: 🟪, e o nome que a
   pessoa confirmou, ex.: "Rosa"). O mesmo valor vai para o time da rodada (cores.{i}) e para a partida salva
   (ca, cb), então tudo que já compara cores continua igual. Fica pequena porque também vai no link do jogador; a
   paleta, o nome sugerido e o quadradinho ficam em dominio/cores-paleta.ts. Regra com teste (regras/cores). */
export type Cor = { n: string; c: string; e: string; livre?: boolean };

export const ehCorLivre = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}\|/i.test(c);

/* Lê uma cor livre: nome, "#rrggbb" e o quadradinho do WhatsApp. */
export function lerCorLivre(c: string): Cor {
  const [hex, e, ...n] = c.split('|');
  return { n: n.join(' ') || hex!, c: hex!, e: e || '⬜', livre: true };
}

/* Cor clara pede borda (a bolinha e a faixa somem no fundo claro): luminosidade acima de 82%. */
export function clara(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16),
    v = [n >> 16, (n >> 8) & 255, n & 255];
  return (Math.max(...v) + Math.min(...v)) / 510 > 0.82;
}
