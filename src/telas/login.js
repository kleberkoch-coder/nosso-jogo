import { linhaVersao } from '../nucleo/versao.js';
import { tx } from '../i18n/index.js';
import { S } from '../nucleo/estado.js';
import { $ } from '../nucleo/util.js';
import { val } from '../ui/dialogos.js';

/* Regras da senha (KAN-10, pelada-v34): iguais à política de senha do Firebase (Authentication > Configurações).
   "Especial" vale só para os símbolos que o Firebase aceita; mudar uma regra aqui exige mudar lá também (docs/REGRAS.md). */
const ESPECIAIS='^$*.[]{}()?"!@#%&/\\,><\':;|_~';
const temEspecial=p=>[...p].some(c=>ESPECIAIS.includes(c));
const PWR=[[p=>p.length>=8,'senha.min8'],[p=>/[A-Z]/.test(p),'senha.maiuscula'],[p=>/[a-z]/.test(p),'senha.minuscula'],[p=>/[0-9]/.test(p),'senha.numero'],[temEspecial,'senha.especial']];
const pwOk=p=>PWR.every(([ok])=>ok(p));
/* O que falta na senha, em texto do idioma da tela (usado na mensagem de erro). */
const pwFalta=p=>PWR.filter(([ok])=>!ok(p)).map(([,k])=>tx(k));
const AUTH_CANCEL=['auth/popup-closed-by-user','auth/cancelled-popup-request','auth/user-cancelled'];
const AUTH_K={'auth/invalid-credential':'credencial','auth/invalid-login-credentials':'credencial','auth/wrong-password':'credencial','auth/user-not-found':'credencial',
  'auth/invalid-email':'emailInvalido','auth/missing-email':'emailFaltando','auth/email-already-in-use':'emailEmUso',
  'auth/weak-password':'senhaFraca','auth/password-does-not-meet-requirements':'senhaFraca','auth/too-many-requests':'tentativas',
  'auth/network-request-failed':'semConexao','auth/user-disabled':'desativada','auth/account-exists-with-different-credential':'outroMetodo',
  'auth/popup-blocked':'janelaBloqueada','auth/operation-not-allowed':'naoAtivado','auth/unauthorized-domain':'dominio','auth/web-storage-unsupported':'armazenamento'};
/* Mensagem de erro do login no idioma da tela. Com a senha em mãos, diz exatamente o que falta nela. */
function authMsg(e,senha){const k=AUTH_K[(e&&e.code)||''];
  if(k==='senhaFraca'&&senha!=null){const f=pwFalta(senha);if(f.length)return tx('auth.senhaFalta',{itens:f.join(', ')})}
  return tx('auth.'+(k||'generico'))}
/* ---------- login ---------- */
function vAuth(msg){const m=S.authMode;
  const form=m==='signup'?`<h2>${tx('login.criarTitulo')}</h2>
    <p class="muted small">${tx('login.criarAjuda')}</p>
    <button class="btn gbtn" data-a="google">${GICON}${tx('login.google')}</button><div class="ou"><span>${tx('login.ouEmail')}</span></div>
    <label class="f"><span>${tx('login.email')}</span><input class="inp" id="le" type="email" autocomplete="email"></label>
    <label class="f"><span>${tx('login.senha')}</span>${pwBox('lp','new-password')}</label>
    <ul class="pwr" id="pwr">${PWR.map(([,k],i)=>`<li data-i="${i}">${tx(k)}</li>`).join('')}</ul>
    <p class="small muted pw-esp">${tx('senha.especiaisAceitos',{lista:ESPECIAIS.split('').join(' ')})}</p>
    <label class="f"><span>${tx('login.confirmeSenha')}</span>${pwBox('lp2','new-password')}</label>
    <div class="err" id="lerr"></div>
    <button class="btn primary" style="width:100%;justify-content:center" data-a="signup" id="sgBtn" disabled>${tx('login.criarConta')}</button>
    <p class="small muted" style="text-align:center;margin:14px 0 0">${tx('login.jaTemConta')} <button class="linkbtn" data-a="authMode" data-v="login">${tx('login.entrar')}</button></p>`
  :`<h2>${tx('login.entrar')}</h2>
    <button class="btn gbtn" data-a="google">${GICON}${tx('login.google')}</button><div class="ou"><span>${tx('login.ouEmail')}</span></div>
    <label class="f"><span>${tx('login.email')}</span><input class="inp" id="le" type="email" autocomplete="email"></label>
    <label class="f"><span>${tx('login.senha')}</span>${pwBox('lp','current-password')}</label>
    <div class="err" id="lerr"></div>
    <button class="btn primary" style="width:100%;justify-content:center" data-a="login">${tx('login.entrar')}</button>
    <p class="small" style="text-align:center;margin:12px 0 0"><button class="linkbtn" data-a="reset">${tx('login.esqueci')}</button></p>
    <p class="small muted" style="text-align:center;margin:10px 0 0">${tx('login.primeiraVez')} <button class="linkbtn" data-a="authMode" data-v="signup">${tx('login.criarGratis')}</button></p>`;
  return `<div class="auth">${msg?`<div class="panel" style="margin-bottom:12px">${msg}</div>`:''}
  <div class="panel"><div class="seg" style="display:flex;margin-bottom:16px"><button style="flex:1" aria-pressed="${m==='signup'}" data-a="authMode" data-v="signup">${tx('login.criarConta')}</button><button style="flex:1" aria-pressed="${m==='login'}" data-a="authMode" data-v="login">${tx('login.entrar')}</button></div>${form}</div>${linhaVersao()}</div>`}
/* Ícone neutro (não é a marca do Google): uma letra G no estilo do app. */
/* Campo de senha com o botão Mostrar/Ocultar (pelada-v17). */
function pwBox(id,ac){return `<div class="pwbox"><input class="inp" id="${id}" type="password" autocomplete="${ac}"><button type="button" class="pwver" data-a="verSenha" data-v="${id}" aria-pressed="false" aria-label="${tx('login.mostrarSenha')}">${tx('login.mostrar')}</button></div>`}
/* "G" colorido oficial do Google, no botão branco com borda cinza (padrão de marca do Google). */
const GICON='<svg class="gic" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
function checkPw(){const p=$('#lp'),p2=$('#lp2'),b=$('#sgBtn');if(!p||!p2||!b)return;
  document.querySelectorAll('#pwr li').forEach(li=>li.classList.toggle('ok',PWR[+li.dataset.i][0](p.value)));
  b.disabled=!(pwOk(p.value)&&p.value===p2.value&&/\S+@\S+\.\S+/.test(val('le')));
  $('#lerr').textContent=p2.value&&p.value!==p2.value?tx('senha.naoConferem'):''}

export { AUTH_CANCEL, ESPECIAIS, authMsg, checkPw, pwFalta, pwOk, vAuth };
