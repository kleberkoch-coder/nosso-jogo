/* Partes da rodada usadas por várias telas. O cartão de time em texto (teamCard) serve ao Histórico, que ainda monta
   HTML como texto; ele sai quando o Histórico virar componente (KAN-153). Rodada e Partida já são componentes. */
import { tx } from '../i18n/index.js';
import { col, posIdx, posTag, sport, tn } from '../dominio/esportes.js';
import { pname, ppos } from '../dominio/grupo.js';
import { S } from '../nucleo/estado.js';
import { esc } from '../nucleo/util.js';

/* Ao abrir o grupo, as rodadas chegam em duas buscas (próximas e recentes). Até as duas chegarem, a tela espera (KAN-137). */
const rodadasProntas = () => !!(S.loaded.rodF && S.loaded.rodP);
/* KAN-138: com votação na rodada, os times não podem ser sorteados de novo. Com partidas salvas pode, mas o app avisa antes. */
const temVotacao = r => !!r && Object.values(S.vot || {}).some(v => v && v.rid === r.id);
const nPartidas = r => (r && r.np) || 0;
/* Cartão de time só para ver (Histórico). */
function teamCard(t) {
  const c = col(t.c);
  const rs = id => ((t.res || []).includes(id) ? 1 : 0),
    ps = t.players.slice().sort((a, b) => rs(a) - rs(b) || posIdx(ppos(a)) - posIdx(ppos(b)));
  return `<div class="team"><div class="band${c.n === 'Branco' && !sport().pairs ? ' branco' : ''}" style="background:${c.c}"></div><div class="th"><b>${tn(t.c)}</b><span class="tag">${t.players.length}</span></div>
  <ul>${ps.map(id => `<li class="${rs(id) ? 'reserva' : ''}">${posTag(id)}<span class="pn">${esc(pname(id))}${rs(id) ? ` <span class="tag">· ${tx('times.reserva')}</span>` : ''}</span></li>`).join('')}</ul></div>`;
}

export { nPartidas, rodadasProntas, teamCard, temVotacao };
