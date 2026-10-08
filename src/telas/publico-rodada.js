import { APP, posTag, sport, sportName } from '../dominio/esportes.js';
import { attendance, fixos, gname, grpAtivo, isAvulso, players, pname, rodById } from '../dominio/grupo.js';
import { hora } from '../dominio/rodadas.js';
import { LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { S } from '../nucleo/estado.js';
import { $, esc, fdate, main } from '../nucleo/util.js';
import { teamCard } from './rodada.js';

/* ---------- Página pública da rodada (jogador sem conta) ---------- */
const MEK='pelada-eu';
function myLocal(){try{return localStorage.getItem(MEK)}catch(e){return null}}

/* Tela de aviso: título e texto, sem a lista. */
function aviso(titulo,texto,extra){$('#gsub').textContent='';main.innerHTML=`<div class="panel empty"><h2>${titulo}</h2><p class="muted">${texto}</p>${extra||''}</div>`}

function renderPublicRodada(){
  $('#tabsnav').hidden=true;$('#topright').innerHTML='';
  const r=rodById(S.route.id);
  if(S.route.next?!(S.loaded.rods&&S.loaded.app):!(S.loaded.r&&S.loaded.app)){$('#gsub').textContent='';main.innerHTML=`<div class="empty muted">${tx('comum.carregando')}</div>`;return}
  if(!S.app)return aviso(tx('publico.grupoNaoEncontrado'),tx('publico.grupoNaoEncontradoTexto'));
  if(!grpAtivo())return aviso(esc(gname()),tx('publico.grupoInativo'));
  if(!r&&S.route.next)return aviso(tx('publico.semJogo'),tx('publico.semJogoTexto'));
  if(r&&r.cancelada)return aviso(tx('publico.cancelado',{data:esc(fdate(r.date))}),tx('publico.canceladoTexto'),fixos().length?`<a class="btn primary" href="#/p/${S.gid}">${tx('publico.verProxima')}</a>`:'');
  if(!r)return aviso(tx('publico.rodadaNaoEncontrada'),tx('publico.rodadaNaoEncontradaTexto'));
  $('#gsub').textContent=tx('publico.subtitulo',{emoji:sport().e,esporte:sportName()});
  const a=attendance(),me=myLocal(),ids=players().map(p=>p.id).concat(Object.keys(S.pres).filter(id=>isAvulso(id)&&S.pres[id].nome));
  const uniq=[...new Set(ids)].sort((x,y)=>(x===me?-1:y===me?1:pname(x).localeCompare(pname(y),LOCAL)));
  const linha=id=>{const s=S.pres[id]?.s;return `<li class="${id===me?'me-row':''}">${posTag(id)}<span class="pn">${esc(pname(id))}${id===me?` <span class="tag">${tx('publico.voce')}</span>`:''}${isAvulso(id)?` <span class="tag">${tx('publico.avulso')}</span>`:''}</span>
    ${r.locked?`<span class="tag" style="color:${s==='in'?'var(--in)':s==='out'?'var(--out)':''}">${s==='in'?tx('publico.vai'):s==='out'?tx('publico.naoVai'):'—'}</span>`:`<span class="mk lg"><button class="${s==='in'?'on-in':''}" data-a="pubMark" data-p="${id}" data-v="in" aria-pressed="${s==='in'}">${s==='in'?'✓ ':''}${tx('publico.vou')}</button><button class="${s==='out'?'on-out':''}" data-a="pubMark" data-p="${id}" data-v="out" aria-pressed="${s==='out'}">${s==='out'?'✕ ':''}${tx('publico.naoVou')}</button></span>`}</li>`};
  main.innerHTML=`<div class="stack">
  <div class="panel"><div class="hero-r"><div><h2>${esc(fdate(r.date))}${r.time?' · '+esc(hora(r)):''}</h2><div class="muted">${esc(r.place||tx('publico.localADefinir'))}</div></div><div class="count">${a.inn.length}<small>${tx('publico.confirmados')}</small></div></div></div>
  ${r.times?`<div class="panel"><h3>${tx('publico.timesSorteados')}</h3><div class="teams">${r.times.map((t,i)=>teamCard(t,i,false)).join('')}</div></div>`:''}
  <div class="panel"><h3>${r.locked?tx('publico.listaFechada'):tx('publico.voceVai')}</h3><p class="small muted" style="margin-top:-6px">${r.locked?tx('publico.listaFechadaTexto'):tx('publico.instrucao')}</p>
    <ul class="plist">${uniq.map(linha).join('')||`<li class="muted small">${tx('publico.listaVazia')}</li>`}</ul>
    ${r.locked?'':`<div class="row" style="margin-top:14px"><span class="small muted" style="flex:1">${tx('publico.semNome')}</span><button class="btn primary" data-a="pubAdd">${tx('publico.adicionarNome')}</button></div>`}</div>
  ${a.inn.length?`<div class="panel"><h3>${tx('publico.confirmadosTitulo')}</h3><ol class="plist">${a.inn.map((id,i)=>`<li><span class="num">${i+1}</span><span class="pn">${esc(pname(id))}</span>${posTag(id)}</li>`).join('')}</ol></div>`:''}
  <div class="foot"><a href="#/">${tx('publico.rodape',{app:APP})}</a></div></div>`}

export { MEK, myLocal, renderPublicRodada };
