/* Tela de entrar e criar conta (KAN-165: virou componente em TypeScript + Preact; antes, telas/login.js).
   Por fora, igual: os mesmos ids (le, lp, lp2, lpais, lerr, sgBtn), que as ações (acoes/entrar.ts), o Enter
   (eventos.js) e os testes usam. Baixa sob demanda com src/entrar.ts (KAN-183), fora do link do jogador. */
import { render } from 'preact';
import { numeroVersao } from '../nucleo/versao.js';
import { tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { $ } from '../nucleo/util.js';
import { val } from '../ui/dialogos.js';
import { carregarAdmin } from '../nucleo/carga-admin.js';

// O estado ainda é JavaScript sem tipos.
const S = estado as any;

/* Regras da senha (KAN-10, pelada-v34): iguais à política de senha do Firebase (Authentication > Configurações).
   "Especial" vale só para os símbolos que o Firebase aceita; mudar uma regra aqui exige mudar lá também (docs/REGRAS.md). */
const ESPECIAIS = '^$*.[]{}()?"!@#%&/\\,><\':;|_~';
const temEspecial = (p: string) => [...p].some(c => ESPECIAIS.includes(c));
const PWR: [(p: string) => boolean, string][] = [
  [p => p.length >= 8, 'senha.min8'],
  [p => /[A-Z]/.test(p), 'senha.maiuscula'],
  [p => /[a-z]/.test(p), 'senha.minuscula'],
  [p => /[0-9]/.test(p), 'senha.numero'],
  [temEspecial, 'senha.especial'],
];
const pwOk = (p: string) => PWR.every(([ok]) => ok(p));
/* O que falta na senha, em texto do idioma da tela (usado na mensagem de erro). */
const pwFalta = (p: string) => PWR.filter(([ok]) => !ok(p)).map(([, k]) => tx(k));
const AUTH_CANCEL = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];
const AUTH_K: Record<string, string> = {
  'auth/invalid-credential': 'credencial',
  'auth/invalid-login-credentials': 'credencial',
  'auth/wrong-password': 'credencial',
  'auth/user-not-found': 'credencial',
  'auth/invalid-email': 'emailInvalido',
  'auth/missing-email': 'emailFaltando',
  'auth/email-already-in-use': 'emailEmUso',
  'auth/weak-password': 'senhaFraca',
  'auth/password-does-not-meet-requirements': 'senhaFraca',
  'auth/too-many-requests': 'tentativas',
  'auth/network-request-failed': 'semConexao',
  'auth/user-disabled': 'desativada',
  'auth/account-exists-with-different-credential': 'outroMetodo',
  'auth/popup-blocked': 'janelaBloqueada',
  'auth/operation-not-allowed': 'naoAtivado',
  'auth/unauthorized-domain': 'dominio',
  'auth/web-storage-unsupported': 'armazenamento',
};
/* Mensagem de erro do login no idioma da tela. Com a senha em mãos, diz exatamente o que falta nela. */
function authMsg(e: any, senha?: string) {
  const k = AUTH_K[(e && e.code) || ''];
  if (k === 'senhaFraca' && senha != null) {
    const f = pwFalta(senha);
    if (f.length) return tx('auth.senhaFalta', { itens: f.join(', ') });
  }
  return tx('auth.' + (k || 'generico'));
}
/* KAN-142: "Continuar com o Google" entra ou cria a conta, em qualquer aba (é o padrão do Google e não tem risco).
   Quando a aba não bate com o que aconteceu, o app avisa, para a pessoa entender. */
function avisoGoogle(r: any, modo: string) {
  const i = r && r.additionalUserInfo;
  if (!i) return null;
  if (modo === 'signup' && i.isNewUser === false) return tx('auth.googleJaTinha');
  if (modo === 'login' && i.isNewUser === true) return tx('auth.googleCriou');
  return null;
}
/* ---------- login ---------- */
/* Campo de senha com o botão Mostrar/Ocultar (pelada-v17). */
function CampoSenha({ id, ac }: { id: string; ac: string }) {
  return (
    <div class="pwbox">
      <input class="inp" id={id} type="password" autoComplete={ac} />
      <button
        type="button"
        class="pwver"
        data-a="verSenha"
        data-v={id}
        aria-pressed="false"
        aria-label={tx('login.mostrarSenha')}
      >
        {tx('login.mostrar')}
      </button>
    </div>
  );
}

