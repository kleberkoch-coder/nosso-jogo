import { sport, tn } from '../dominio/esportes.js';
import { comCores, pname } from '../dominio/grupo.js';
import { hora } from '../dominio/rodadas.js';
import { tp, tx } from '../i18n/index.js';
import { B } from '../nucleo/backend.js';
import { S, gp } from '../nucleo/estado.js';
import { $, esc, fdate, fmonth, toast, today } from '../nucleo/util.js';
import { changed } from '../ui/render.js';
import { teamCard } from './rodada.js';

/* ---------- Histórico (D10, KAN-85) ----------
   Busca rodadas antigas por mês ou por período, 20 de cada vez, sem ficar ouvindo o banco.
   Ao abrir uma rodada: presença, times, partidas e votação daquela rodada. Só leitura. */
const POR_PAGINA=20;
function estadoHist(){if(!S.hist)S.hist={modo:'mes',mes:today().slice(0,7),de:'',ate:'',itens:[],docs:{},cursor:null,fim:true,buscou:false,carregando:false,sel:null,pres:null};return S.hist}

function filtro(h){if(h.modo==='mes')return{de:h.mes+'-01',ate:h.mes+'-31'};return{de:h.de||'0000-01-01',ate:h.ate||'9999-12-31'}}

async function buscarHist(mais){const h=estadoHist();
  if(!mais){
    if(h.modo==='mes'){h.mes=($('#hmes')||{}).value||h.mes}else{h.de=($('#hde')||{}).value||'';h.ate=($('#hate')||{}).value||''}
    if(h.modo==='periodo'&&h.de&&h.ate&&h.de>h.ate)return toastErro(tx('hist.periodoInvalido'));
    h.itens=[];h.docs={};h.cursor=null;h.sel=null}
  h.carregando=true;changed();
  try{const f=filtro(h),pg=await B.pagina(gp('rodadas'),{campo:'date',de:f.de,ate:f.ate,ordem:'desc',limite:POR_PAGINA},h.cursor);
    pg.itens.forEach(([id,d])=>{h.docs[id]=d;h.itens.push(id)});h.cursor=pg.cursor;h.fim=pg.fim;h.buscou=true}
  catch(e){console.warn('histórico',e);toastErro(tx('hist.erro'))}
  finally{h.carregando=false;changed()}}

async function abrirHist(id){const h=estadoHist();h.sel=id;h.pres=null;h.parts=null;changed();window.scrollTo(0,0);
  const r=h.docs[id]||{};
  const [pres,parts]=await Promise.all([B.get(gp('rodadas/'+id+'/presencas')).catch(e=>{console.warn('presença do histórico',e);return {}}),
    (r.np>0?B.get(gp('rodadas/'+id+'/partidas')):Promise.resolve({})).catch(e=>{console.warn('partidas do histórico',e);return {}})]);
  h.pres=pres||{};h.parts=Object.entries(parts||{}).map(([pid,m])=>Object.assign({id:pid},m)).concat(r.matches||[]).sort((a,b)=>(a.at||0)-(b.at||0));
  changed()}

function toastErro(m){toast(m)}

function vBusca(h){return `<div class="panel"><h2>${tx('hist.titulo')}</h2><p class="small muted" style="margin-top:2px">${tx('hist.ajuda')}</p>
  <div class="seg" style="display:flex;margin:10px 0 12px"><button style="flex:1" data-a="histModo" data-v="mes" aria-pressed="${h.modo==='mes'}">${tx('hist.porMes')}</button><button style="flex:1" data-a="histModo" data-v="periodo" aria-pressed="${h.modo==='periodo'}">${tx('hist.porPeriodo')}</button></div>
  ${h.modo==='mes'?`<label class="f"><span>${tx('hist.mes')}</span><input class="inp" type="month" id="hmes" value="${esc(h.mes)}"></label>`
    :`<div class="row"><label class="f" style="flex:1;min-width:140px"><span>${tx('hist.de')}</span><input class="inp" type="date" id="hde" value="${esc(h.de)}"></label><label class="f" style="flex:1;min-width:140px"><span>${tx('hist.ate')}</span><input class="inp" type="date" id="hate" value="${esc(h.ate)}"></label></div>`}
  <button class="btn primary" data-a="histBuscar">${tx('hist.buscar')}</button></div>`}

