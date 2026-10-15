/* Ações: Caixa: lançamentos, pendências e cobrança. Fazem parte de ACT (src/acoes.js). */
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
  addLan:()=>{const o=players().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');openDlg(`<h3>Novo lançamento</h3>
    <label class="f"><span>Tipo</span><select class="sel" id="lk"><option value="mensal">Mensalidade</option><option value="diaria">Diária</option><option value="entrada">Outra entrada</option><option value="despesa">Despesa (quadra, bola, coletes…)</option></select></label>
    <label class="f"><span>Jogador (opcional para despesa)</span><select class="sel" id="lp2"><option value="">—</option>${o}</select></label>
    <div class="row"><label class="f" style="flex:1"><span>Valor (R$)</span><input class="inp" type="number" min="0" step="0.01" id="lv" value="${cfg().mensal}"></label><label class="f" style="flex:1"><span>Data</span><input class="inp" type="date" id="ld" value="${today()}"></label></div>
    <label class="f"><span>Descrição</span><input class="inp" id="ln" maxlength="60"></label>
    <div class="dlg-f"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="saveLan">Lançar</button></div>`)},
  saveLan:()=>{const k=val('lk'),v=+val('lv');if(!(v>0)){toast('Informe um valor.');return}if((k==='mensal'||k==='diaria')&&!val('lp2')){toast('Escolha o jogador.');return}
    const d=val('ld')||today();let ref=d.slice(0,7);if(k==='diaria'){const r=rodadas().find(r=>r.date===d);ref=r?r.id:d}
    const id=B.newId(),o={k,pid:val('lp2')||null,v,d,ref,note:val('ln')};closeDlg();toast('Lançamento salvo.');return salvarLanc(id,o)},
  /* KAN-129: "Recebi" grava na hora e o aviso oferece "Desfazer" por 6 segundos. */
  payPend:el=>{const p=pendencias(S.month)[+el.dataset.v];if(!p)return;const id=B.newId(),o={k:p.k,pid:p.pid,v:p.v,d:today(),ref:p.ref,note:''};
    const r=salvarLanc(id,o);toastAcao(tx('caixa.recebido',{nome:pname(p.pid),valor:brl(p.v)}),tx('caixa.desfazer'),()=>{const d=apagarLanc(id);toast(tx('caixa.pagamentoDesfeito'));return d});return r},
  /* Apagar (depois da confirmação) também oferece "Desfazer": o lançamento volta com o mesmo código. */
  _apagarLan:id=>{const o=S.caixa[id];if(!o)return;const r=apagarLanc(id);toastAcao(tx('caixa.apagado'),tx('caixa.desfazer'),()=>{const d=salvarLanc(id,o);toast(tx('caixa.apagadoVolta'));return d});return r},
  avisoAcao:()=>usarAvisoAcao(),
  delLan:el=>{if(confirmou(el,{titulo:'Apagar este lançamento?',texto:'O valor sai do saldo e do mês.',acao:'Apagar lançamento',perigo:true})!=='sim')return;return ACT._apagarLan(el.dataset.v)},
  shareCob:()=>{const by={};pendencias(S.month).forEach(x=>(by[x.pid]=by[x.pid]||[]).push(x));
    let t=`💰 *${gname()} — pendências de ${fmonth(S.month).toLowerCase()}*\n\n`+Object.entries(by).map(([pid,xs])=>`• ${pname(pid)}: ${brl(xs.reduce((s,x)=>s+x.v,0))} (${xs.map(x=>x.label).join(', ')})`).join('\n');
    if(cfg().pix)t+=`\n\nPix: ${cfg().pix}`;shareDlg('Cobrança',t)},
};

export { acoes };
