/* Liga a regra do sorteio (dominio/sorteio-regra.ts, pura e testada) aos dados do grupo: notas, posições, pares
   separados e as rodadas anteriores. */
import { posKeys, sport } from './esportes.js';
import { lvl, ppos, rat, rodadas } from './grupo.js';
import { historico, qualidade, sortear } from './sorteio-regra';

const opcoes = () => ({
  nota: lvl,
  pos: ppos,
  posicoes: posKeys(),
  chave: sport().key,
  separados: rat().sep || [],
});

function history(exclude) {
  return historico(rodadas().filter(r => r.id !== exclude));
}
function draw(pids, n, novelty, rid) {
  return sortear(pids, n, Object.assign(opcoes(), { historico: history(rid), variar: novelty }));
}
function quality(r) {
  if (!r.times) return null;
  const prev = rodadas().filter(x => x.id !== r.id && x.times && (x.date || '') <= (r.date || '9'))[0];
  return qualidade(r.times, opcoes(), prev ? prev.times : null);
}

export { draw, history, quality };
