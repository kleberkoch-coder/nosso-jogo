/* Aba Votação da gestão (KAN-149: separada de votacao.js, que o link de votar também usa). */
import { hasPos, posLabel, sport } from '../dominio/esportes.js';
import { pname, rodDoc, rodadas } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { S } from '../nucleo/estado.js';
import { esc, fdate } from '../nucleo/util.js';
import { tally } from './votacao.js';

function vVotacao(){const vs=Object.entries(S.vot).map(([id,v])=>Object.assign({id},v)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(!vs.length){const pode=rodadas().some(r=>r.times),SP=sport();
    /* KAN-75: os exemplos vêm do esporte (posição-chave só quando o esporte tem). */
    const ex=[tx('votacao.exMelhor'),...(SP.key?[tx('votacao.exMelhorPos',{pos:posLabel(SP.key).toLowerCase()})]:[]),...(hasPos()?[tx('votacao.exPorPosicao')]:[]),tx('votacao.exBagre')].join(', ');
    return `<div class="panel empty"><h2>${tx('votacao.vazioTitulo')}</h2><p class="muted">${esc(tx('votacao.vazioTexto',{ex}))}</p><button class="btn primary" data-a="newVote" ${pode?'':'disabled'}>${tx('votacao.criar')}</button>${pode?'':`<p class="small muted">${tx('votacao.depoisSorteio')}</p>`}</div>`}
  const v=vs.find(x=>x.id===S.vid)||vs[0];S.vid=v.id;const r=rodDoc(v.rid),res=v.open?tally(v,S.votos):(v.resultado||tally(v,S.votos)),nv=Object.keys(S.votos).length;
  return `<div class="stack"><div class="row between"><div class="rsel"><select class="sel" data-c="vid">${vs.map(x=>`<option value="${x.id}" ${x.id===v.id?'selected':''}>${esc(x.title)}${(x.rdate||rodDoc(x.rid)?.date)?' — '+fdate(x.rdate||rodDoc(x.rid).date):''}</option>`).join('')}</select><button class="btn" data-a="newVote">Nova</button></div></div>
  <div class="panel"><h2>${esc(v.title)}</h2><p class="muted small">${r?'Rodada de '+fdate(r.date)+' · ':''}${v.open?'Aberta':'Encerrada'} · ${nv} ${nv===1?'voto':'votos'}</p>
  <div class="row" style="margin-top:10px"><button class="btn sm primary" data-a="shareVote">${v.open?'Mandar link no WhatsApp':'Mandar resultado no WhatsApp'}</button><button class="btn sm" data-a="toggleVote">${v.open?'Encerrar votação':'Reabrir'}</button><button class="btn sm ghost danger" data-a="delVote">Excluir</button></div></div>
  ${v.cats.map(c=>{const R=res[c.id]||{counts:{},total:0,winners:[]};return `<div class="panel"><h3>${esc(c.name)}</h3><ul class="plist">${Object.entries(R.counts).sort((a,b)=>b[1]-a[1]).map(([id,n])=>`<li><span class="pn">${R.winners.includes(id)?'<b>':''}${esc(pname(id))}${R.winners.includes(id)?'</b>':''}</span><span class="bar"><i style="width:${n/R.total*100}%"></i></span><span class="small">${n}</span></li>`).join('')||'<li class="muted small">Sem votos ainda.</li>'}</ul></div>`}).join('')}</div>`}

export { vVotacao };
