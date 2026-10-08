import { cfg } from '../dominio/caixa.js';
import { col, sport, tn } from '../dominio/esportes.js';
import { curRodada, pname } from '../dominio/grupo.js';
import { S } from '../nucleo/estado.js';
import { esc } from '../nucleo/util.js';
import { rodadaPicker } from './rodada.js';

/* ---------- Partida ---------- */
function vPartida(){
  const r=curRodada();
  if(!r||!r.times)return `<div class="panel empty"><h2>Sem times sorteados</h2><p class="muted">Sorteie os times na aba Rodada para começar.</p><button class="btn" data-a="tab" data-v="rodada">Ir para a rodada</button></div>`;
  if(!S.live||S.live.rid!==r.id||S.live.a>=r.times.length||S.live.b>=r.times.length)S.live={rid:r.id,a:0,b:1,goals:[],dur:cfg().minutes*60,el:0,run:false,st:0,beeped:false};
  const L=S.live,ta=r.times[L.a],tb=r.times[L.b],ca=col(ta.c),cb=col(tb.c);
  const ga=sumPts(L.goals,'a'),gb=sumPts(L.goals,'b'),SP=sport();
  const gt=t=>L.goals.filter(g=>g.t===t).map(g=>(g.pid?esc(pname(g.pid))+(g.og?' (contra)':''):'—')+((g.pts||1)>1?` (${g.pts})`:'')).join(', ');
  const sbtn=t=>SP.score.map(([l,v],i)=>`<button class="btn bib${SP.score.length>2?' sm':''}" data-a="goal" data-v="${t}" data-i="${i}">${SP.score.length===1?'+ '+l:l}</button>`).join('');
  const opt=(sel,skip)=>r.times.map((t,i)=>`<option value="${i}" ${i===sel?'selected':''} ${i===skip?'disabled':''}>${tn(t.c)}</option>`).join('');
  const ms=r.matches||[];
  return `<div class="stack">${rodadaPicker(r)}
  <div class="board"><div class="sides">
    <div><div class="tn"><span class="dot" style="background:${ca.c}"></span>${tn(ta.c)}</div><div class="sc">${ga}</div><div class="goals">${gt('a')}</div><div class="row" style="justify-content:center;gap:6px">${sbtn('a')}</div></div>
    <div class="x">×</div>
    <div><div class="tn"><span class="dot" style="background:${cb.c}"></span>${tn(tb.c)}</div><div class="sc">${gb}</div><div class="goals">${gt('b')}</div><div class="row" style="justify-content:center;gap:6px">${sbtn('b')}</div></div></div>
    <div id="clock">--:--</div><div id="clockMsg" class="clock-msg" role="status" hidden>Tempo esgotado</div>
    <div class="row" style="justify-content:center"><button class="btn" data-a="clock" id="clockBtn">${L.run?'Pausar':'Iniciar'}</button><button class="btn" data-a="clockReset">Zerar tempo</button><button class="btn" data-a="undoGoal" ${L.goals.length?'':'disabled'}>Desfazer último</button></div></div>
  <div class="panel"><div class="row">
    <label class="f" style="margin:0;flex:1;min-width:120px"><span>Time A</span><select class="sel" data-c="ta">${opt(L.a,L.b)}</select></label>
    <label class="f" style="margin:0;flex:1;min-width:120px"><span>Time B</span><select class="sel" data-c="tb">${opt(L.b,L.a)}</select></label>
    <label class="f" style="margin:0;width:110px"><span>Minutos</span><select class="sel" data-c="dur">${[5,7,8,10,12,15,20,25,30,45].map(m=>`<option ${m*60===L.dur?'selected':''}>${m}</option>`).join('')}</select></label></div>
    <div class="row" style="margin-top:12px"><button class="btn primary" data-a="saveMatch">Encerrar e salvar partida</button>${r.times.length>2?'<span class="small muted">Depois de salvar, o vencedor fica e entra o próximo.</span>':''}</div></div>
  <div class="panel"><h3>Partidas desta rodada</h3>${ms.length?`<ul class="plist wrap">${ms.map((m,i)=>`<li><span class="num">${i+1}</span><span class="pn"><span class="dot" style="background:${col(m.ca).c}"></span> ${tn(m.ca)} <b>${m.ga} × ${m.gb}</b> ${tn(m.cb)} <span class="dot" style="background:${col(m.cb).c}"></span>
    <span class="small muted">${m.goals.filter(g=>g.pid&&!g.og).length?' — '+sport().word.toLowerCase()+': '+m.goals.filter(g=>g.pid&&!g.og).map(g=>esc(pname(g.pid))+((g.pts||1)>1?' ('+g.pts+')':'')).join(', '):''}</span></span><button class="btn sm ghost danger" data-a="delMatch" data-v="${i}">Apagar</button></li>`).join('')}</ul>`:'<p class="muted small">Nenhuma partida salva ainda.</p>'}</div></div>`}
function sumPts(gs,t){return gs.filter(g=>g.t===t).reduce((s,g)=>s+(g.pts||1),0)}
function elapsed(){const L=S.live;return L.el+(L.run?(Date.now()-L.st)/1000:0)}
function tick(){const el=document.getElementById('clock');if(!el||!S.live)return;const rem=S.live.dur-elapsed(),a=Math.abs(rem);
  el.textContent=(rem<0?'+':'')+String(Math.floor(a/60)).padStart(2,'0')+':'+String(Math.floor(a%60)).padStart(2,'0');
  el.classList.toggle('over',rem<=0);const msg=document.getElementById('clockMsg');if(msg)msg.hidden=rem>0;if(rem<=0&&!S.live.beeped&&S.live.run){S.live.beeped=true;beep()}}
setInterval(()=>{if(S.tab==='partida'&&S.route.n==='admin')tick()},250);
let actx=null;
function beep(){try{if(!actx)return;[0,.35,.7].forEach(d=>{const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=880;o.connect(g);g.connect(actx.destination);g.gain.setValueAtTime(.25,actx.currentTime+d);g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+d+.3);o.start(actx.currentTime+d);o.stop(actx.currentTime+d+.3)});if(navigator.vibrate)navigator.vibrate([300,150,300,150,300])}catch(e){}}

function setActx(v){actx=v}

export { actx, elapsed, setActx, sumPts, tick, vPartida };
