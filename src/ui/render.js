import { APP, sport, sportName } from '../dominio/esportes.js';
import { curRodada, fdia, gname, grpAtivo, isAdmin, isOwnerMe } from '../dominio/grupo.js';
import { hora } from '../dominio/rodadas.js';
import { B, applyBusy } from '../nucleo/backend.js';
import { S } from '../nucleo/estado.js';
import { $, esc, fdate, main } from '../nucleo/util.js';
import { isStandalone } from '../pwa.js';
import { ensureExtras, ensurePres, ensureVotos } from '../rotas.js';
import { tx } from '../i18n/index.js';
import { desmontarPublico } from '../telas/PublicoRodada.tsx';
import { vHistorico } from '../telas/historico.js';
import { vLanding } from '../telas/apresentacao.js';
import { montarCaixa, vCaixa } from '../telas/Caixa.tsx';
import { renderInvite } from '../telas/convite.js';
import { vGrupo } from '../telas/grupo.js';
import { vHome } from '../telas/grupos.js';
import { vJogadores } from '../telas/jogadores.js';
import { vAuth } from '../telas/login.js';
import { tick, vPartida } from '../telas/partida.js';
import { renderPublicRodada } from '../telas/publico-rodada.js';
import { renderPublicVoto } from '../telas/publico-voto.js';
import { vRanking } from '../telas/ranking.js';
import { vRodada } from '../telas/rodada.js';
import { vVotacao } from '../telas/votacao.js';

/* =================== render =================== */
let rq=false;function changed(){if(rq)return;rq=true;requestAnimationFrame(()=>{rq=false;render()})}
const TABS=[['rodada','Rodada'],['historico','abas.historico'],['jogadores','Jogadores'],['partida','Partida'],['ranking','Ranking'],['caixa','Caixa'],['votacao','Votação'],['grupo','Grupo']];
function render(){renderCore();applyBusy();subtituloCompleto()}
/* KAN-145: o subtítulo do cabeçalho corta com "…" (KAN-144). Quando corta, o texto inteiro aparece ao passar o mouse
   (title) e ao tocar nele (abre e fecha), para o celular, que não tem "passar o mouse". */
function subtituloCompleto(){const g=$('#gsub');if(!g)return;const corta=g.classList.contains('aberto')||g.scrollWidth>g.clientWidth+1;
  if(corta){g.title=g.textContent;g.setAttribute('role','button');g.tabIndex=0;g.setAttribute('aria-expanded',String(g.classList.contains('aberto')))}
  else{g.removeAttribute('title');g.removeAttribute('role');g.removeAttribute('tabindex');g.removeAttribute('aria-expanded')}}
function renderCore(){
  document.body.classList.remove('is-landing');
  $('#demo').hidden=!(B&&B.demo);
  const R=S.route,logged=!!(S.user&&!S.user.anon);
  const title=(R.n==='home'||R.n==='auth')?APP:(S.app?gname():APP);$('#gname').textContent=title;document.title=title;
  if(R.n!=='r')desmontarPublico();
  if(R.n==='r')return renderPublicRodada();
  if(R.n==='v')return renderPublicVoto();
  $('#tabsnav').hidden=true;$('#gsub').textContent='Presença, sorteio de times, placar, ranking e caixa dos seus jogos';
  $('#topright').innerHTML=logged?`${R.n!=='home'?'<button class="chip" data-a="groupsDlg">⇄ Grupos</button>':''}<button class="chip" data-a="logout">Sair</button>`:(R.n==='auth'?'<a class="chip" href="#/">← Início</a>':'');
  document.body.classList.remove('is-landing');
  if(R.n==='home'&&!logged&&!isStandalone()){document.body.classList.add('is-landing');$('#tabsnav').hidden=true;main.innerHTML=vLanding();return}
  if(R.n==='inv')return renderInvite();
  if(!logged){main.innerHTML=vAuth();return}
  if(R.n==='home'){main.innerHTML=vHome();return}
  if(!S.loaded.mem||!S.loaded.app){main.innerHTML='<div class="empty muted">Carregando…</div>';return}
  if(!S.app){main.innerHTML=`<div class="panel empty auth"><h2>Grupo não encontrado</h2><p class="muted">Ele pode ter sido excluído.</p><a class="btn" href="#/">Meus grupos</a></div>`;return}
  if(!isAdmin()){main.innerHTML=`<div class="panel empty auth"><h2>Sem acesso</h2><p class="muted">Sua conta (${esc(S.user.email)}) não administra o grupo ${esc(gname())}. Peça ao organizador um link de convite.</p><div class="row" style="justify-content:center"><a class="btn" href="#/">Meus grupos</a>${S.me?.grupos?.[S.gid]?'<button class="btn ghost danger" data-a="forgetGroup">Remover da minha lista</button>':''}</div></div>`;return}
  const r0=curRodada();$('#gsub').textContent=`${sport().e} ${sportName()}`+(r0?' · ':'')+(r0?`Próxima: ${fdate(r0.date)}${r0.time?' · '+hora(r0):''}${r0.place?' — '+r0.place:''}`:'');
  $('#tabsnav').hidden=false;
  $('#tabs').innerHTML=TABS.map(([k,l])=>`<button class="tab" role="tab" aria-selected="${S.tab===k}" data-a="tab" data-v="${k}">${l.startsWith('abas.')?tx(l):l}</button>`).join('');
  abasNoLugar();
  ensurePres();ensureVotos();ensureExtras();
  main.innerHTML=(grpAtivo()?'':`<div class="inbar"><span>Grupo inativo desde ${fdia(S.app.inativadoEm)}. Os links públicos não aceitam confirmações nem votos.</span>${isOwnerMe()?'<button class="btn sm" data-a="toggleAtivo">Reativar</button>':''}</div>`)+{rodada:vRodada,jogadores:vJogadores,partida:vPartida,ranking:vRanking,caixa:vCaixa,votacao:vVotacao,historico:vHistorico,grupo:vGrupo}[S.tab]();
  if(S.tab==='caixa')montarCaixa();
  if(S.tab==='partida')tick();
}

/* KAN-72: a aba aberta fica no centro da barra (só quando muda de aba ou de grupo, para não brigar com quem está rolando)
   e uma sombra mostra que há mais abas para o lado. */
let abaCentrada='';
function sombraAbas(){const t=$('#tabs'),n=$('#tabsnav');if(!t||!n)return;n.classList.toggle('mais-esq',t.scrollLeft>2);n.classList.toggle('mais-dir',t.scrollLeft+t.clientWidth<t.scrollWidth-2)}
function abasNoLugar(){const t=$('#tabs'),k=S.gid+'/'+S.tab;
  if(k!==abaCentrada){abaCentrada=k;const a=t.querySelector('[aria-selected="true"]');if(a){const ar=a.getBoundingClientRect(),tr=t.getBoundingClientRect();t.scrollLeft+=(ar.left+ar.width/2)-(tr.left+tr.width/2)}}
  sombraAbas()}
$('#tabs').addEventListener('scroll',sombraAbas,{passive:true});addEventListener('resize',()=>{sombraAbas();subtituloCompleto()});

export { changed, render, subtituloCompleto };
