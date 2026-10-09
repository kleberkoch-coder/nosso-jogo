import { tx } from '../i18n/index.js';
import { divergencia } from '../dominio/divergencia.ts';
import { avulsosEsgotados, limite } from '../dominio/limites.ts';
import { col, posIdx, posLabel, posTag, sport, tn } from '../dominio/esportes.js';
import { attendance, curRodada, fmtL, freq, grpAtivo, isAvulso, lvl, lvlTag, players, pname, ppos, rat, rodadas, rodadasJanela } from '../dominio/grupo.js';
import { hora } from '../dominio/rodadas.js';
import { quality } from '../dominio/sorteio.js';
import { presAlterada } from '../nucleo/edicoes.js';
import { S } from '../nucleo/estado.js';
import { esc, fdate } from '../nucleo/util.js';
import { fixPanel } from './grupo-form.js';

/* ---------- Rodada (admin) ---------- */
/* Seletor da aba Rodada (D10): as próximas e as últimas 4. As mais antigas ficam na aba Histórico. */
function rodadaPicker(r){const rs=rodadasJanela();if(r&&!rs.some(x=>x.id===r.id))rs.push(r);
  return `<div class="rsel"><select class="sel" data-c="rid" aria-label="Rodada">${rs.map(x=>`<option value="${x.id}" ${x.id===r.id?'selected':''}>${fdate(x.date)}${x.place?' — '+esc(x.place):''}${x.cancelada?' (cancelada)':x.fixo?' · fixo':''}</option>`).join('')}</select><button class="btn" data-a="newRod">Nova rodada</button><button class="btn ghost" data-a="tab" data-v="historico">${tx('hist.atalho')}</button></div>`}
function vRodada(){
  const r=curRodada();
  if(!r)return `<div class="panel empty"><h2>Nenhuma rodada marcada</h2><p class="muted">${grpAtivo()?(freq()==='fixo'?'Os dias fixos do grupo ainda não foram definidos.':'Este grupo é esporádico: crie a rodada quando marcar o jogo.'):'Grupo inativo.'}</p><div class="row" style="justify-content:center">${freq()==='fixo'?'<button class="btn" data-a="editGroup">Dias e horários do grupo</button>':''}<button class="btn primary" data-a="newRod">Criar rodada</button></div></div>`;
  const a=attendance(),R=rat(),carregou=S.presRid===r.id&&!!S.loaded.pres;
  const li=(id,i)=>`<li><span class="num">${i+1}</span><span class="pn">${esc(pname(id))}${isAvulso(id)?' <span class="tag">· avulso</span>':''}</span>${isAvulso(id)?`<button class="btn sm" data-a="editAvulso" data-p="${id}">Editar</button>`:''}${lvlTag(id)}${posTag(id)}</li>`;
  const q=quality(r),avs=Object.keys(S.pres).filter(isAvulso),alt=Object.keys(S.pres).filter(presAlterada);
  const altTag=id=>presAlterada(id)?' <span class="tag alt" title="Resposta mudada por um aparelho diferente do que respondeu primeiro">· mudado por outro aparelho</span>':'';
  if(r.cancelada)return `<div class="stack">${rodadaPicker(r)}${fixPanel()}<div class="panel empty"><h2>${esc(fdate(r.date))} cancelada</h2><p class="muted">Sem jogo nesta data. O link permanente já mostra a rodada seguinte.</p><button class="btn" data-a="cancelRod">Reativar esta data</button></div></div>`;
  return `<div class="stack">${rodadaPicker(r)}${fixPanel()}
  <div class="panel"><div class="hero-r"><div><h2>${esc(fdate(r.date))}${r.time?' · '+esc(hora(r)):''}</h2><div class="muted">${esc(r.place||'Local a definir')}${r.fixo?' · jogo fixo':''}${r.locked?' · lista fechada':''}</div></div>
    <div class="count">${carregou?a.inn.length:'…'}<small>confirmados</small></div></div>
    ${vDivergencia(r)}
    ${alt.length?`<div class="warn-alt"><b>${alt.length===1?'1 resposta foi mudada':alt.length+' respostas foram mudadas'} por outro aparelho:</b> ${alt.map(id=>esc(pname(id))+' ('+(S.pres[id].s==='in'?'vai':'não vai')+')').join(', ')}. Confira com o jogador. Se estiver errado, corrija em Marcar presença.</div>`:''}
    <div class="row" style="margin-top:12px"><button class="btn sm primary" data-a="shareConvite">Mandar link no WhatsApp</button><button class="btn sm" data-a="copyLink">Copiar link</button><button class="btn sm" data-a="editRod">Editar</button>
    <button class="btn sm" data-a="lock">${r.locked?'Reabrir lista':'Fechar lista'}</button>${r.fixo?'<button class="btn sm ghost danger" data-a="cancelRod">Cancelar esta data</button>':'<button class="btn sm ghost danger" data-a="delRod">Excluir</button>'}</div></div>
  <div class="grid2">
    <div class="panel"><h3>Confirmados</h3>${!carregou?`<p class="muted small">${tx('comum.carregando')}</p>`:a.inn.length?`<ol class="plist">${a.inn.map(li).join('')}</ol>`:'<p class="muted small">Ninguém confirmou ainda. Mande o link no grupo.</p>'}
      ${a.out.length?`<p class="small muted" style="margin-top:12px">Não vão: ${a.out.map(p=>esc(pname(p))).join(', ')}</p>`:''}</div>
    <div class="panel"><div class="row between"><h3 style="margin:0">Marcar presença</h3>${r.locked?'':'<button class="btn sm" data-a="addAvulso">Adicionar avulso</button>'}</div>
      ${!r.locked&&avulsosEsgotados(S.limAv,S.limCfg)?`<div class="warn-alt aviso-limite" role="status">${tx('limite.avulsosAdmin',{n:limite(S.limCfg,'avulsosPorRodada')})}</div>`:''}
      ${r.locked?`<p class="small muted lista-fechada">${tx(r.times?(sport().pairs?'lista.fechadaComTimesDuplas':'lista.fechadaComTimes'):'lista.fechadaAviso')}</p>`:'<p class="small muted">Para quem respondeu fora do link.</p>'}
      <ul class="plist">${players().map(p=>p.id).concat(avs).map(id=>{const s=S.pres[id]?.s;return`<li>${posTag(id)}<span class="pn">${esc(pname(id))}${isAvulso(id)?' <span class="tag">· avulso</span>':''}${altTag(id)}</span>${r.locked?`<span class="tag" style="color:${s==='in'?'var(--in)':s==='out'?'var(--out)':''}">${s==='in'?tx('publico.vai'):s==='out'?tx('publico.naoVai'):'—'}</span>`:`<span class="mk"><button class="${s==='in'?'on-in':''}" data-a="mark" data-p="${id}" data-v="in" aria-label="Vai" aria-pressed="${s==='in'}">✓</button><button class="${s==='out'?'on-out':''}" data-a="mark" data-p="${id}" data-v="out" aria-label="Não vai" aria-pressed="${s==='out'}">✕</button></span>`}</li>`}).join('')||'<li class="muted small">Cadastre jogadores na aba Jogadores.</li>'}</ul></div>
  </div>
  <div class="panel"><div class="row between"><h3 style="margin:0">Times</h3><button class="btn bib" data-a="drawDlg" ${a.inn.length>=4?'':'disabled'}>${r.times?'Sortear de novo':'Sortear times'}</button></div>
    ${a.inn.length<4&&!r.times?'<p class="muted small">O sorteio libera com pelo menos 4 confirmados. Quantidade de times é escolhida na hora.</p>':''}
    ${r.times?`<div class="teams" style="margin-top:12px">${r.times.map((t,ti)=>teamCard(t,ti,true)).join('')}</div>
    ${q?`<div class="quality"><span>Diferença de nota média: <b>${fmtL(Math.round(q.diff*10)/10)}</b></span>${q.gk?`<span>${esc(posLabel(sport().key))}s: <b>${q.gk.join(' × ')}</b></span>`:''}${q.nsep?`<span>Separações respeitadas: <b>${q.nsep-q.viol}/${q.nsep}</b></span>`:''}${q.newPct!=null?`<span>Parcerias novas vs. rodada anterior: <b>${q.newPct}%</b></span>`:''}</div>`:''}
    <div class="row" style="margin-top:12px"><button class="btn sm" data-a="shareTimes">Mandar times no WhatsApp</button><button class="btn sm" data-a="tab" data-v="partida">Ir para a partida</button></div>`:''}
  </div></div>`}
