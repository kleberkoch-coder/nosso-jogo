/* Paleta da cor livre do colete (KAN-235): converte o ponto escolhido (tom, intensidade e claro/escuro, como no
   "Editar cores" do Paint) em "#rrggbb", sugere o nome e o quadradinho do WhatsApp. Vem com a janela da paleta. */

/* Tom (0–360), saturação e luminosidade (0–1) de um "#rrggbb". */
export function hsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16),
    r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255,
    mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2,
    d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)),
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

/* Família da cor, para o quadradinho do WhatsApp e para o nome sugerido. */
export function familia(hex: string): string {
  const [h, s, l] = hsl(hex);
  if (l < 0.16) return 'preto';
  if (l > 0.9 || (s < 0.12 && l > 0.7)) return 'branco';
  if (s < 0.12) return 'cinza';
  if (h < 15 || h >= 340) return l < 0.32 ? 'vinho' : 'vermelho';
  if (h < 45) return l < 0.38 ? 'marrom' : 'laranja';
  if (h < 70) return l < 0.3 ? 'marrom' : 'amarelo';
  if (h < 165) return 'verde';
  if (h < 200) return 'turquesa';
  if (h < 255) return l < 0.36 ? 'marinho' : 'azul';
  if (h < 290) return 'roxo';
  return l < 0.35 ? 'roxo' : 'rosa';
}
const EMOJI: Record<string, string> = {
  preto: '⬛',
  branco: '⬜',
  cinza: '⬜',
  vinho: '🟥',
  vermelho: '🟥',
  marrom: '🟫',
  laranja: '🟧',
  amarelo: '🟨',
  verde: '🟩',
  turquesa: '🟦',
  marinho: '🟦',
  azul: '🟦',
  roxo: '🟪',
  rosa: '🟪',
};
export const emojiDaCor = (hex: string) => EMOJI[familia(hex)] || '⬜';

/* O valor gravado: "#rrggbb|quadradinho|Nome" (nome sem "|", até 20 letras). */
export const corLivre = (hex: string, nome: string) =>
  hex.toLowerCase() + '|' + emojiDaCor(hex) + '|' + nome.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20);

/* HSV (tom 0–360, intensidade e brilho 0–1) para "#rrggbb". */
export function hsvParaHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6,
      x = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return '#' + f(5) + f(3) + f(1);
}
