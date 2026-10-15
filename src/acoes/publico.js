/* Ações: Link público (jogador sem conta): presença e voto. Fazem parte de ACT (src/acoes.js). */
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
import { AUTH_CANCEL, authMsg, avisoGoogle, pwFalta, pwOk } from '../telas/login.js';
import { actx, elapsed, setActx, sumPts } from '../telas/partida.js';
import { MEK, myLocal } from '../telas/publico-rodada.js';
import { tally } from '../telas/votacao.js';
import { avisar, closeDlg, closeDlgNow, confirmou, dlg, drawPreview, naoConfirmar, openDlg, playerDlg, posField, responder, rodDlg, val } from '../ui/dialogos.js';
import { changed, render } from '../ui/render.js';
import { TEMA_K, applyTheme, closeThemeMenu, openThemeMenu, themeAnchor, themeMenuEl } from '../ui/tema.js';
import { LOCAL } from '../i18n/formatos.js';
import { ACT } from '../acoes.js';

const acoes={
  /* público */
  pubMark:el=>{const r=rodById(S.route.id);if(!r||r.locked)return;const id=el.dataset.p,cur=S.pres[id]||{};
    if(!S.user){semConexao();return}
    try{localStorage.setItem(MEK,id)}catch(e){}setPres(S.route.id,id,Object.assign(isAvulso(id)?{nome:cur.nome,avulso:true,pos:cur.pos}:{},{s:el.dataset.v})).then(()=>{changed();toast(el.dataset.v==='in'?'Presença confirmada: '+pname(id):'Ok, '+pname(id)+' não vai.')}).catch(()=>{})},
  /* KAN-127: o que o jogador digitou na busca já vem no nome. */
  pubAdd:el=>{openDlg(`<h3>Adicionar meu nome</h3><label class="f"><span>Nome ou apelido</span><input class="inp" id="anm" maxlength="40" autocomplete="off" value="${esc((el&&el.dataset.v)||'')}"></label>
    <div id="avsug"></div><div id="avnew">${posField('apos')}</div>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="pubSaveAdd">Confirmar presença</button></div>`);if(el&&el.dataset.v)$('#anm')?.dispatchEvent(new Event('input',{bubbles:true}))},
  pubPick:el=>{const id=el.dataset.p,a=S.avul[id];if(!S.user){semConexao();return}
    if(!S.pres[id]&&avulsosEsgotados(S.limAv,S.limCfg)){closeDlg();toast(tx('limite.avulsosPublico'));return}closeDlg();try{localStorage.setItem(MEK,id)}catch(e){}
    return setPres(S.route.id,id,{s:'in',nome:a.nome,avulso:true,pos:a.pos||''}).then(()=>{changed();toast('Presença confirmada: '+a.nome)}).catch(()=>{})},
  pubSaveAdd:()=>{const n=val('anm');if(n.length<2){toast('Digite seu nome.');return}if(!S.user){semConexao();return}
    const el=players().find(p=>normName(p.name)===normName(n));if(el){closeDlg();toast('Seu nome já está na lista: toque em Vou ao lado de '+el.name+'.');return}
    const same=Object.entries(S.avul||{}).find(([,a])=>normName(a.nome)===normName(n));if(same)return ACT.pubPick({dataset:{p:same[0]}});
    if(avulsosEsgotados(S.limAv,S.limCfg)){closeDlg();toast(tx('limite.avulsosPublico'));return}
    const id=B.newId(),pos=val('apos');closeDlg();try{localStorage.setItem(MEK,id)}catch(e){}return setPres(S.route.id,id,{s:'in',nome:n,avulso:true,pos}).then(()=>{changed();toast('Presença confirmada: '+n)}).catch(()=>{})},
  pubVote:el=>{const me=S.myVote?.pid||myLocal();if(!me||!S.user)return;const d=cl(S.myVote)||{v:{}};d.pid=me;d.v=d.v||{};d.v[el.dataset.c2]=el.dataset.p;d.t=Date.now();S.myVote=d;changed();
    w(GB.set('votacoes/'+S.route.id+'/votos/'+S.user.uid,d))},
};

export { acoes };
