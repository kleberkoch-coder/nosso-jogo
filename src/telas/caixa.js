import { cfg, ptipo } from '../dominio/caixa.js';
import { players, pname, rodadas, rodadasDoMes } from '../dominio/grupo.js';
import { S } from '../nucleo/estado.js';
import { brl, esc, fdate, fmonth, today } from '../nucleo/util.js';

/* ---------- Caixa ---------- */
function pendencias(month){const lan=Object.values(S.caixa),c=cfg();
  const mens=players().filter(p=>ptipo(p.id)!=='diarista'&&!lan.some(l=>l.k==='mensal'&&l.pid===p.id&&l.ref===month)).map(p=>({pid:p.id,k:'mensal',ref:month,v:c.mensal,label:'Mensalidade'}));
  const dia=[];rodadasDoMes(month).filter(r=>r.times).forEach(r=>r.times.forEach(t=>t.players.forEach(id=>{
    const tipo=S.jog[id]?ptipo(id):'avulso';if(tipo!=='mensalista'&&!lan.some(l=>l.k==='diaria'&&l.pid===id&&l.ref===r.id))dia.push({pid:id,k:'diaria',ref:r.id,v:c.diaria,label:'Diária '+fdate(r.date)})})));
  return mens.concat(dia)}
function vCaixa(){const lan=Object.entries(S.caixa).map(([id,v])=>Object.assign({id},v)),m=S.month;
  const inM=lan.filter(l=>(l.d||'').slice(0,7)===m).sort((a,b)=>(b.d||'').localeCompare(a.d||''));
  /* Os lançamentos já estão todos carregados (pendências e lista), então saldo, entradas e saídas saem deles, exatos.
     A ficha do mês (resumos, cx) é mantida a cada lançamento para quando o caixa passar a carregar só o mês (D11). */
  const saldo=lan.reduce((s,l)=>s+(l.k==='despesa'?-(+l.v||0):(+l.v||0)),0),ent=inM.filter(l=>l.k!=='despesa').reduce((s,l)=>s+(+l.v||0),0),sai=inM.filter(l=>l.k==='despesa').reduce((s,l)=>s+(+l.v||0),0),
    money=(v,neg)=>`<div class="money ${neg&&v<0?'neg':''}">${brl(v)}</div>`;
  const pend=pendencias(m),KL={mensal:'Mensalidade',diaria:'Diária',entrada:'Outra entrada',despesa:'Despesa'};
  const months=[...new Set([today().slice(0,7),...lan.map(l=>(l.d||'').slice(0,7)),...rodadas().map(r=>(r.date||'').slice(0,7))].filter(Boolean))].sort().reverse();
  return `<div class="stack"><div class="row between"><h2>Caixa</h2><div class="row"><select class="sel" style="width:auto" data-c="month">${months.map(x=>`<option value="${x}" ${x===m?'selected':''}>${fmonth(x)}</option>`).join('')}</select><button class="btn primary" data-a="addLan">Lançar</button></div></div>
  <div class="panel"><div class="kpis"><div><div class="l">Saldo do caixa</div>${money(saldo,true)}</div><div><div class="l">Entradas no mês</div>${money(ent)}</div><div><div class="l">Saídas no mês</div>${money(sai)}</div></div></div>
  <div class="grid2"><div class="panel"><div class="row between"><h3 style="margin:0">Pendentes</h3>${pend.length?'<button class="btn sm" data-a="shareCob">Cobrar no WhatsApp</button>':''}</div>
    <ul class="plist" style="margin-top:6px">${pend.map((p,i)=>`<li><span class="pn">${esc(pname(p.pid))} <span class="tag">${esc(p.label)}</span></span><b>${brl(p.v)}</b><button class="btn sm" data-a="payPend" data-v="${i}">Recebi</button></li>`).join('')||'<li class="muted small">Tudo em dia.</li>'}</ul></div>
   <div class="panel"><h3>Lançamentos do mês</h3><ul class="plist">${inM.map(l=>`<li><span class="pn">${esc(KL[l.k]||l.k)}${l.pid?' — '+esc(pname(l.pid)):''}${l.note?` <span class="tag">${esc(l.note)}</span>`:''}<br><span class="tag">${fdate(l.d)}</span></span><b style="color:${l.k==='despesa'?'var(--out)':'var(--in)'}">${l.k==='despesa'?'−':'+'}${brl(l.v)}</b><button class="btn sm ghost danger" data-a="delLan" data-v="${l.id}" aria-label="Apagar">✕</button></li>`).join('')||'<li class="muted small">Nenhum lançamento neste mês.</li>'}</ul></div></div></div>`}

export { pendencias, vCaixa };
