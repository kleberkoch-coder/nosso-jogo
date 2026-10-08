import { buscarHist, estadoHist } from './telas/historico.js';
import { ACT } from './acoes.js';
import { migrarPrivado } from './dominio/caixa.js';
import { curRodada, isAdmin, upcoming, ymd } from './dominio/grupo.js';
import { B } from './nucleo/backend.js';
import { GB, S, SUBS, drop, dropAll, sub, subQ, subRaw } from './nucleo/estado.js';
import { $, cl, toast } from './nucleo/util.js';
import { closeDlgNow, dlg } from './ui/dialogos.js';
import { render } from './ui/render.js';

/* =================== assinaturas por rota =================== */
function ensurePres(){const r=curRodada(),id=r?r.id:null;if(S.presRid===id)return;S.presRid=id;S.pres={};drop('pres');if(id)sub('pres','rodadas/'+id+'/presencas',d=>{S.pres=d||{};regAvulsos()})}
function regAvulsos(){if(!isAdmin()||!S.loaded.avul||!S.presRid)return;const r=S.rod[S.presRid],jogou=new Set(r&&r.times?r.times.flatMap(t=>t.players):[]);
  Object.entries(S.pres).forEach(([id,p])=>{if(jogou.has(id)&&p.avulso&&p.nome&&!S.jog[id]&&!S.avul[id]){const o={nome:p.nome,pos:p.pos||'',criado:Date.now()};S.avul[id]=o;GB.set('avulsos/'+id,o).catch(()=>{})}})}
function ensureVotos(){const id=S.tab==='votacao'?(S.vid||Object.keys(S.vot).sort((a,b)=>(S.vot[b].createdAt||0)-(S.vot[a].createdAt||0))[0]):null;if(S.votosVid===id)return;S.votosVid=id;S.votos={};drop('votos');if(id)sub('votos','votacoes/'+id+'/votos',d=>{S.votos=d||{}})}
/* Data relativa a hoje (AAAA-MM-DD). */
const dia=n=>{const d=new Date();d.setDate(d.getDate()+n);return ymd(d)};
/* Rodadas da janela da aba Rodada (D10): as próximas (a partir de ontem, para pegar o jogo que vira a meia-noite) e as recentes
   (até hoje: as últimas 4 mais uma folga para o jogo de hoje). */
const Q_PROX={campo:'date',ordem:'asc',limite:12},Q_REC={campo:'date',ordem:'desc',limite:5};
function juntarRod(){S.rod=Object.assign({},S.rodP||{},S.rodF||{});regAvulsos()}
/* Dados que só carregam quando a aba precisa deles (D10): todas as rodadas no ranking, as do mês no caixa e a rodada de uma votação antiga. */
function ensureExtras(){
  if(S.tab==='ranking'){if(!SUBS.rodAll)sub('rodAll','rodadas',d=>{S.rodAll=d||{}})}else if(SUBS.rodAll){drop('rodAll');S.rodAll=null}
  if(S.tab==='caixa'){const m=S.month;if(S.rodMesM!==m){S.rodMesM=m;S.rodMes={};subQ('rodMes','rodadas',{campo:'date',de:m+'-01',ate:m+'-31',ordem:'asc'},d=>{S.rodMes=d||{}})}}
  else if(SUBS.rodMes){drop('rodMes');S.rodMesM=null}
  if(S.tab==='historico'){const h=estadoHist();if(!h.buscou&&!h.carregando&&!h.auto){h.auto=true;buscarHist(false)}}
  if(S.tab==='votacao'){const v=S.vot[S.vid];const rid=v&&v.rid;if(rid&&!S.rod[rid]&&S.rodXid!==rid){S.rodXid=rid;sub('rodX','rodadas/'+rid,d=>{S.rodX=d?{[rid]:d}:{}})}}}
