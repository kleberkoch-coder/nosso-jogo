/* Tirar o fundo liso da foto do jogador (KAN-301, pelada-v127), sem IA e sem servidor. Regra pura: recebe os pixels
   (RGBA) e devolve a nova transparência (alfa) de cada pixel, ou o motivo de não mexer.
   Só apaga o fundo que encosta nas bordas da foto e é claro e sem cor (parede clara, fundo de estúdio, o quadriculado
   branco e cinza que sobra de apps de recorte). Foto de quadra (grade, gente, luzes) fica como está. */

export type Resultado = { alfa: Uint8ClampedArray; tirados: number } | 'variado' | 'jaSemFundo' | 'nada';

/* Claro e quase sem cor (o branco e o cinza claro do quadriculado entram), ou já transparente. */
const LIMITE_CLARO = 190,
  LIMITE_COR = 14;
function ehFundo(d: Uint8ClampedArray, i: number) {
  if (d[i + 3]! < 250) return true;
  const r = d[i]!,
    g = d[i + 1]!,
    b = d[i + 2]!;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b);
  return mn >= LIMITE_CLARO && mx - mn <= LIMITE_COR;
}

export function fundoLiso(d: Uint8ClampedArray, w: number, h: number): Resultado {
  const n = w * h;
  if (!w || !h || d.length < n * 4) return 'nada';
  /* As bordas: precisam ser quase todas fundo claro. Se a maior parte já é transparente, a foto já vem recortada. */
  let borda = 0,
    claras = 0,
    transp = 0;
  const conta = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    borda++;
    if (d[i + 3]! < 250) transp++;
    if (ehFundo(d, i)) claras++;
  };
  for (let x = 0; x < w; x++) {
    conta(x, 0);
    conta(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    conta(0, y);
    conta(w - 1, y);
  }
  if (transp / borda > 0.5) return 'jaSemFundo';
  if (claras / borda < 0.6) return 'variado';
  /* Preenche a partir das bordas, só por pixels de fundo. */
  const fundo = new Uint8Array(n),
    fila = new Int32Array(n);
  let ini = 0,
    fim = 0;
  const marcar = (p: number) => {
    if (fundo[p] || !ehFundo(d, p * 4)) return;
    fundo[p] = 1;
    fila[fim++] = p;
  };
  for (let x = 0; x < w; x++) {
    marcar(x);
    marcar((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    marcar(y * w);
    marcar(y * w + w - 1);
  }
  while (ini < fim) {
    const p = fila[ini++]!,
      x = p % w;
    if (x > 0) marcar(p - 1);
    if (x < w - 1) marcar(p + 1);
    if (p >= w) marcar(p - w);
    if (p < n - w) marcar(p + w);
  }
  if (fim < n * 0.03) return 'nada';
  /* Alfa: 0 no fundo; a borda da pessoa (vizinha do fundo) fica meio transparente, para não serrilhar. */
  const alfa = new Uint8ClampedArray(n);
  for (let p = 0; p < n; p++) {
    if (fundo[p]) continue;
    const x = p % w;
    const vizinho =
      (x > 0 && fundo[p - 1]) || (x < w - 1 && fundo[p + 1]) || (p >= w && fundo[p - w]) || (p < n - w && fundo[p + w]);
    alfa[p] = Math.min(d[p * 4 + 3]!, vizinho ? 150 : 255);
  }
  return { alfa, tirados: fim };
}
