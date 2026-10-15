import { ACT } from './acoes.js';
import { adm, carregarAdmin } from './nucleo/carga-admin.js';
import { cfg } from './dominio/caixa.js';
import { posTag } from './dominio/esportes.js';
import { fmtL, normName } from './dominio/grupo.js';
import { applyBusy, setBusy, setCAP, sleep } from './nucleo/backend.js';
import { S } from './nucleo/estado.js';
import { $, esc, toast } from './nucleo/util.js';
import { checkPw } from './telas/login.js';
import { MEK } from './telas/publico-rodada.js';
import { closeDlgNow } from './ui/dialogos.js';
import { render, subtituloCompleto } from './ui/render.js';
import { closeThemeMenu, themeMenuEl } from './ui/tema.js';
import { tx } from './i18n/index.js';

function avisoPendente(pub){toast(pub?tx('comum.pendentePublico'):tx('comum.pendenteGestao'),8000)}
function semConexao(){toast(navigator.onLine?tx('comum.conectando'):tx('comum.semInternet'))}
function copyText(s,ta){(navigator.clipboard?navigator.clipboard.writeText(s):Promise.reject()).then(()=>toast(tx('comum.copiado'))).catch(()=>{if(ta){ta.select();try{document.execCommand('copy');toast(tx('comum.copiado'))}catch(e){}}else prompt(tx('comum.copieLink'),s)})}
document.addEventListener('click',e=>{
  const sub=e.target.closest('#gsub[role=button],[data-corta][role=button]');if(sub){sub.classList.toggle('aberto');subtituloCompleto();return}
  const a=e.target.closest('a.btn,a.chip');if(a&&!a.dataset.a&&(a.getAttribute('href')||'').startsWith('#')){setBusy(a,true);setTimeout(()=>setBusy(a,false),4000);return}
  const el=e.target.closest('[data-a]');if(!el||el.disabled||el.classList.contains('busy'))return;const f=ACT[el.dataset.a];if(!f){/* KAN-149: ação de gestão antes de a parte de gestão chegar: carrega e toca de novo. */if(!adm()){e.preventDefault();setBusy(el,true);carregarAdmin().then(()=>{setBusy(el,false);if(ACT[el.dataset.a])el.click()},()=>{setBusy(el,false);semConexao()})}return}
  if(el.tagName!=='A')e.preventDefault();
  const cap=[];cap.close=false;setCAP(cap);let res;
  try{res=f(el,e)}catch(err){console.error(err)}finally{setCAP(null)}
  const ps=cap.slice();if(res&&typeof res.then==='function')ps.push(res);
  if(!ps.length){if(cap.close)closeDlgNow();return}
  setBusy(el,true);
  const pub=S.route.n==='r'||S.route.n==='v';let fim=false;const all=Promise.allSettled(ps).then(()=>{fim=true});
  /* Login não fica salvo para depois: o botão gira até a resposta (a janela do Google pode levar mais tempo). */
  const semLimite=['login','signup','google','reset'].includes(el.dataset.a);
  Promise.race(semLimite?[all]:[all,sleep(pub?5000:9000)]).then(()=>{setBusy(el,false);if(cap.close)closeDlgNow();applyBusy();if(!fim)avisoPendente(pub)});
});
/* Tocar fora do menu de tema só fecha o menu: o mesmo toque não aciona o que está embaixo. */
let swallowClick=false;
document.addEventListener('pointerdown',e=>{if(themeMenuEl&&!themeMenuEl.contains(e.target)&&!e.target.closest('[data-a=themeMenu]')){closeThemeMenu();swallowClick=true;setTimeout(()=>{swallowClick=false},600)}},true);
document.addEventListener('click',e=>{if(swallowClick){swallowClick=false;e.preventDefault();e.stopPropagation()}},true);
document.addEventListener('keydown',e=>{if(!themeMenuEl)return;const bs=[...themeMenuEl.querySelectorAll('button')],i=bs.indexOf(document.activeElement);
  if(e.key==='Escape'){e.preventDefault();closeThemeMenu(true)}
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();bs[(i+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length].focus()}
  else if(e.key==='Tab')closeThemeMenu()});
addEventListener('resize',()=>closeThemeMenu());
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='lk'){const c=cfg();$('#lv').value=t.value==='mensal'?c.mensal:t.value==='diaria'?c.diaria:'';return}
  if(t.classList.contains('dp')){adm()?.drawPreview();return}
  const el=t.closest('[data-c]');if(!el)return;const v=el.value,c=el.dataset.c;
  if(c==='rid'){S.rid=v;S.live=null}else if(c==='ta'){S.live.a=+v;S.live.goals=[]}else if(c==='tb'){S.live.b=+v;S.live.goals=[]}
  else if(c==='dur'){S.live.dur=+v*60;S.live.beeped=false}else if(c==='rank')S.rankSort=v;else if(c==='rankAno'){S.rankAno=v;S.rankMes=''}else if(c==='rankMes')S.rankMes=v;else if(c==='month')S.month=v;else if(c==='vid')S.vid=v;
  else if(c==='voter'){try{localStorage.setItem(MEK,v)}catch(x){}if(S.myVote)S.myVote.pid=v;else S.myVote={pid:v,v:{}}}
  render()});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&(e.target.id==='gsub'||e.target.hasAttribute('data-corta'))&&e.target.getAttribute('role')==='button'){e.preventDefault();e.target.click();return}if(e.key!=='Enter')return;const id=e.target.id;if(['le','lp','lp2'].includes(id)){e.preventDefault();if(S.authMode==='signup'){const b=$('#sgBtn');if(b&&!b.disabled)b.click()}else $('[data-a=login]')?.click()}else if(id==='ngn'){e.preventDefault();$('[data-a=createGroup]')?.click()}
  /* KAN-74: em qualquer janela, Enter (ou "Ir" no teclado do celular) num campo de texto aciona o botão principal do rodapé.
     Fica de fora: área de texto, listas de escolha, caixas de marcar e a busca de nomes (#avq). */
  else if(!e.isComposing&&enterEnvia(e.target)){const b=[...document.querySelectorAll('#dlg .dlg-f .btn.primary,#dlg .dlg-f .btn.bib')].pop();if(b&&!b.disabled&&!b.classList.contains('busy')){e.preventDefault();b.click()}}});
function enterEnvia(t){return t.tagName==='INPUT'&&!!t.closest('#dlg')&&!['checkbox','radio','button','submit','range','file','color'].includes(t.type)&&t.id!=='avq'}
document.addEventListener('input',e=>{
  if(e.target.id==='plv'){$('#plvo').textContent=fmtL(e.target.value);return}
  if(e.target.id==='avq'){const q=normName(e.target.value);document.querySelectorAll('#avlist [data-n]').forEach(b=>b.hidden=q&&!b.dataset.n.includes(q));return}
  if(e.target.id==='anm'&&$('#avsug')){const q=normName(e.target.value),m=q.length<2?[]:Object.entries(S.avul||{}).filter(([id,a])=>!S.jog[id]&&normName(a.nome).includes(q)).slice(0,5);
    $('#avsug').innerHTML=m.length?`<p class="small muted" style="margin:-4px 0 6px">Já jogou aqui? Toque no seu nome:</p><div class="vgrid" style="margin-bottom:12px">${m.map(([id,a])=>`<button class="opt" data-a="pubPick" data-p="${id}">${posTag(id)}<span>${esc(a.nome)}</span></button>`).join('')}</div>`:'';return}if(['le','lp','lp2'].includes(e.target.id)&&S.authMode==='signup')checkPw()});

export { copyText, semConexao };
