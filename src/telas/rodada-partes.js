/* Partes da rodada usadas por várias telas (Rodada, Partida e as ações da rodada). O cartão de time em texto saiu
   quando o Histórico virou componente (KAN-218). */
import { S } from '../nucleo/estado.js';

/* Ao abrir o grupo, as rodadas chegam em duas buscas (próximas e recentes). Até as duas chegarem, a tela espera (KAN-137). */
const rodadasProntas = () => !!(S.loaded.rodF && S.loaded.rodP);
/* KAN-138: com votação na rodada, os times não podem ser sorteados de novo. Com partidas salvas pode, mas o app avisa antes. */
const temVotacao = r => !!r && Object.values(S.vot || {}).some(v => v && v.rid === r.id);
const nPartidas = r => (r && r.np) || 0;
export { nPartidas, rodadasProntas, temVotacao };