function parseRoute(){const h=location.hash.replace(/^#\/?/,'').split('/');
  if(h[0]==='p'&&h[1]){if(h[2]==='r'&&h[3])return{n:'r',gid:h[1],id:h[3]};if(h[2]==='v'&&h[3])return{n:'v',gid:h[1],id:h[3]};return{n:'r',gid:h[1],id:null,next:true}}
  if(h[0]==='g'&&h[1])return{n:'admin',gid:h[1]};
  if(h[0]==='entrar')return{n:'auth',mode:'login'};if(h[0]==='criar')return{n:'auth',mode:'signup'};
  if(h[0]==='convite'&&h[1]&&h[2])return{n:'inv',gid:h[1],token:h[2]};
  return{n:'home'}}
function upMyGroup(gid,patch){const me=cl(S.me)||{grupos:{}};me.grupos=me.grupos||{};me.grupos[gid]=Object.assign({},me.grupos[gid]||{},patch);S.me=me;return B.set('usuarios/'+S.user.uid,me)}
function addMyGroup(gid,name,role,sp,spn){return upMyGroup(gid,{name,role,sport:sp||'futebol',sportName:spn||''})}
function syncName(){const g=S.me?.grupos?.[S.gid],a=S.app;if(S.route.n!=='admin'||!a||!S.mem||!g)return;
  const want={name:a.name,sport:a.sport||'futebol',sportName:a.sportName||'',ativo:a.ativo!==false,criado:a.createdAt||null};
  if(Object.keys(want).some(k=>(g[k]??null)!==(want[k]??null)))upMyGroup(S.gid,want).catch(()=>{})}
function setupRoute(){
  closeDlgNow();dropAll();S.route=parseRoute();const R=S.route,logged=!!(S.user&&!S.user.anon);
  if(R.n==='auth'){if(logged){location.hash='#/';return}S.authMode=R.mode}
  window.scrollTo(0,0);
  if(R.n==='r'||R.n==='v'){try{localStorage.setItem('pelada-last',location.hash)}catch(e){}}
  Object.assign(S,{avul:{},cont:{},pc:null,migrando:false,gid:R.gid||null,app:null,mem:null,membros:{},convite:null,rat:null,caixa:{},presRid:undefined,votosVid:undefined,dataOn:false,rod:{},rodF:{},rodP:{},rodAll:null,rodMes:{},rodMesM:null,rodX:{},rodXid:null,hist:null,pres:{},vot:{},votos:{},myVote:null,jog:{},rid:null,vid:null,live:null});
  if(logged)subRaw('me','usuarios/'+S.user.uid,d=>{S.me=d||{grupos:{}};syncName();
    if(S.route.n==='home'&&!S.homeShown){S.homeShown=true;const all=Object.entries(S.me.grupos||{}),g=all.filter(([,v])=>v.ativo!==false).map(([k])=>k);if(g.length===1)location.hash='#/g/'+g[0];else if(!all.length)setTimeout(()=>{if(S.route.n==='home'&&!dlg.open)ACT.newGroup()},250)}});
  if(S.gid)sub('app','config/app',d=>{S.app=d;if(R.next)resolveNext();syncName();migrarPrivado()});
  const anon=()=>{if(!S.user)B.anon().catch(()=>toast('Não foi possível conectar. Recarregue a página.'))};
  if(R.n==='r'&&R.next){anon();
    sub('jog','jogadores',d=>{S.jog=d||{}});sub('avul','avulsos',d=>{S.avul=d||{}});
    /* Link do jogador: só as próximas rodadas, nunca o histórico (KAN-82). */
    subQ('rods','rodadas',Object.assign({de:dia(-1)},Q_PROX,{limite:6}),d=>{S.rod=d||{};resolveNext()});
  }else if(R.n==='r'){anon();
    sub('jog','jogadores',d=>{S.jog=d||{}});sub('avul','avulsos',d=>{S.avul=d||{}});
    sub('r','rodadas/'+R.id,d=>{if(d)S.rod={[R.id]:d};else S.rod={}});
    S.presRid=R.id;sub('pres','rodadas/'+R.id+'/presencas',d=>{S.pres=d||{}});
  }else if(R.n==='v'){anon();
    sub('jog','jogadores',d=>{S.jog=d||{}});
    sub('v','votacoes/'+R.id,d=>{S.vot=d?{[R.id]:d}:{};if(d&&!SUBS.rv)sub('rv','rodadas/'+d.rid,x=>{S.rod=x?{[d.rid]:x}:{}})});
    if(S.user)sub('mv','votacoes/'+R.id+'/votos/'+S.user.uid,d=>{const keep=S.myVote?.pid;S.myVote=d||(keep?{pid:keep,v:{}}:null)});
  }else if((R.n==='admin'||R.n==='inv')&&logged){
    sub('mem','membros/'+S.user.uid,d=>{S.mem=d;if(d&&R.n==='admin')startData();syncName()});
  }
  render();
  if(R.n==='auth'||(R.n==='inv'&&!logged))focusEmail();
}
function focusEmail(){let n=0;const t=setInterval(()=>{const i=$('#le');if(i){i.focus();clearInterval(t)}else if(++n>40)clearInterval(t)},50)}
function resolveNext(){if(!S.loaded.app||!S.loaded.rods)return;const r=upcoming()[0],id=r?r.id:null;
  if(S.route.id!==id||S.presRid!==id){S.route.id=id;S.presRid=id;S.pres={};drop('pres');if(id)sub('pres','rodadas/'+id+'/presencas',d=>{S.pres=d||{}})}}
function startData(){if(S.dataOn)return;S.dataOn=true;
  sub('rat','privado/ratings',d=>{S.rat=d});sub('cont','privado/contatos',d=>{S.cont=d||{}});sub('avul','avulsos',d=>{S.avul=d||{};regAvulsos()});sub('jog','jogadores',d=>{S.jog=d||{};migrarPrivado()});subQ('rodF','rodadas',Object.assign({de:dia(-1)},Q_PROX),d=>{S.rodF=d||{};juntarRod()});subQ('rodP','rodadas',Object.assign({ate:dia(0)},Q_REC),d=>{S.rodP=d||{};juntarRod()});
  sub('pc','privado/caixa',d=>{S.pc=d;migrarPrivado()});
  sub('caixa','caixa',d=>{S.caixa=d||{}});sub('vot','votacoes',d=>{S.vot=d||{}});sub('membros','membros',d=>{S.membros=d||{}});sub('convite','privado/convite',d=>{S.convite=d})}

export { dia, ensureExtras, ensurePres, ensureVotos, setupRoute, upMyGroup };
