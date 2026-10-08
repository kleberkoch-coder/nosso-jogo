import { pname, ppos, rodadas } from '../dominio/grupo.js';
import { S } from '../nucleo/estado.js';
import { esc, fdate } from '../nucleo/util.js';
import { LOCAL } from '../i18n/formatos.js';

/* ---------- Votação ---------- */
function tally(v,votos){const res={};v.cats.forEach(c=>res[c.id]={counts:{},total:0,winners:[]});
  Object.values(votos||{}).forEach(d=>Object.entries(d.v||{}).forEach(([cid,pid])=>{if(res[cid]){res[cid].counts[pid]=(res[cid].counts[pid]||0)+1;res[cid].total++}}));
  Object.values(res).forEach(x=>{const mx=Math.max(0,...Object.values(x.counts));x.winners=mx?Object.keys(x.counts).filter(k=>x.counts[k]===mx):[]});return res}
function candidates(v,c){const r=S.rod[v.rid];if(!r||!r.times)return[];let ids=r.times.flatMap(t=>t.players);if(c.pos)ids=ids.filter(id=>ppos(id)===c.pos);return ids.sort((a,b)=>pname(a).localeCompare(pname(b),LOCAL))}
function vVotacao(){const vs=Object.entries(S.vot).map(([id,v])=>Object.assign({id},v)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(!vs.length)return `<div class="panel empty"><h2>Nenhuma votação</h2><p class="muted">Crie a votação da rodada (melhor jogador, melhor goleiro, melhor por posição, bagre…) e mande o link no grupo.</p><button class="btn primary" data-a="newVote" ${rodadas().some(r=>r.times)?'':'disabled'}>Criar votação</button>${rodadas().some(r=>r.times)?'':'<p class="small muted">Disponível depois do primeiro sorteio.</p>'}</div>`;
  const v=vs.find(x=>x.id===S.vid)||vs[0];S.vid=v.id;const r=S.rod[v.rid],res=v.open?tally(v,S.votos):(v.resultado||tally(v,S.votos)),nv=Object.keys(S.votos).length;
  return `<div class="stack"><div class="row between"><div class="rsel"><select class="sel" data-c="vid">${vs.map(x=>`<option value="${x.id}" ${x.id===v.id?'selected':''}>${esc(x.title)}${S.rod[x.rid]?' — '+fdate(S.rod[x.rid].date):''}</option>`).join('')}</select><button class="btn" data-a="newVote">Nova</button></div></div>
  <div class="panel"><h2>${esc(v.title)}</h2><p class="muted small">${r?'Rodada de '+fdate(r.date)+' · ':''}${v.open?'Aberta':'Encerrada'} · ${nv} ${nv===1?'voto':'votos'}</p>
  <div class="row" style="margin-top:10px"><button class="btn sm primary" data-a="shareVote">${v.open?'Mandar link no WhatsApp':'Mandar resultado no WhatsApp'}</button><button class="btn sm" data-a="toggleVote">${v.open?'Encerrar votação':'Reabrir'}</button><button class="btn sm ghost danger" data-a="delVote">Excluir</button></div></div>
  ${v.cats.map(c=>{const R=res[c.id]||{counts:{},total:0,winners:[]};return `<div class="panel"><h3>${esc(c.name)}</h3><ul class="plist">${Object.entries(R.counts).sort((a,b)=>b[1]-a[1]).map(([id,n])=>`<li><span class="pn">${R.winners.includes(id)?'<b>':''}${esc(pname(id))}${R.winners.includes(id)?'</b>':''}</span><span class="bar"><i style="width:${n/R.total*100}%"></i></span><span class="small">${n}</span></li>`).join('')||'<li class="muted small">Sem votos ainda.</li>'}</ul></div>`}).join('')}</div>`}

export { candidates, tally, vVotacao };
