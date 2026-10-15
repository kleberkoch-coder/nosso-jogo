/* Ações: Jogadores: elenco, notas, contatos, pares separados e configurações. Fazem parte de ACT (src/acoes.js). */
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
  addPlayer:()=>playerDlg(null),editPlayer:el=>playerDlg(el.dataset.p),
  star:()=>{},
  waLink:()=>{},
  savePlayer:el=>{const name=val('pnm');if(name.length<2){toast('Digite o nome.');return}const nw=el.dataset.new,id=el.dataset.p||nw||B.newId(),v=+$('#plv').value;
    if(Object.entries(S.jog).some(([k,x])=>k!==id&&normName(x.name)===normName(name))&&confirmou(el,{titulo:'Já existe um jogador chamado "'+name+'"',texto:'Cadastrar outro com o mesmo nome?',acao:'Cadastrar mesmo assim'})!=='sim')return;
    const old=S.jog[id]||{},tp=val('ptp'),data=Object.assign({},old,{name,pos:val('ppos'),ativo:old.ativo!==false,criado:old.criado||(nw&&S.avul[nw]?.criado)||Date.now()});delete data.tipo;
    S.jog[id]=data;changed();w(GB.set('jogadores/'+id,clean(data)));if(ptipo(id)!==tp||!((S.pc||{}).tipos||{})[id])editPc(a=>{a.tipos[id]=tp});editRat(a=>setLvl(a,id,v));saveContato(id,val('ptel'),val('pmail'));
    if(nw&&S.avul[nw]){delete S.avul[nw];w(GB.del('avulsos/'+nw))}closeDlg();toast('Jogador salvo.')},
  toggleJog:el=>{const id=el.dataset.p,o=Object.assign({},S.jog[id]),on=o.ativo===false;if(!on&&confirmou(el,{titulo:'Inativar '+o.name+'?',texto:'Ele sai das listas de presença, mas o histórico continua.',acao:'Inativar jogador'})!=='sim')return;
    o.ativo=on;if(on)delete o.inativadoEm;else o.inativadoEm=Date.now();S.jog[id]=o;changed();closeDlg();toast(on?'Jogador reativado.':'Jogador inativado.');return w(GB.set('jogadores/'+id,clean(o)))},
  delPlayer:el=>{const id=el.dataset.p;if(confirmou(el,{titulo:'Excluir '+pname(id)+'?',texto:'Ele sai do elenco de vez. Para manter o histórico, prefira Inativar.',acao:'Excluir jogador',perigo:true})!=='sim')return;delete S.jog[id];w(GB.del('jogadores/'+id));editRat(a=>{delete a.stars[id];a.sep=a.sep.filter(s=>!s.includes(id))});if(((S.pc||{}).tipos||{})[id])editPc(a=>{delete a.tipos[id]});closeDlg()},
  addSep:()=>{const o=players().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');openDlg(`<h3>Não colocar no mesmo time</h3><label class="f"><span>Jogador</span><select class="sel" id="sa">${o}</select></label><label class="f"><span>e</span><select class="sel" id="sb">${o}</select></label><div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveSep">Adicionar par</button></div>`)},
  saveSep:()=>{const a=val('sa'),b=val('sb');if(a===b){toast('Escolha duas pessoas diferentes.');return}editRat(x=>{if(!x.sep.some(s=>key(s[0],s[1])===key(a,b)))x.sep.push([a,b])});closeDlg()},
  delSep:el=>editRat(x=>{x.sep.splice(+el.dataset.v,1)}),
  settings:()=>{const c=cfg();openDlg(`<h3>Partidas e caixa</h3>
    <div class="row"><label class="f" style="flex:1"><span>Mensalidade (R$)</span><input class="inp" type="number" min="0" id="cm" value="${c.mensal}"></label><label class="f" style="flex:1"><span>Diária (R$)</span><input class="inp" type="number" min="0" id="cd" value="${c.diaria}"></label></div>
    <div class="row"><label class="f" style="flex:1"><span>Minutos por partida</span><input class="inp" type="number" min="1" id="cmin" value="${c.minutes}"></label><label class="f" style="flex:1"><span>Chave Pix</span><input class="inp" id="cpx" value="${esc(c.pix)}"></label></div>
    <p class="small muted" style="margin-top:-4px">Valores e chave Pix só aparecem para administradores.</p>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveSettings">Salvar</button></div>`)},
  saveSettings:()=>{const m=+val('cm')||0,d=+val('cd')||0,px=val('cpx'),mn=+val('cmin')||10;const ps=[editPc(a=>{Object.assign(a,{mensal:m,diaria:d,pix:px})})];
    if(cfg().minutes!==mn||CAIXA_K.some(k=>k in((S.app||{}).cfg||{})))ps.push(editApp(a=>{a.cfg.minutes=mn;CAIXA_K.forEach(k=>delete a.cfg[k])}));closeDlg();toast('Configurações salvas.');return Promise.all(ps)},
  seed:()=>{const ns=[['Bruno','GOL',4],['Tiago','GOL',3],['Rafa','DEF',4],['Léo','DEF',3],['Marcão','DEF',2],['Dudu','DEF',3],['Gui','MEI',5],['Fernandinho','MEI',4],['Caio','MEI',3],['Pedrinho','MEI',2],['Japa','ATA',5],['Neto','ATA',4],['Vini','ATA',3],['Alemão','ATA',2]];
    const ids=ns.map(()=>B.newId()),K=posKeys(),map={GOL:0,DEF:1,MEI:2,ATA:3};ns.forEach(([n,p],i)=>{const d={criado:Date.now(),name:n,pos:K.length?(K[Math.min(K.length-1,map[p])]||K[i%K.length]):'',ativo:true};S.jog[ids[i]]=d;w(GB.set('jogadores/'+ids[i],d))});
    editPc(a=>{ids.forEach((id,i)=>{a.tipos[id]=i%4===3?'diarista':'mensalista'})});
    editRat(a=>{ids.forEach((id,i)=>setLvl(a,id,ns[i][2]*2-(i%3===0?0.5:0)));a.sep.push([ids[6],ids[10]])});toast('Elenco de exemplo carregado.')},
};

export { acoes };
