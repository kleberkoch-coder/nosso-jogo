/* Ações: Conta, login, tema e diálogos gerais. Fazem parte de ACT (src/acoes.js). */
import { tx } from '../i18n/index.js';
import { copyText } from '../eventos.js';
import { B } from '../nucleo/backend.js';
import { S } from '../nucleo/estado.js';
import { $, inAppBrowser, toast } from '../nucleo/util.js';
import { AUTH_CANCEL, authMsg, avisoGoogle, pwFalta, pwOk } from '../telas/login.js';
import { avisar, closeDlg, confirmou, dlg, naoConfirmar, openDlg, responder, val } from '../ui/dialogos.js';
import { render } from '../ui/render.js';
import { TEMA_K, applyTheme, closeThemeMenu, openThemeMenu, themeAnchor, themeMenuEl } from '../ui/tema.js';
import { ACT } from '../acoes.js';

async function sairDaConta(destino,el){
  if(!(el&&el._conf==='sim')&&!(await B.semPendencias(3000))){confirmou(el,{titulo:tx('sair.pendentesTitulo'),texto:tx('sair.pendentes'),acao:tx('sair.mesmoAssim'),perigo:true});return}
  if(el)delete el._conf;
  const limpou=await B.logout();
  if(limpou===false)await avisar(tx('sair.outrasAbasTitulo'),tx('sair.outrasAbas'));
  try{sessionStorage.clear()}catch(e){}
  location.replace(location.pathname+location.search+destino);location.reload()}
const acoes={
  tab:el=>{S.tab=el.dataset.v;render();window.scrollTo(0,0)},
  themeMenu:el=>{if(themeMenuEl&&themeAnchor===el){closeThemeMenu(true);return}openThemeMenu(el)},
  setTheme:el=>{const t=el.dataset.v;try{if(t==='auto')localStorage.removeItem(TEMA_K);else localStorage.setItem(TEMA_K,t)}catch(e){}
    const fromMenu=!!el.closest('.theme-menu');closeThemeMenu(fromMenu);applyTheme();render()},
  close:closeDlg,
  /* Janela de confirmação do app (KAN-128) */
  confSim:()=>responder('sim',ACT),confOutro:()=>responder('nao',ACT),confNao:()=>naoConfirmar(),
  copy:()=>{const t=$('#shtxt');copyText(t.value,t)},
  authMode:el=>{const em=val('le');S.authMode=el.dataset.v;try{localStorage.setItem('pelada-mode',S.authMode)}catch(e){}render();const i=$('#le');if(i){i.value=em;(em?$('#lp'):i).focus()}},
  login:async()=>{const e=val('le'),p=$('#lp').value;$('#lerr').textContent='';if(!e||!p){$('#lerr').textContent=tx('auth.preencha');return}try{await B.login(e,p);try{localStorage.setItem('pelada-mode','login')}catch(x){}}catch(x){$('#lerr').textContent=authMsg(x)}},
  signup:async()=>{const e=val('le'),p=$('#lp').value;if(!pwOk(p)){$('#lerr').textContent=tx('auth.senhaFalta',{itens:pwFalta(p).join(', ')});return}if(p!==$('#lp2').value){$('#lerr').textContent=tx('senha.naoConferem');return}
    $('#lerr').textContent='';try{await B.signup(e,p);try{localStorage.setItem('pelada-mode','login')}catch(x){}}catch(x){$('#lerr').textContent=authMsg(x,p)}},
  google:async()=>{const le=$('#lerr');if(le)le.textContent='';
    if(!B.demo&&inAppBrowser()){openDlg(`<h3>Abra no navegador</h3><p>O Google não permite entrar por dentro deste aplicativo. Abra o link no <b>Chrome</b> ou no <b>Safari</b> e toque de novo em <b>Continuar com o Google</b>.</p>
      <p class="small muted">Dica: toque nos três pontinhos (⋮ ou ⋯) no canto da tela e escolha <b>Abrir no navegador</b>. Ou entre com e-mail e senha aqui mesmo.</p>
      <div class="dlg-f"><button class="btn" data-a="close">Fechar</button><button class="btn primary" data-a="copyHere">Copiar link</button></div>`);return}
    try{const modo=S.authMode,r=await B.google(val('le')),av=avisoGoogle(r,modo);if(av)toast(av,6000);try{localStorage.setItem('pelada-mode','login')}catch(x){}}
    catch(x){if(AUTH_CANCEL.includes(x&&x.code))return;console.warn(x);const m=authMsg(x);if($('#lerr'))$('#lerr').textContent=m;else toast(m,6000)}},
  copyHere:()=>copyText(location.href),
  reset:async()=>{const e=val('le');if(!e){$('#lerr').textContent=tx('auth.digiteEmail');return}try{await B.reset(e);toast(tx('auth.linkEnviado',{email:e}))}catch(x){$('#lerr').textContent=authMsg(x)}},
  /* Sair (KAN-80): confere se ficou algo sem enviar, desconecta, apaga os dados do grupo guardados neste aparelho e recarrega. */
  logout:el=>sairDaConta('#/',el),
  invSwitch:el=>sairDaConta(location.hash,el),
  /* Mostrar/ocultar a senha enquanto digita (pelada-v17). */
  verSenha:el=>{const i=$('#'+el.dataset.v);if(!i)return;const on=i.type==='password';i.type=on?'text':'password';el.setAttribute('aria-pressed',String(on));
    el.textContent=tx(on?'login.ocultar':'login.mostrar');el.setAttribute('aria-label',tx(on?'login.ocultarSenha':'login.mostrarSenha'));i.focus()},
};

export { acoes, sairDaConta };
