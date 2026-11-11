/* Valores do caixa que o link e a gestão leem. O que grava (editPc e as migrações) fica em caixa-gestao.ts, que vem
   só com a gestão (KAN-262). */
import { S } from '../nucleo/estado.js';

function cfg() {
  const p = S.pc || {},
    x = {};
  CAIXA_K.forEach(k => {
    if (p[k] != null) x[k] = p[k];
  });
  return Object.assign(
    { mensal: 80, diaria: 20, minutes: 10, pix: '', novelty: 2, place: '', time: '09:00' },
    (S.app || {}).cfg || {},
    x
  );
}
/* Valores, chave Pix, tipo (mensalista/diarista/isento) e quem recebe por jogo ficam em privado/caixa, só para administradores. */
const CAIXA_K = ['mensal', 'diaria', 'pix'];
function ptipo(id) {
  const t = ((S.pc || {}).tipos || {})[id];
  return t || S.jog[id]?.tipo || 'mensalista';
}
/* Quem recebe por jogo (KAN-172): { v: valor, desde: data em que passou a receber }. */
function recebePorJogo(id) {
  const r = ((S.pc || {}).porJogo || {})[id];
  return r && +r.v > 0 ? r : null;
}
/* Primeiro dia em que alguém passou a receber por jogo: o Caixa carrega as rodadas a partir dele (KAN-172). */
function inicioAPagar() {
  const ds = Object.values((S.pc || {}).porJogo || {})
    .filter(r => r && +r.v > 0)
    .map(r => r.desde || '2000-01-01')
    .sort();
  return ds[0] || null;
}
export { CAIXA_K, cfg, inicioAPagar, ptipo, recebePorJogo };
