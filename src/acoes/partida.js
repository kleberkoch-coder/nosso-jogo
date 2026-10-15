/* Ações: Partida: placar, cronômetro, salvar e recalcular totais. Fazem parte de ACT (src/acoes.js). */
import { abrirHist, buscarHist, estadoHist } from '../telas/historico.js';
import { CAIXA_K, cfg, editPc, ptipo } from '../dominio/caixa.js';
import { APP, COL, SPORTS, col, hasPos, porTime, porTimePadrao, posKeys, posLabel, posTag, sport, tn } from '../dominio/esportes.js';
import { attendance, curRodada, dupName, fdia, fixos, fmtL, freq, gname, grpAtivo, isAvulso, lvl, lvlIn, normName, players, pname, ppos, rodById, rodadas, setLvl } from '../dominio/grupo.js';
import { draw } from '../dominio/sorteio.js';
import { foraDosTimes, fotoDoSorteio } from '../dominio/divergencia.ts';
import { reservas, sugerirTimes, titulares } from '../dominio/times.ts';
import { tp, tx } from '../i18n/index.js';
import { shareDlg, txtConvite, txtTimes } from '../dominio/whatsapp.js';
import { copyText, semConexao } from '../eventos.js';
import { B, op, setCAP, sleep } from '../nucleo/backend.js';
import { avulsosEsgotados, gruposEsgotados, limite } from '../dominio/limites.ts';
import { editApp, editRat, editRod, saveContato, setPres } from '../nucleo/edicoes.js';
import { addMatch, apagarLanc, apagarPartidasDaRodada, delMatch as apagarPartida, gravarVotacao, recalcular, salvarLanc } from '../nucleo/partidas.js';
import { GB, S, clean, w } from '../nucleo/estado.js';
import { linkConvite, linkProxima, linkRodada, linkVoto } from '../nucleo/links.js';
import { $, DIAS, brl, cl, esc, fdate, fmonth, inAppBrowser, key, toast, toastAcao, today, uid, usarAvisoAcao } from '../nucleo/util.js';
import { upMyGroup } from '../rotas.js';
import { pendencias } from '../telas/Caixa.tsx';
import { groupForm, porTimeAjuda, readGroupForm, schedRow } from '../telas/grupo-form.js';
import { AUTH_CANCEL, authMsg, pwFalta, pwOk } from '../telas/login.js';
import { actx, elapsed, setActx, sumPts } from '../telas/partida.js';
import { MEK, myLocal } from '../telas/publico-rodada.js';
import { tally } from '../telas/votacao.js';
import { avisar, closeDlg, closeDlgNow, confirmou, dlg, drawPreview, naoConfirmar, openDlg, playerDlg, posField, responder, rodDlg, val } from '../ui/dialogos.js';
import { changed, render } from '../ui/render.js';
import { TEMA_K, applyTheme, closeThemeMenu, openThemeMenu, themeAnchor, themeMenuEl } from '../ui/tema.js';
import { LOCAL } from '../i18n/formatos.js';
import { ACT } from '../acoes.js';

const acoes={
  goal:el=>{const r=curRodada(),L=S.live,t=el.dataset.v,ti=t==='a'?L.a:L.b,oi=t==='a'?L.b:L.a,SP=sport(),sc=SP.score[+el.dataset.i||0],pts=sc[1];
    openDlg(`<h3>${esc(sc[0].replace('+',''))}${pts>1&&!/\d/.test(sc[0])?' (+'+pts+')':''} — ${tn(r.times[ti].c)}</h3><p class="small muted">Quem marcou?</p><div class="vgrid">${r.times[ti].players.map(id=>`<button class="opt" data-a="addGoal" data-v="${t}" data-p="${id}" data-pts="${pts}">${esc(pname(id))}</button>`).join('')}</div>
    ${SP.og?`<p class="small muted" style="margin-top:14px">Contra (jogador do adversário)</p><div class="vgrid">${r.times[oi].players.map(id=>`<button class="opt" data-a="addGoal" data-v="${t}" data-p="${id}" data-og="1" data-pts="${pts}">${esc(pname(id))}</button>`).join('')}</div>`:''}
    <div class="dlg-f"><button class="btn" data-a="addGoal" data-v="${t}" data-pts="${pts}">Sem autor</button><button class="btn" data-a="close">Cancelar</button></div>`)},
  addGoal:el=>{S.live.goals.push({t:el.dataset.v,pid:el.dataset.p||null,og:!!el.dataset.og,pts:+el.dataset.pts||1});closeDlg();render()},
  undoGoal:()=>{S.live.goals.pop();render()},
  clock:()=>{const L=S.live;try{if(!actx)setActx(new(window.AudioContext||window.webkitAudioContext)());if(actx.state==='suspended')actx.resume()}catch(e){}
    if(L.run){L.el=elapsed();L.run=false}else{L.st=Date.now();L.run=true}$('#clockBtn').textContent=L.run?'Pausar':'Iniciar'},
  clockReset:()=>{Object.assign(S.live,{el:0,run:false,beeped:false});render()},
  saveMatch:()=>{const r=curRodada(),L=S.live,ta=r.times[L.a],tb=r.times[L.b],ga=sumPts(L.goals,'a'),gb=sumPts(L.goals,'b');
    addMatch(r.id,{id:uid(),ca:ta.c,cb:tb.c,pa:ta.players.slice(),pb:tb.players.slice(),ga,gb,goals:L.goals.map(g=>({t:g.t,pid:g.pid,og:g.og,pts:g.pts||1})),at:Date.now()});
    let na=L.a,nb=L.b;if(r.times.length>2){const win=ga>gb?L.a:gb>ga?L.b:L.a,out=win===L.a?L.b:L.a,next=[...Array(r.times.length).keys()].filter(i=>i!==L.a&&i!==L.b);na=win;nb=next.concat(out)[0]}
    S.live={rid:r.id,a:na,b:nb,goals:[],dur:L.dur,el:0,run:false,st:0,beeped:false};toast(`Salvo: ${tn(ta.c)} ${ga} × ${gb} ${tn(tb.c)}`)},
  delMatch:el=>{if(confirmou(el,{titulo:'Apagar esta partida?',texto:'O placar e os pontos dela saem do ranking. Não dá para desfazer.',acao:'Apagar partida',perigo:true})!=='sim')return;return apagarPartida(curRodada().id,el.dataset.v)},
  /* Recalcular os totais (KAN-87): ranking (ano, mês ou tudo) ou caixa (mês). */
  recalc:el=>{const p=el.dataset.v;if(confirmou(el,{titulo:tx('resumo.recalcularTitulo'),texto:tx('resumo.confirmaRecalcular'),acao:tx('resumo.recalcularAcao')})!=='sim')return;return recalcular(p).catch(e=>{console.warn(e);toast(tx('resumo.erroRecalcular'))})},
};

export { acoes };