/* "G" colorido oficial do Google, no botão branco com borda cinza (padrão de marca do Google). */
function IconeGoogle() {
  return (
    <svg class="gic" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function BotaoGoogle() {
  return (
    <>
      <button class="btn gbtn" data-a="google">
        <IconeGoogle />
        {tx('login.google')}
      </button>
      <div class="ou">
        <span>{tx('login.ouEmail')}</span>
      </div>
    </>
  );
}

function CampoEmail() {
  return (
    <label class="f">
      <span>{tx('login.email')}</span>
      <input class="inp" id="le" type="email" autoComplete="email" />
    </label>
  );
}

/* País da conta (KAN-162): já vem sugerido pelo fuso do aparelho; vale para o Google e para e-mail e senha.
   A lista de países vem com a parte de gestão (que a conta nova vai usar logo depois), para não pesar no link do jogador. */
function CampoPais() {
  return (
    <label class="f">
      <span>{tx('login.pais')}</span>
      <select class="sel" id="lpais" autoComplete="country"></select>
      <span class="small muted dica">{tx('login.paisDica')}</span>
    </label>
  );
}
function preencherPais() {
  carregarAdmin()
    .then((m: any) => {
      const s = $('#lpais');
      if (!s) return;
      S.paisNovo = S.paisNovo || m.paisAparelho();
      m.preencher(s, m.listaPais(), S.paisNovo);
    })
    .catch(() => {});
}

function CriarConta() {
  return (
    <>
      <h2>{tx('login.criarTitulo')}</h2>
      <p class="muted small">{tx('login.criarAjuda')}</p>
      <CampoPais />
      <BotaoGoogle />
      <CampoEmail />
      <label class="f">
        <span>{tx('login.senha')}</span>
        <CampoSenha id="lp" ac="new-password" />
      </label>
      <ul class="pwr" id="pwr">
        {PWR.map(([, k], i) => (
          <li key={k} data-i={i}>
            {tx(k)}
          </li>
        ))}
      </ul>
      <p class="small muted pw-esp">{tx('senha.especiaisAceitos', { lista: ESPECIAIS.split('').join(' ') })}</p>
      <label class="f">
        <span>{tx('login.confirmeSenha')}</span>
        <CampoSenha id="lp2" ac="new-password" />
      </label>
      <div class="err" id="lerr" aria-live="polite"></div>
      <button class="btn primary" style="width:100%;justify-content:center" data-a="signup" id="sgBtn" disabled>
        {tx('login.criarConta')}
      </button>
      <p class="small muted" style="text-align:center;margin:14px 0 0">
        {tx('login.jaTemConta')}{' '}
        <button class="linkbtn" data-a="authMode" data-v="login">
          {tx('login.entrar')}
        </button>
      </p>
    </>
  );
}

function Entrar() {
  return (
    <>
      <h2>{tx('login.entrar')}</h2>
      <BotaoGoogle />
      <CampoEmail />
      <label class="f">
        <span>{tx('login.senha')}</span>
        <CampoSenha id="lp" ac="current-password" />
      </label>
      <div class="err" id="lerr" aria-live="polite"></div>
      <button class="btn primary" style="width:100%;justify-content:center" data-a="login">
        {tx('login.entrar')}
      </button>
      <p class="small" style="text-align:center;margin:12px 0 0">
        <button class="linkbtn" data-a="reset">
          {tx('login.esqueci')}
        </button>
      </p>
      <p class="small muted" style="text-align:center;margin:10px 0 0">
        {tx('login.primeiraVez')}{' '}
        <button class="linkbtn" data-a="authMode" data-v="signup">
          {tx('login.criarGratis')}
        </button>
      </p>
    </>
  );
}

/* Convite para administrar: o cabeçalho (#invHead) é preenchido pelo convite (telas/convite.js). */
function Login({ convite }: { convite?: boolean }) {
  const m = S.authMode;
  return (
    <div class="auth">
      {convite && (
        <div class="panel" style="margin-bottom:12px">
          <div id="invHead"></div>
        </div>
      )}
      <div class="panel">
        <div class="seg" style="display:flex;margin-bottom:16px">
          <button style="flex:1" aria-pressed={m === 'signup'} data-a="authMode" data-v="signup">
            {tx('login.criarConta')}
          </button>
          <button style="flex:1" aria-pressed={m === 'login'} data-a="authMode" data-v="login">
            {tx('login.entrar')}
          </button>
        </div>
        {m === 'signup' ? <CriarConta /> : <Entrar />}
      </div>
      <p class="versao small muted">{tx('comum.versao', { n: numeroVersao() })}</p>
    </div>
  );
}

/* Lugar da tela (a página monta como texto e a tela entra logo depois, com montarAuth). */
const vAuth = () => '<div id="authRaiz"></div>';
function montarAuth(convite?: boolean) {
  const el = document.getElementById('authRaiz');
  if (!el) return;
  render(<Login convite={convite} />, el);
  if (S.authMode === 'signup') preencherPais();
}

/* Liga o botão "Criar conta" só com tudo certo e, desligado, diz o motivo (KAN-187: nunca só cinza).
   Com `enter` (a pessoa apertou Enter com o botão desligado), diz o que falta mesmo no que ela ainda não terminou. */
const emailOk = (e: string) => /\S+@\S+\.\S+/.test(e);
function checkPw(enter?: boolean) {
  const p = $('#lp') as HTMLInputElement | null,
    p2 = $('#lp2') as HTMLInputElement | null,
    b = $('#sgBtn') as HTMLButtonElement | null;
  if (!p || !p2 || !b) return;
  document
    .querySelectorAll<HTMLElement>('#pwr li')
    .forEach(li => li.classList.toggle('ok', PWR[+li.dataset.i!][0](p.value)));
  const email = val('le'),
    senhaPronta = pwOk(p.value) && p.value === p2.value;
  b.disabled = !(senhaPronta && emailOk(email));
  let motivo = '';
  if (p2.value && p.value !== p2.value) motivo = tx('senha.naoConferem');
  else if ((senhaPronta || enter) && !emailOk(email))
    motivo = tx(email ? 'auth.emailIncompleto' : 'auth.emailFaltando');
  else if (enter && !pwOk(p.value)) motivo = tx('auth.senhaFalta', { itens: pwFalta(p.value).join(', ') });
  else if (enter && p.value !== p2.value) motivo = tx('senha.naoConferem');
  ($('#lerr') as HTMLElement).textContent = motivo;
}

export { AUTH_CANCEL, ESPECIAIS, authMsg, avisoGoogle, checkPw, montarAuth, pwFalta, pwOk, vAuth };
