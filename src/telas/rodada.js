import { tp, tx } from '../i18n/index.js';
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
  ${vPresenca(r,a,carregou,avs,altTag)}
  <div class="panel"><div class="row between"><h3 style="margin:0" id="timesTit" tabindex="-1">Times</h3>${r.times?`<button class="btn bib" data-a="drawDlg" ${a.inn.length>=4?'':'disabled'}>Sortear de novo</button>`:''}</div>
    ${!r.times?`<p class="muted small" style="margin-bottom:0">${tx(a.inn.length<4?'rodada.timesAjuda':'rodada.timesPronto')}</p>`:''}
    ${r.times?`<div class="teams" style="margin-top:12px">${r.times.map((t,ti)=>teamCard(t,ti,true)).join('')}</div>
    ${q?`<div class="quality"><span>Diferença de nota média: <b>${fmtL(Math.round(q.diff*10)/10)}</b></span>${q.gk?`<span>${esc(posLabel(sport().key))}s: <b>${q.gk.join(' × ')}</b></span>`:''}${q.nsep?`<span>Separações respeitadas: <b>${q.nsep-q.viol}/${q.nsep}</b></span>`:''}${q.newPct!=null?`<span>Parcerias novas vs. rodada anterior: <b>${q.newPct}%</b></span>`:''}</div>`:''}
    <div class="row" style="margin-top:12px"><button class="btn sm" data-a="shareTimes">Mandar times no WhatsApp</button><button class="btn sm" data-a="tab" data-v="partida">Ir para a partida</button></div>`:''}
  </div>
  ${r.times?'':barraSortear(a.inn.length)}</div>`}

/* KAN-71: barra fixa no rodapé com a ação que o organizador veio fazer. Sai quando os times já foram sorteados
   (aí "Sortear de novo" fica no painel dos times, para não convidar a sortear outra vez sem querer). */
function barraSortear(k){const falta=Math.max(0,4-k),txt=sport().pairs?'Sortear duplas':'Sortear times';
  return `<div class="acao-fixa"><button class="btn bib" data-a="drawDlg" ${falta?'disabled':''}>${falta?tp('rodada.faltam',falta):`${txt} (${k})`}</button></div>`}

/* KAN-71: uma lista só de presença, com filtros. Em "Vão", a ordem é a de chegada (numerada). */
const FILTROS=[['todos','Todos'],['in','Vão'],['out','Não vão'],['sem','Sem resposta']];
function vPresenca(r,a,carregou,avs,altTag){
  const ids=[...new Set(players().map(p=>p.id).concat(avs))],f=FILTROS.some(x=>x[0]===S.presFiltro)?S.presFiltro:'todos';
  const st=id=>S.pres[id]?.s,cont={todos:ids.length,in:a.inn.length,out:ids.filter(id=>st(id)==='out').length,sem:ids.filter(id=>!st(id)).length};
  const vis=f==='in'?a.inn:f==='todos'?ids:ids.filter(id=>f==='out'?st(id)==='out':!st(id));
  const linha=(id,i)=>{const s=st(id);return `<li>${f==='in'?`<span class="num">${i+1}</span>`:''}${posTag(id)}<span class="pn">${esc(pname(id))}${isAvulso(id)?' <span class="tag">· avulso</span>':''}${altTag(id)}</span>${isAvulso(id)&&s==='in'?`<button class="btn sm" data-a="editAvulso" data-p="${id}">Editar</button>`:''}${lvlTag(id)}${r.locked?`<span class="tag" style="color:${s==='in'?'var(--in)':s==='out'?'var(--out)':''}">${s==='in'?tx('publico.vai'):s==='out'?tx('publico.naoVai'):'—'}</span>`:`<span class="mk"><button class="${s==='in'?'on-in':''}" data-a="mark" data-p="${id}" data-v="in" aria-label="${esc(pname(id))} vai" aria-pressed="${s==='in'}">✓</button><button class="${s==='out'?'on-out':''}" data-a="mark" data-p="${id}" data-v="out" aria-label="${esc(pname(id))} não vai" aria-pressed="${s==='out'}">✕</button></span>`}</li>`};
  const vazio=!carregou?tx('comum.carregando'):!ids.length?'Cadastre jogadores na aba Jogadores.':f==='in'?'Ninguém confirmou ainda. Mande o link no grupo.':f==='out'?'Ninguém disse que não vai.':f==='sem'?'Todo mundo já respondeu.':'';
  return `<div class="panel" id="presPainel"><div class="row between"><h3 style="margin:0">Presença</h3>${r.locked?'':'<button class="btn sm" data-a="addAvulso">Adicionar avulso</button>'}</div>
    ${!r.locked&&avulsosEsgotados(S.limAv,S.limCfg)?`<div class="warn-alt aviso-limite" role="status">${tx('limite.avulsosAdmin',{n:limite(S.limCfg,'avulsosPorRodada')})}</div>`:''}
    ${r.locked?`<p class="small muted lista-fechada">${tx(r.times?(sport().pairs?'lista.fechadaComTimesDuplas':'lista.fechadaComTimes'):'lista.fechadaAviso')}</p>`:''}
    <div class="seg seg-filtro" role="group" aria-label="Mostrar">${FILTROS.map(([k,l])=>`<button data-a="presFiltro" data-v="${k}" aria-pressed="${f===k}">${l} <span class="n">${carregou||k==='todos'?cont[k]:'…'}</span></button>`).join('')}</div>
    ${carregou&&!a.inn.length&&f!=='in'&&ids.length?'<p class="small muted" style="margin:10px 0 0">Ninguém confirmou ainda. Mande o link no grupo.</p>':''}
    <${f==='in'?'ol':'ul'} class="plist" id="presLista">${carregou?vis.map(linha).join(''):''}${!carregou||!vis.length?`<li class="muted small">${vazio}</li>`:''}</${f==='in'?'ol':'ul'}></div>`}

function teamCard(t,ti,admin){const R=rat(),c=col(t.c);
  const rs=id=>(t.res||[]).includes(id)?1:0,ps=t.players.slice().sort((a,b)=>rs(a)-rs(b)||posIdx(ppos(a))-posIdx(ppos(b)));
  const avg=t.players.reduce((s,id)=>s+lvl(id),0)/Math.max(1,t.players.length);
  return `<div class="team"><div class="band${c.n==='Branco'&&!sport().pairs?' branco':''}" style="background:${c.c}"></div><div class="th"><b>${tn(t.c)}</b>${admin&&!sport().pairs?`<button class="btn sm ghost" data-a="color" data-v="${ti}">Cor</button>`:`<span class="tag">${t.players.length}</span>`}</div>
  <ul>${ps.map(id=>`<li class="${rs(id)?'reserva':''}">${posTag(id)}<span class="pn">${esc(pname(id))}${rs(id)?` <span class="tag">· ${tx('times.reserva')}</span>`:''}</span>${admin?`<button class="btn sm ghost" data-a="move" data-v="${ti}" data-p="${id}" title="Mover" aria-label="Mover ${esc(pname(id))}">⇄</button>`:''}</li>`).join('')}</ul>
  ${admin?`<div class="row between small muted" style="padding:0 14px 12px"><span>Nota média ${fmtL(Math.round(avg*10)/10)}</span>${sport().pairs?'':`<button class="btn sm ghost" data-a="porTime" data-v="${ti}">${tx('porTime.botao')}</button>`}</div>`:''}</div>`}

/* Aviso de lista diferente dos times (pelada-v15). Some sozinho quando a lista e os times voltam a bater. */
function vDivergencia(r){const d=divergencia(r,S.pres);if(!d.saiu.length&&!d.entrou.length)return '';
  const pares=!!sport().pairs,b=(a,id,t)=>pares?'':`<button class="btn sm" data-a="${a}" data-p="${id}">${t}</button>`;
  const linha=(txt,btn)=>`<li><span class="pn">${txt}</span>${btn}</li>`;
  return `<div class="warn-alt warn-div" role="status"><b>${tx('div.titulo')}</b> ${tx(pares?'div.ajudaDuplas':'div.ajuda')}
    <ul class="plist wrap" style="margin:8px 0">${d.saiu.map(id=>linha(tx('div.naoVaiMais',{nome:esc(pname(id))}),b('divTirar',id,tx('div.tirar')))).join('')}${d.entrou.map(id=>linha(tx('div.confirmouDepois',{nome:esc(pname(id))}),b('divPor',id,tx('div.por')))).join('')}</ul>
    <div class="row"><button class="btn sm bib" data-a="drawDlg">${tx('div.sortearDeNovo')}</button><button class="btn sm" data-a="divManter">${tx('div.manter')}</button></div></div>`}

export { rodadaPicker, teamCard, vRodada };
