import { hasPos, sport } from '../dominio/esportes.js';
import { tx } from '../i18n/index.js';
import { ppos } from '../dominio/grupo.js';
import { CAP } from '../nucleo/backend.js';
import { $ } from '../nucleo/util.js';

/* =================== diálogos =================== */
const dlg = $('#dlg');
/* KAN-74: com botão principal no rodapé, o teclado do celular mostra "Concluir" e o Enter envia (ver eventos.js). */
function openDlg(h) {
  conf = null;
  alterada = false;
  dlg.removeAttribute('aria-labelledby');
  const b = $('#dlgBody');
  b.innerHTML = h;
  fotoForm = valoresForm();
  setTimeout(() => {
    fotoForm = valoresForm();
  }, 0);
  if (b.querySelector('.dlg-f .btn.primary,.dlg-f .btn.bib'))
    b.querySelectorAll('input.inp:not([enterkeyhint])').forEach(i => {
      if (i.id !== 'avq') i.setAttribute('enterkeyhint', 'done');
    });
  if (!dlg.open) dlg.showModal();
}
function closeDlgNow() {
  if (dlg.open) dlg.close();
}
function closeDlg() {
  if (CAP) {
    CAP.close = true;
    return;
  }
  if (conf) {
    naoConfirmar();
    return;
  }
  closeDlgNow();
}
/* KAN-140: tocar fora ou Esc numa janela com algo já preenchido não joga o trabalho fora: pergunta antes.
   "Preenchido" = algum campo diferente de quando a janela abriu. Sem mudança, fecha direto como antes. */
let fotoForm = '';
/* KAN-202: janelas que guardam o que foi feito fora dos campos (os + e − da artilharia, os gols de Editar partida)
   avisam que mudaram; assim tocar fora também pergunta antes de descartar. */
let alterada = false;
const marcarAlterada = () => {
  alterada = true;
};
function valoresForm() {
  return [
    ...document.querySelectorAll(
      '#dlgBody input,#dlgBody select,#dlgBody textarea,#dlgBody [aria-pressed],#dlgBody [data-sp],#dlgBody [data-freq]'
    ),
  ]
    .filter(e => !e.closest('#dlgGuardado,.conf'))
    .map(e =>
      e.tagName === 'BUTTON'
        ? e.getAttribute('aria-pressed')
        : e.type === 'checkbox' || e.type === 'radio'
          ? e.checked
          : 'value' in e && e.tagName !== 'DIV'
            ? e.value
            : (e.dataset.sp || '') + '|' + (e.dataset.freq || '')
    )
    .join('\u0001');
}
function fecharPerguntando() {
  if (conf) {
    naoConfirmar();
    return;
  }
  if (!$('#dlgBody .dlg-f .btn.primary,#dlgBody .dlg-f .btn.bib') || (valoresForm() === fotoForm && !alterada)) {
    closeDlgNow();
    return;
  }
  confirmou(null, {
    titulo: tx('janela.descartarTitulo'),
    texto: tx('janela.descartarTexto'),
    acao: tx('janela.descartar'),
    cancelar: tx('janela.continuarEditando'),
    perigo: true,
  });
}
dlg.addEventListener('click', e => {
  if (e.target === dlg) fecharPerguntando();
});

/* ---------- Janela de confirmação do app (KAN-128): no lugar do confirm() e do alert() do navegador ----------
   Uso numa ação:  const c=confirmou(el,{titulo,texto,acao,perigo});if(c!=='sim')return;  ...segue a ação...
   - Na 1ª vez abre a janela e devolve null. "Sim" roda a MESMA ação de novo com o mesmo botão, agora devolvendo 'sim'
     (assim o carregando, a gravação sem sinal e o fechar só depois de gravar continuam iguais a qualquer botão).
   - Com `nao`, a janela tem um segundo caminho (devolve 'nao'). Cancelar, Esc e tocar fora não fazem nada.
   - Aberta por cima de outra janela (ex.: Editar grupo), o formulário fica guardado escondido e volta ao Cancelar. */
