import { S } from '../nucleo/estado.js';
import { $ } from '../nucleo/util.js';
import { val } from '../ui/dialogos.js';

const PWR=[[/.{8,}/,'8 ou mais caracteres'],[/[A-Z]/,'1 letra maiúscula'],[/[0-9]/,'1 número'],[/[^A-Za-z0-9]/,'1 caractere especial']];
const pwOk=p=>PWR.every(([re])=>re.test(p));
const AUTH_CANCEL=['auth/popup-closed-by-user','auth/cancelled-popup-request','auth/user-cancelled'];
function authMsg(e){const c=(e&&e.code)||'';return({
  'auth/invalid-credential':'E-mail ou senha incorretos.','auth/invalid-login-credentials':'E-mail ou senha incorretos.','auth/wrong-password':'E-mail ou senha incorretos.','auth/user-not-found':'E-mail ou senha incorretos.',
  'auth/invalid-email':'Esse e-mail não é válido.','auth/missing-email':'Digite seu e-mail.',
  'auth/email-already-in-use':'Esse e-mail já tem conta. Use a aba Entrar.',
  'auth/weak-password':'A senha não atende aos requisitos.','auth/password-does-not-meet-requirements':'A senha não atende aos requisitos.',
  'auth/too-many-requests':'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  'auth/network-request-failed':'Sem conexão. Verifique a internet e tente de novo.',
  'auth/user-disabled':'Esta conta foi desativada.',
  'auth/account-exists-with-different-credential':'Esse e-mail já tem conta com senha. Entre com e-mail e senha.',
  'auth/popup-blocked':'O navegador bloqueou a janela do Google. Libere as janelas deste site e tente de novo.',
  'auth/operation-not-allowed':'Esse jeito de entrar ainda não foi ativado. Avise o responsável pelo site.',
  'auth/unauthorized-domain':'Este endereço ainda não foi autorizado para entrar com Google. Avise o responsável pelo site.',
  'auth/web-storage-unsupported':'Este navegador está bloqueando o login. Abra o site no Chrome ou no Safari.'
})[c]||'Não foi possível entrar agora. Tente de novo.'}
/* ---------- login ---------- */
function vAuth(msg){const m=S.authMode;
  const form=m==='signup'?`<h2>Crie sua conta grátis</h2>
    <p class="muted small">Primeiro acesso? Comece por aqui. Com a conta você cria um grupo para cada jogo que organiza (futebol, vôlei, basquete…) e convida outros administradores. Jogadores não precisam de conta: eles confirmam presença pelo link que você manda.</p>
    <button class="btn gbtn" data-a="google">${GICON}Continuar com Google</button><div class="ou"><span>ou com e-mail e senha</span></div>
    <label class="f"><span>E-mail</span><input class="inp" id="le" type="email" autocomplete="email"></label>
    <label class="f"><span>Senha</span><input class="inp" id="lp" type="password" autocomplete="new-password"></label>
    <ul class="pwr" id="pwr">${PWR.map(([,l],i)=>`<li data-i="${i}">${l}</li>`).join('')}</ul>
    <label class="f"><span>Confirme a senha</span><input class="inp" id="lp2" type="password" autocomplete="new-password"></label>
    <div class="err" id="lerr"></div>
    <button class="btn primary" style="width:100%;justify-content:center" data-a="signup" id="sgBtn" disabled>Criar conta</button>
    <p class="small muted" style="text-align:center;margin:14px 0 0">Já tem conta? <button class="linkbtn" data-a="authMode" data-v="login">Entrar</button></p>`
  :`<h2>Entrar</h2>
    <button class="btn gbtn" data-a="google">${GICON}Continuar com Google</button><div class="ou"><span>ou com e-mail e senha</span></div>
    <label class="f"><span>E-mail</span><input class="inp" id="le" type="email" autocomplete="email"></label>
    <label class="f"><span>Senha</span><input class="inp" id="lp" type="password" autocomplete="current-password"></label>
    <div class="err" id="lerr"></div>
    <button class="btn primary" style="width:100%;justify-content:center" data-a="login">Entrar</button>
    <p class="small" style="text-align:center;margin:12px 0 0"><button class="linkbtn" data-a="reset">Esqueci a senha</button></p>
    <p class="small muted" style="text-align:center;margin:10px 0 0">Primeira vez aqui? <button class="linkbtn" data-a="authMode" data-v="signup">Criar conta grátis</button></p>`;
  return `<div class="auth">${msg?`<div class="panel" style="margin-bottom:12px">${msg}</div>`:''}
  <div class="panel"><div class="seg" style="display:flex;margin-bottom:16px"><button style="flex:1" aria-pressed="${m==='signup'}" data-a="authMode" data-v="signup">Criar conta</button><button style="flex:1" aria-pressed="${m==='login'}" data-a="authMode" data-v="login">Entrar</button></div>${form}</div></div>`}
/* Ícone neutro (não é a marca do Google): uma letra G no estilo do app. */
const GICON='<span class="gic" aria-hidden="true">G</span>';
function checkPw(){const p=$('#lp'),p2=$('#lp2'),b=$('#sgBtn');if(!p||!p2||!b)return;
  document.querySelectorAll('#pwr li').forEach(li=>li.classList.toggle('ok',PWR[+li.dataset.i][0].test(p.value)));
  b.disabled=!(pwOk(p.value)&&p.value===p2.value&&/\S+@\S+\.\S+/.test(val('le')));
  $('#lerr').textContent=p2.value&&p.value!==p2.value?'As senhas não conferem.':''}

export { AUTH_CANCEL, authMsg, checkPw, pwOk, vAuth };
