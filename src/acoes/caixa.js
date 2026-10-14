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
import { $, DIAS, brl, cl, esc, fdate, fmonth, inAppBrowser, key, toast, today, uid } from '../nucleo/util.js';
import { upMyGroup } from '../rotas.js';
import { pendencias } from '../telas/caixa.js';
import { groupForm, porTimeAjuda, readGroupForm, schedRow } from '../telas/grupo-form.js';
import { AUTH_CANCEL, authMsg, pwOk } from '../telas/login.js';
import { actx, elapsed, setActx, sumPts } from '../telas/partida.js';
import { MEK, myLocal } from '../telas/publico-rodada.js';
import { tally } from '../telas/votacao.js';
import { closeDlg, closeDlgNow, dlg, drawPreview, openDlg, playerDlg, posField, rodDlg, val } from '../ui/dialogos.js';
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
  payPend:el=>{const p=pendencias(S.month)[+el.dataset.v];if(!p)return;const id=B.newId(),o={k:p.k,pid:p.pid,v:p.v,d:today(),ref:p.ref,note:''};return salvarLanc(id,o)},
  delLan:el=>{if(confirm('Apagar este lançamento?'))return apagarLanc(el.dataset.v)},
  shareCob:()=>{const by={};pendencias(S.month).forEach(x=>(by[x.pid]=by[x.pid]||[]).push(x));
    let t=`💰 *${gname()} — pendências de ${fmonth(S.month).toLowerCase()}*\n\n`+Object.entries(by).map(([pid,xs])=>`• ${pname(pid)}: ${brl(xs.reduce((s,x)=>s+x.v,0))} (${xs.map(x=>x.label).join(', ')})`).join('\n');
    if(cfg().pix)t+=`\n\nPix: ${cfg().pix}`;shareDlg('Cobrança',t)},
};

export { acoes };