function vLista(h){
  if(!h.buscou)return h.carregando?`<div class="empty muted">${tx('comum.carregando')}</div>`:'';
  if(!h.itens.length)return `<div class="panel empty"><p class="muted">${h.modo==='mes'?tx('hist.vazioMes',{mes:esc(fmonth(h.mes))}):tx('hist.vazioPeriodo')}</p></div>`;
  const li=id=>{const r=h.docs[id],np=r.np!=null?r.np:(r.matches||[]).length;
    return `<li><span class="pn"><b>${esc(fdate(r.date))}</b>${r.time?' · '+esc(hora(r)):''}<br><span class="tag">${esc(r.place||tx('publico.localADefinir'))}${r.cancelada?' · '+tx('hist.cancelada'):''}${r.times?' · '+tp('hist.times',r.times.length):''}${np?' · '+tp('hist.partidas',np):''}</span></span><button class="btn sm" data-a="histAbrir" data-v="${esc(id)}">${tx('hist.abrir')}</button></li>`};
  return `<div class="panel"><ul class="plist">${h.itens.map(li).join('')}</ul>
    ${h.fim?'':`<div class="row" style="justify-content:center;margin-top:12px"><button class="btn" data-a="histMais">${tx('hist.verMais')}</button></div>`}</div>`}

function vDetalhe(h){const id=h.sel,r=comCores(h.docs[id]);if(!r)return '';
  const pres=h.pres,inn=pres?Object.entries(pres).filter(([,p])=>p.s==='in').sort((a,b)=>(a[1].t||0)-(b[1].t||0)).map(([pid])=>pid):[];
  const ms=h.parts||[],vs=Object.entries(S.vot||{}).filter(([,v])=>v.rid===id);
  const nomeP=pid=>esc((pres&&pres[pid]&&pres[pid].nome)||pname(pid));
  return `<div class="stack"><div class="row"><button class="btn sm" data-a="histVoltar">← ${tx('hist.voltar')}</button></div>
  <div class="panel"><h2>${esc(fdate(r.date))}${r.time?' · '+esc(hora(r)):''}</h2><div class="muted">${esc(r.place||tx('publico.localADefinir'))}${r.cancelada?' · '+tx('hist.cancelada'):''}</div></div>
  <div class="panel"><h3>${tx('hist.confirmados')} ${pres?'('+inn.length+')':''}</h3>${!pres?`<p class="muted small">${tx('comum.carregando')}</p>`:inn.length?`<ol class="plist">${inn.map((pid,i)=>`<li><span class="num">${i+1}</span><span class="pn">${nomeP(pid)}</span></li>`).join('')}</ol>`:`<p class="muted small">${tx('hist.semConfirmados')}</p>`}</div>
  <div class="panel"><h3>${tx('hist.timesTitulo')}</h3>${r.times?`<div class="teams">${r.times.map((t,i)=>teamCard(t,i,false)).join('')}</div>`:`<p class="muted small">${tx('hist.semSorteio')}</p>`}</div>
  <div class="panel"><h3>${tx('hist.partidasTitulo')}</h3>${!h.parts?`<p class="muted small">${tx('comum.carregando')}</p>`:ms.length?`<ul class="plist wrap">${ms.map((m,i)=>{const gs=(m.goals||[]).filter(g=>g.pid&&!g.og);
    return `<li><span class="num">${i+1}</span><span class="pn">${tn(m.ca)} <b>${m.ga} × ${m.gb}</b> ${tn(m.cb)}${gs.length?` <span class="small muted">— ${esc(sport().word.toLowerCase())}: ${gs.map(g=>esc(pname(g.pid))+((g.pts||1)>1?' ('+g.pts+')':'')).join(', ')}</span>`:''}</span></li>`}).join('')}</ul>`:`<p class="muted small">${tx('hist.semPartidas')}</p>`}</div>
  <div class="panel"><h3>${tx('hist.votacaoTitulo')}</h3>${vs.length?vs.map(([,v])=>`<p style="margin:0 0 8px"><b>${esc(v.title)}</b> <span class="tag">· ${v.open?tx('hist.votacaoAberta'):tx('hist.votacaoEncerrada')}</span></p>${!v.open&&v.resultado?`<ul class="plist">${v.cats.map(c=>`<li><span class="pn">${esc(c.name)}</span><b>${((v.resultado[c.id]||{}).winners||[]).map(x=>esc(pname(x))).join(tx('voto.e'))||tx('voto.semVotos')}</b></li>`).join('')}</ul>`:''}`).join(''):`<p class="muted small">${tx('hist.semVotacao')}</p>`}</div></div>`}

function vHistorico(){const h=estadoHist();if(h.sel)return vDetalhe(h);
  return `<div class="stack">${vBusca(h)}${vLista(h)}</div>`}

export { abrirHist, buscarHist, estadoHist, vHistorico };
