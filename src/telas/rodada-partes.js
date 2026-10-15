/* Partes da rodada usadas pelas telas que ainda montam HTML como texto (Partida e Histórico).
   A aba Rodada já é componente (telas/Rodada.tsx); estas versões em texto saem quando Partida e Histórico migrarem (KAN-153). */
import { tx } from '../i18n/index.js';
import { col, posIdx, posTag, sport, tn } from '../dominio/esportes.js';
import { pname, ppos, rodadasJanela } from '../dominio/grupo.js';
import { hora } from '../dominio/rodadas.js';
import { S } from '../nucleo/estado.js';
import { esc, fdate } from '../nucleo/util.js';

/* Seletor da rodada (D10): as próximas e as últimas 4. As mais antigas ficam na aba Histórico. */
function rodadaPicker(r){const rs=rodadasJanela();if(r&&!rs.some(x=>x.id===r.id))rs.push(r);
  return `<div class="rsel"><select class="sel" data-c="rid" aria-label="${tx('rodada.seletor')}">${rs.map(x=>`<option value="${x.id}" ${x.id===r.id?'selected':''}>${fdate(x.date)}${x.time?' · '+esc(hora(x)):''}${x.cancelada?' '+tx('rodada.canceladaOpcao'):x.fixo?' · '+tx('rodada.fixoOpcao'):''}</option>`).join('')}</select><button class="btn" data-a="newRod">${tx('rodada.nova')}</button><button class="btn ghost" data-a="tab" data-v="historico">${tx('hist.atalho')}</button></div>`}
/* Ao abrir o grupo, as rodadas chegam em duas buscas (próximas e recentes). Até as duas chegarem, a tela espera (KAN-137). */
const rodadasProntas=()=>!!(S.loaded.rodF&&S.loaded.rodP);
/* KAN-138: com votação na rodada, os times não podem ser sorteados de novo. Com partidas salvas pode, mas o app avisa antes. */
const temVotacao=r=>!!r&&Object.values(S.vot||{}).some(v=>v&&v.rid===r.id);
const nPartidas=r=>(r&&r.np)||0;
/* Cartão de time só para ver (Histórico). */
function teamCard(t){const c=col(t.c);
  const rs=id=>(t.res||[]).includes(id)?1:0,ps=t.players.slice().sort((a,b)=>rs(a)-rs(b)||posIdx(ppos(a))-posIdx(ppos(b)));
  return `<div class="team"><div class="band${c.n==='Branco'&&!sport().pairs?' branco':''}" style="background:${c.c}"></div><div class="th"><b>${tn(t.c)}</b><span class="tag">${t.players.length}</span></div>
  <ul>${ps.map(id=>`<li class="${rs(id)?'reserva':''}">${posTag(id)}<span class="pn">${esc(pname(id))}${rs(id)?` <span class="tag">· ${tx('times.reserva')}</span>`:''}</span></li>`).join('')}</ul></div>`}

export { nPartidas, rodadaPicker, rodadasProntas, teamCard, temVotacao };