let conf = null;
function confirmou(el, o) {
  if (el && el._conf) {
    const r = el._conf;
    delete el._conf;
    return r;
  }
  const body = $('#dlgBody');
  let guardado = null;
  if (dlg.open) {
    guardado = document.createElement('div');
    guardado.id = 'dlgGuardado';
    guardado.hidden = true;
    while (body.firstChild) guardado.appendChild(body.firstChild);
  } else body.replaceChildren();
  conf = { el, a: el && el.dataset && el.dataset.a, guardado, volta: document.activeElement, fim: o.fim };
  /* Montada elemento por elemento: os textos entram como texto, nunca como HTML. */
  const el_ = (tag, cls, txt, a) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    if (a) e.dataset.a = a;
    return e;
  };
  const h = el_('div', 'conf'),
    t = el_('h3', null, o.titulo),
    f = el_('div', 'dlg-f');
  t.id = 'confT';
  h.append(t);
  if (o.texto) h.append(el_('p', 'conf-txt', o.texto));
  if (!o.unico) f.append(el_('button', 'btn', o.cancelar || tx('comum.cancelar'), 'confNao'));
  if (o.nao) f.append(el_('button', 'btn', o.nao, 'confOutro'));
  f.append(el_('button', 'btn ' + (o.perigo ? 'perigo' : 'primary'), o.acao, 'confSim'));
  h.append(f);
  body.appendChild(h);
  if (guardado) body.appendChild(guardado);
  dlg.setAttribute('aria-labelledby', 'confT');
  if (!dlg.open) dlg.showModal();
  setTimeout(() => h.querySelector('[data-a=confNao],[data-a=confSim]')?.focus(), 20);
  return null;
}
/* Volta ao formulário guardado (ou fecha), sem fazer nada. */
function naoConfirmar() {
  const c = conf;
  if (!c) return;
  conf = null;
  dlg.removeAttribute('aria-labelledby');
  if (c.guardado) {
    const body = $('#dlgBody');
    body.querySelector('.conf')?.remove();
    while (c.guardado.firstChild) body.appendChild(c.guardado.firstChild);
    c.guardado.remove();
  } else closeDlgNow();
  if (c.fim) c.fim();
  if (c.volta && c.volta.isConnected) c.volta.focus();
}
/* "Sim" ou o segundo caminho: roda a ação de novo. Se ela não fechar a janela nem abrir outra, volta ao formulário guardado. */
function responder(r, ACT) {
  const c = conf;
  if (!c) return;
  conf = null;
  dlg.removeAttribute('aria-labelledby');
  const f = ACT[c.a];
  if (!f || !c.el) {
    closeDlg();
    if (c.fim) c.fim();
    return;
  }
  c.el._conf = r;
  const res = f(c.el);
  if (c.fim) c.fim();
  if (!(CAP && CAP.close) && $('#dlgBody .conf')) {
    if (c.guardado) {
      const body = $('#dlgBody');
      body.querySelector('.conf').remove();
      while (c.guardado.firstChild) body.appendChild(c.guardado.firstChild);
      c.guardado.remove();
    } else closeDlg();
  }
  if (c.volta && c.volta.isConnected)
    setTimeout(() => {
      if (!dlg.open && c.volta.isConnected) c.volta.focus();
    }, 0);
  return res;
}
/* Esc com a confirmação aberta: só a confirmação fecha (volta ao formulário, se houver). */
dlg.addEventListener('cancel', e => {
  e.preventDefault();
  fecharPerguntando();
});
dlg.addEventListener('close', () => {
  if (conf) {
    const c = conf;
    conf = null;
    if (c.fim) c.fim();
  }
});
/* Aviso de uma linha com "Entendi" (no lugar do alert): resolve quando a janela fecha. */
function avisar(titulo, texto) {
  return new Promise(res => {
    confirmou(null, { titulo, texto, acao: tx('comum.entendi'), unico: true, fim: res });
  });
}
const val = id => (document.getElementById(id)?.value || '').trim();
const posSel = (id, v) =>
  `<select class="sel" id="${id}">${sport()
    .pos.map(([k, l]) => `<option value="${k}" ${(v || ppos('')) === k ? 'selected' : ''}>${l}</option>`)
    .join('')}</select>`;
const posField = (id, v) =>
  hasPos() ? `<label class="f"><span>${tx('comum.posicao')}</span>${posSel(id, v)}</label>` : '';

export {
  avisar,
  closeDlg,
  closeDlgNow,
  confirmou,
  dlg,
  marcarAlterada,
  naoConfirmar,
  openDlg,
  posField,
  responder,
  val,
};