function teamCard(t,ti,admin){const R=rat(),c=col(t.c);
  const rs=id=>(t.res||[]).includes(id)?1:0,ps=t.players.slice().sort((a,b)=>rs(a)-rs(b)||posIdx(ppos(a))-posIdx(ppos(b)));
  const avg=t.players.reduce((s,id)=>s+lvl(id),0)/Math.max(1,t.players.length);
  return `<div class="team"><div class="band${c.n==='Branco'&&!sport().pairs?' branco':''}" style="background:${c.c}"></div><div class="th"><b>${tn(t.c)}</b>${admin&&!sport().pairs?`<button class="btn sm ghost" data-a="color" data-v="${ti}">Cor</button>`:`<span class="tag">${t.players.length}</span>`}</div>
  <ul>${ps.map(id=>`<li class="${rs(id)?'reserva':''}">${posTag(id)}<span class="pn">${esc(pname(id))}${rs(id)?` <span class="tag">· ${tx('times.reserva')}</span>`:''}</span>${admin?`<button class="btn sm ghost" data-a="move" data-v="${ti}" data-p="${id}" title="Mover">⇄</button>`:''}</li>`).join('')}</ul>
  ${admin?`<div class="row between small muted" style="padding:0 14px 12px"><span>Nota média ${fmtL(Math.round(avg*10)/10)}</span>${sport().pairs?'':`<button class="btn sm ghost" data-a="porTime" data-v="${ti}">${tx('porTime.botao')}</button>`}</div>`:''}</div>`}

/* Aviso de lista diferente dos times (pelada-v15). Some sozinho quando a lista e os times voltam a bater. */
function vDivergencia(r){const d=divergencia(r,S.pres);if(!d.saiu.length&&!d.entrou.length)return '';
  const pares=!!sport().pairs,b=(a,id,t)=>pares?'':`<button class="btn sm" data-a="${a}" data-p="${id}">${t}</button>`;
  const linha=(txt,btn)=>`<li><span class="pn">${txt}</span>${btn}</li>`;
  return `<div class="warn-alt warn-div" role="status"><b>${tx('div.titulo')}</b> ${tx(pares?'div.ajudaDuplas':'div.ajuda')}
    <ul class="plist wrap" style="margin:8px 0">${d.saiu.map(id=>linha(tx('div.naoVaiMais',{nome:esc(pname(id))}),b('divTirar',id,tx('div.tirar')))).join('')}${d.entrou.map(id=>linha(tx('div.confirmouDepois',{nome:esc(pname(id))}),b('divPor',id,tx('div.por')))).join('')}</ul>
    <div class="row"><button class="btn sm bib" data-a="drawDlg">${tx('div.sortearDeNovo')}</button><button class="btn sm" data-a="divManter">${tx('div.manter')}</button></div></div>`}

export { rodadaPicker, teamCard, vRodada };
