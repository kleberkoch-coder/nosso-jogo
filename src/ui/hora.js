/* Campo de horário do app (KAN-151, decisão do Kleber em 15/10): hora (00 a 23) e minutos (00 a 59) lado a lado,
   cada um com ▲ e ▼ e também digitável, no lugar do relógio do celular (que no Android com letra grande corta o botão).
   Aceita qualquer minuto (ex.: 10:03). O valor "HH:MM" fica num campo escondido com o id ou a classe de sempre
   (#rtm, #rfm, .si, .sf), então quem lê o formulário não muda. Com `opcional`, os dois em branco = sem horário. */
import { esc } from '../nucleo/util.js';
import { tx } from '../i18n/index.js';

const dois = n => String(n).padStart(2, '0');
function horaCampo(id, cls, v, opcional, rotulo) {
  const [h, m] = /^\d{2}:\d{2}$/.test(v || '') ? v.split(':') : ['', ''];
  const parte = (p, val, max, nome) =>
    `<span class="hc"><button type="button" class="hseta" data-hseta="+${p}" tabindex="-1" aria-label="${esc(tx('hora.mais', { campo: nome }))}">▲</button>` +
    `<input class="inp h${p}" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${val}" placeholder="--" data-max="${max}" aria-label="${esc(rotulo + ' — ' + nome)}">` +
    `<button type="button" class="hseta" data-hseta="-${p}" tabindex="-1" aria-label="${esc(tx('hora.menos', { campo: nome }))}">▼</button></span>`;
  return (
    `<span class="hora" data-hora${opcional ? ' data-opcional' : ''}><input type="hidden" ${id ? `id="${id}" ` : ''}class="${cls}" value="${v && h ? esc(v) : ''}">` +
    parte('h', h, 23, tx('hora.hora')) +
    '<span class="hdois">:</span>' +
    parte('m', m, 59, tx('hora.minutos')) +
    '</span>'
  );
}

/* Junta hora e minutos no campo escondido. Só a hora preenchida vale como "HH:00"; tudo vazio = sem horário. */
function gravar(box) {
  const hh = box.querySelector('.hh'),
    mm = box.querySelector('.hm'),
    out = box.querySelector('input[type=hidden]');
  out.value = hh.value === '' && mm.value === '' ? '' : dois(+hh.value || 0) + ':' + dois(+mm.value || 0);
}
/* Primeiro toque numa seta com o campo vazio: parte do horário do campo anterior (ex.: término começa no início). */
function semente(box) {
  const todos = [...(box.closest('.srow,.row,.dlg') || document).querySelectorAll('[data-hora] input[type=hidden]')],
    i = todos.indexOf(box.querySelector('input[type=hidden]'));
  for (let k = i - 1; k >= 0; k--) if (todos[k].value) return todos[k].value.split(':').map(Number);
  return [20, 0];
}
function mexer(btn) {
  const box = btn.closest('[data-hora]'),
    [sinal, p] = [btn.dataset.hseta[0], btn.dataset.hseta[1]],
    hh = box.querySelector('.hh'),
    mm = box.querySelector('.hm');
  if (hh.value === '' && mm.value === '') {
    const [a, b] = semente(box);
    hh.value = dois(a);
    mm.value = dois(b);
    if (btn.closest('[data-opcional]')) {
      gravar(box);
      return;
    }
  }
  const el = p === 'h' ? hh : mm,
    max = +el.dataset.max,
    n = ((+el.value || 0) + (sinal === '+' ? 1 : -1) + max + 1) % (max + 1);
  el.value = dois(n);
  if (p === 'h' && mm.value === '') mm.value = '00';
  if (p === 'm' && hh.value === '') hh.value = '00';
  gravar(box);
}

let repete = null;
const parar = () => {
  clearTimeout(repete);
  clearInterval(repete);
  repete = null;
};
/* Segurar a seta passa rápido (útil nos minutos). */
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-hseta]');
  if (!b) return;
  e.preventDefault();
  mexer(b);
  parar();
  repete = setTimeout(() => {
    repete = setInterval(() => mexer(b), 90);
  }, 400);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => document.addEventListener(t, parar));
document.addEventListener('click', e => {
  if (e.target.closest('[data-hseta]')) e.preventDefault();
});
document.addEventListener('input', e => {
  const el = e.target;
  if (!el.closest || !el.closest('[data-hora]') || el.type === 'hidden') return;
  el.value = el.value.replace(/\D/g, '').slice(0, 2);
  if (+el.value > +el.dataset.max) el.value = el.dataset.max;
  gravar(el.closest('[data-hora]'));
  if (el.value.length === 2 && el.classList.contains('hh')) el.closest('[data-hora]').querySelector('.hm').focus();
});
document.addEventListener('focusout', e => {
  const el = e.target;
  if (!el.closest || !el.closest('[data-hora]') || el.type === 'hidden' || el.value === '') return;
  el.value = dois(+el.value);
  gravar(el.closest('[data-hora]'));
});
document.addEventListener('keydown', e => {
  const el = e.target;
  if (!el.closest || !el.closest('[data-hora]') || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
  e.preventDefault();
  mexer({
    closest: s => el.closest(s),
    dataset: { hseta: (e.key === 'ArrowUp' ? '+' : '-') + (el.classList.contains('hh') ? 'h' : 'm') },
  });
});

export { horaCampo };
