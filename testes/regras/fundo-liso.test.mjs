/* KAN-301: tirar o fundo liso da foto, sem IA (regra pura). Roda com: npm run regras */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fundoLiso } from '../../src/dominio/fundo-liso.ts';

/* Imagem w × h com o fundo dado por pixel e uma "pessoa" (retângulo colorido) no meio. */
function imagem(w, h, fundo, pessoa = [200, 40, 40, 255]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4,
        dentro = x >= w * 0.3 && x < w * 0.7 && y >= h * 0.3;
      d.set(dentro ? pessoa : fundo(x, y), i);
    }
  return d;
}
const alfa = (r, w, x, y) => r.alfa[y * w + x];

test('CT-KAN-301-01: fundo cinza claro liso sai; a pessoa fica inteira (encostando na borda de baixo)', () => {
  const w = 60,
    h = 80,
    d = imagem(w, h, () => [246, 246, 246, 255]);
  const r = fundoLiso(d, w, h);
  assert.equal(typeof r, 'object');
  assert.equal(alfa(r, w, 2, 2), 0);
  assert.equal(alfa(r, w, 30, 60), 255);
  assert.equal(alfa(r, w, 30, h - 1), 255);
  assert.ok(alfa(r, w, 18, 60) > 0 && alfa(r, w, 18, 60) < 255, 'borda suave');
});

test('CT-KAN-301-02: o quadriculado branco e cinza gravado na imagem também sai', () => {
  const w = 64,
    h = 64,
    d = imagem(w, h, (x, y) =>
      (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? [255, 255, 255, 255] : [204, 204, 204, 255]
    );
  const r = fundoLiso(d, w, h);
  assert.equal(typeof r, 'object');
  assert.equal(alfa(r, w, 3, 3), 0);
  assert.equal(alfa(r, w, 12, 3), 0);
  assert.equal(alfa(r, w, 32, 50), 255);
});

test('CT-KAN-301-03: fundo variado (foto de quadra) ou escuro não muda nada; foto já sem fundo também não', () => {
  const w = 50,
    h = 50;
  const quadra = imagem(w, h, (x, y) => [(x * 37) % 255, (y * 53) % 255, ((x + y) * 29) % 255, 255]);
  assert.equal(fundoLiso(quadra, w, h), 'variado');
  assert.equal(
    fundoLiso(
      imagem(w, h, () => [20, 60, 140, 255]),
      w,
      h
    ),
    'variado'
  );
  assert.equal(
    fundoLiso(
      imagem(w, h, () => [0, 0, 0, 0]),
      w,
      h
    ),
    'jaSemFundo'
  );
  /* Só um fio de fundo claro na borda: não vale a pena. */
  const W = 200,
    H = 200,
    fio = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const x = i % W,
      borda = x === 0 || x === W - 1 || i < W || i >= W * (H - 1);
    fio.set(borda ? [250, 250, 250, 255] : [200, 40, 40, 255], i * 4);
  }
  assert.equal(fundoLiso(fio, W, H), 'nada');
});
