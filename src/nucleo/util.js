import { FORMATO, LOCAL, MOEDA, agora } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
/* =================== utilidades =================== */
const $ = s => document.querySelector(s);
const main = $('#main');
const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
/* Identificador seguro (KAN-76): só letras, números, _ e -. Nome de documento fora disso é ignorado na leitura,
   para nunca chegar ao HTML um identificador com aspas ou tags. */
const idOk = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const cl = o => (o == null ? null : JSON.parse(JSON.stringify(o)));
const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
/* Dinheiro na moeda e no formato do grupo (KAN-162): R$ 1.234,50 no Brasil, $1,234.50 nos EUA. */
const brl = v => (+v || 0).toLocaleString(FORMATO, { style: 'currency', currency: MOEDA });
/* Hoje no fuso do grupo (KAN-162). */
const today = () => {
  const d = agora();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const fdate = s => {
  if (!s) return '';
  // Dia da semana no idioma do app; dia e mês na ordem do país do grupo (16/10 no Brasil, 10/16 nos EUA).
  const d = new Date(s + 'T12:00');
  return (
    d.toLocaleDateString(LOCAL, { weekday: 'short' }).replace('.', '') +
    ', ' +
    d.toLocaleDateString(FORMATO, { day: '2-digit', month: '2-digit' })
  );
};
const fmonth = m => {
  const t = new Date(m + '-15T12:00').toLocaleDateString(LOCAL, { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
function toast(m, ms) {
  const t = $('#toast');
  avisoAcao = null;
  t.classList.remove('acao');
  t.textContent = m;
  t.classList.add('on');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('on'), ms || 2800);
}
/* Aviso flutuante com um botão (KAN-129), ex.: "Recebido de Bruno: R$ 80,00 · Desfazer". Fica 6 segundos; o tempo para
   enquanto o dedo ou o mouse está em cima. O botão passa pelo clique geral (data-a="avisoAcao"), com carregando e sem sinal. */
let avisoAcao = null,
  avisoParado = false;
function toastAcao(m, rotulo, fn, ms) {
  const t = $('#toast');
  t.textContent = '';
  const sp = document.createElement('span');
  sp.textContent = m;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'toast-btn';
  b.dataset.a = 'avisoAcao';
  b.textContent = rotulo;
  t.append(sp, b);
  t.classList.add('on', 'acao');
  avisoAcao = fn;
  const dur = ms || 6000;
  const fim = () => {
    clearTimeout(toast.h);
    toast.h = setTimeout(() => {
      if (avisoParado) return fim();
      t.classList.remove('on', 'acao');
      avisoAcao = null;
    }, dur);
  };
  fim();
}
function usarAvisoAcao() {
  const f = avisoAcao;
  avisoAcao = null;
  $('#toast').classList.remove('on', 'acao');
  return f ? f() : undefined;
}
const tt = $('#toast');
if (tt) {
  tt.addEventListener('pointerenter', () => {
    avisoParado = true;
  });
  tt.addEventListener('pointerleave', () => {
    avisoParado = false;
  });
  tt.addEventListener('focusin', () => {
    avisoParado = true;
  });
  tt.addEventListener('focusout', () => {
    avisoParado = false;
  });
}
function nextSat() {
  const d = agora();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/* Navegadores embutidos (Instagram, Facebook, alguns apps no Android): o Google não deixa fazer login neles. */
const inAppBrowser = () => /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|; wv\)/i.test(navigator.userAgent);
/* Nome do dia da semana (0 = domingo), do dicionário. */
const diaSemana = i => tx('dia.' + i);

export {
  $,
  brl,
  cl,
  diaSemana,
  esc,
  fdate,
  fmonth,
  idOk,
  inAppBrowser,
  key,
  main,
  nextSat,
  shuffle,
  toast,
  toastAcao,
  today,
  uid,
  usarAvisoAcao,
};
