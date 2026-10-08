import { col, posIdx, posLabel, posTag, sport, tn } from '../dominio/esportes.js';
import { attendance, curRodada, fmtL, freq, grpAtivo, isAvulso, lvl, lvlTag, players, pname, ppos, rat, rodadas } from '../dominio/grupo.js';
import { hora } from '../dominio/rodadas.js';
import { quality } from '../dominio/sorteio.js';
import { presAlterada } from '../nucleo/edicoes.js';
import { S } from '../nucleo/estado.js';
import { esc, fdate } from '../nucleo/util.js';
import { fixPanel } from './grupo-form.js';

/* ---------- Rodada (admin) ---------- */
function rodadaPicker(r){return `<div class="rsel"><select class="sel" data-c="rid" aria-label="Rodada">${rodadas().map(x=>`<option value="${x.id}" ${x.id===r.id?'selected':''}>${fdate(x.date)}${x.place?' — '+esc(x.place):''}${x.cancelada?' (cancelada)':x.fixo?' · fixo':''}</option>`).join('')}</select><button class="btn" data-a="newRod">Nova rodada</button></div>`}
function vRodada(){
  const r=curRodada();
  if(!r)return `<div class="panel empty"><h2>Nenhuma rodada marcada</h2><p class="muted">${grpAtivo()?(freq()==='fixo'?'Os dias fixos do grupo ainda não foram definidos.':'Este grupo é esporádico: crie a rodada quando marcar o jogo.'):'Grupo inativo.'}</p><div class="row" style="justify-content:center">${freq()==='fixo'?'<button class="btn" data-a="editGroup">Dias e horários do grupo</button>':''}<button class="btn primary" data-a="newRod">Criar rodada</button></div></div>`;
  const a=attendance(),R=rat();
  const li=(id,i)=>`<li><span class="num">${i+1}</span><span class="pn">${esc(pname(id))}${isAvulso(id)?' <span class="tag">· avulso</span>':''}</span>${isAvulso(id)?`<button class="btn sm" data-a="editAvulso" data-p="${id}">Editar</button>`:''}${lvlTag(id)}${posTag(id)}</li>`;
  const q=quality(r),avs=Object.keys(S.pres).filter(isAvulso),alt=Object.keys(S.pres).filter(presAlterada);
  const altTag=id=>presAlterada(id)?' <span class="tag alt" title="Resposta mudada por um aparelho diferente do que respondeu primeiro">· mudado por outro aparelho</span>':'';
  if(r.cancelada)return `<div class="stack">${rodadaPicker(r)}${fixPanel()}<div class="panel empty"><h2>${esc(fdate(r.date))} cancelada</h2><p class="muted">Sem jogo nesta data. O link permanente já mostra a rodada seguinte.</p><button class="btn" data-a="cancelRod">Reativar esta data</button></div></div>`;
  return `<div class="stack">${rodadaPicker(r)}${fixPanel()}
  <div class="panel"><div class="hero-r"><div><h2>${esc(fdate(r.date))}${r.time?' · '+esc(hora(r)):''}</h2><div class="muted">${esc(r.place||'Local a definir')}${r.fixo?' · jogo fixo':''}${r.locked?' · lista fechada':''}</div></div>
    <div class="count">${a.inn.length}<small>confirmados</small></div></div>
    ${alt.length?`<div class="warn-alt"><b>${alt.length===1?'1 resposta foi mudada':alt.length+' respostas foram mudadas'} por outro aparelho:</b> ${alt.map(id=>esc(pname(id))+' ('+(S.pres[id].s==='in'?'vai':'não vai')+')').join(', ')}. Confira com o jogador. Se estiver errado, corrija em Marcar presença.</div>`:''}
    <div class="row" style="margin-top:12px"><button class="btn sm primary" data-a="shareConvite">Mandar link no WhatsApp</button><button class="btn sm" data-a="copyLink">Copiar link</button><button class="btn sm" data-a="editRod">Editar</button>
    <button class="btn sm" data-a="lock">${r.locked?'Reabrir lista':'Fechar lista'}</button>${r.fixo?'<button class="btn sm ghost danger" data-a="cancelRod">Cancelar esta data</button>':'<button class="btn sm ghost danger" data-a="delRod">Excluir</button>'}</div></div>
  <div class="grid2">
    <div class="panel"><h3>Confirmados</h3>${a.inn.length?`<ol class="plist">${a.inn.map(li).join('')}</ol>`:'<p class="muted small">Ninguém confirmou ainda. Mande o link no grupo.</p>'}
      ${a.out.length?`<p class="small muted" style="margin-top:12px">Não vão: ${a.out.map(p=>esc(pname(p))).join(', ')}</p>`:''}</div>
    <div class="panel"><div class="row between"><h3 style="margin:0">Marcar presença</h3><button class="btn sm" data-a="addAvulso">Adicionar avulso</button></div>
      <p class="small muted">Para quem respondeu fora do link.</p>
      <ul class="plist">${players().map(p=>p.id).concat(avs).map(id=>{const s=S.pres[id]?.s;return`<li>${posTag(id)}<span class="pn">${esc(pname(id))}${isAvulso(id)?' <span class="tag">· avulso</span>':''}${altTag(id)}</span><span class="mk"><button class="${s==='in'?'on-in':''}" data-a="mark" data-p="${id}" data-v="in" aria-label="Vai" aria-pressed="${s==='in'}">✓</button><button class="${s==='out'?'on-out':''}" data-a="mark" data-p="${id}" data-v="out" aria-label="Não vai" aria-pressed="${s==='out'}">✕</button></span></li>`}).join('')||'<li class="muted small">Cadastre jogadores na aba Jogadores.</li>'}</ul></div>
  </div>
  <div class="panel"><div class="row between"><h3 style="margin:0">Times</h3><button class="btn bib" data-a="drawDlg" ${a.inn.length>=4?'':'disabled'}>${r.times?'Sortear de novo':'Sortear times'}</button></div>
    ${a.inn.length<4&&!r.times?'<p class="muted small">O sorteio libera com pelo menos 4 confirmados. Quantidade de times é escolhida na hora.</p>':''}
    ${r.times?`<div class="teams" style="margin-top:12px">${r.times.map((t,ti)=>teamCard(t,ti,true)).join('')}</div>
    ${q?`<div class="quality"><span>Diferença de nota média: <b>${fmtL(Math.round(q.diff*10)/10)}</b></span>${q.gk?`<span>${esc(posLabel(sport().key))}s: <b>${q.gk.join(' × ')}</b></span>`:''}${q.nsep?`<span>Separações respeitadas: <b>${q.nsep-q.viol}/${q.nsep}</b></span>`:''}${q.newPct!=null?`<span>Parcerias novas vs. rodada anterior: <b>${q.newPct}%</b></span>`:''}</div>`:''}
    <div class="row" style="margin-top:12px"><button class="btn sm" data-a="shareTimes">Mandar times no WhatsApp</button><button class="btn sm" data-a="tab" data-v="partida">Ir para a partida</button></div>`:''}
  </div></div>`}
function teamCard(t,ti,admin){const R=rat(),c=col(t.c);
  const ps=t.players.slice().sort((a,b)=>posIdx(ppos(a))-posIdx(ppos(b)));
  const avg=t.players.reduce((s,id)=>s+lvl(id),0)/Math.max(1,t.players.length);
  return `<div class="team"><div class="band${c.n==='Branco'&&!sport().pairs?' branco':''}" style="background:${c.c}"></div><div class="th"><b>${tn(t.c)}</b>${admin&&!sport().pairs?`<button class="btn sm ghost" data-a="color" data-v="${ti}">Cor</button>`:`<span class="tag">${t.players.length}</span>`}</div>
  <ul>${ps.map(id=>`<li>${posTag(id)}<span class="pn">${esc(pname(id))}</span>${admin?`<button class="btn sm ghost" data-a="move" data-v="${ti}" data-p="${id}" title="Mover">⇄</button>`:''}</li>`).join('')}</ul>
  ${admin?`<div class="small muted" style="padding:0 14px 12px">Nota média ${fmtL(Math.round(avg*10)/10)}</div>`:''}</div>`}

export { rodadaPicker, teamCard, vRodada };
