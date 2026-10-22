/* Comportamento do campo de horário do app (KAN-151, decisão do Kleber em 15/10): hora e minutos lado a lado,
   cada um com ▲ e ▼ e também digitável, no lugar do relógio do celular (que no Android com letra grande corta o botão).
   Aceita qualquer minuto (ex.: 10:03). O valor "HH:MM" (sempre 24h) fica num campo escondido com o id ou a classe
   de sempre (#rtm, #rfm, .si, .sf), então quem lê o formulário não muda. Com `data-opcional`, tudo em branco = sem horário.
   KAN-163: no país de relógio de 12h (data-doze), a hora vai de 1 a 12 e um botão troca AM/PM.
   O desenho do campo é o componente HoraCampo (ui/componentes.tsx); aqui ficam as setas, a digitação e a gravação. */
import { para12, para24 } from '../dominio/relogio';
import { tx } from '../i18n/index.js';

type Caixa = HTMLElement;
const dois = (n: number) => String(n).padStart(2, '0');
const campo = (box: Caixa, c: string) => box.querySelector('.' + c) as HTMLInputElement;
const escondido = (box: Caixa) => box.querySelector('input[type=hidden]') as HTMLInputElement;
const doze = (box: Caixa) => box.hasAttribute('data-doze');

/* Botão AM/PM: mostra o período atual. */
function periodo(box: Caixa, pm: boolean) {
  box.dataset.pm = pm ? '1' : '';
  const b = box.querySelector('[data-hap]') as HTMLButtonElement | null;
  if (!b) return;
  const t = tx(pm ? 'relogio.pm' : 'relogio.am');
  b.textContent = t;
  b.setAttribute('aria-label', tx('hora.periodo', { atual: t }));
}

/* Mostra uma hora de 0 a 23 nos campos visíveis (no relógio de 12h, hora de 1 a 12 e o período no botão). */
function mostrar(box: Caixa, h: number, m: number) {
  if (doze(box)) {
    const t = para12(h);
    campo(box, 'hh').value = String(t.h);
    periodo(box, t.pm);
  } else campo(box, 'hh').value = dois(h);
  campo(box, 'hm').value = dois(m);
}

/* Hora de 0 a 23 que está nos campos visíveis. */
function hora24(box: Caixa): number {
  const v = +campo(box, 'hh').value || 0;
  return doze(box) ? para24(v || 12, box.dataset.pm === '1') : v;
}

/* Junta hora e minutos no campo escondido. Só a hora preenchida vale como "HH:00"; tudo vazio = sem horário. */
function gravar(box: Caixa) {
  const hh = campo(box, 'hh'),
    mm = campo(box, 'hm');
  escondido(box).value = hh.value === '' && mm.value === '' ? '' : dois(hora24(box)) + ':' + dois(+mm.value || 0);
}

/* Primeiro toque numa seta com o campo vazio: parte do horário do campo anterior (ex.: término começa no início). */
function semente(box: Caixa): [number, number] {
  const todos = [...(box.closest('.srow,.row,.dlg') || document).querySelectorAll('[data-hora] input[type=hidden]')],
    i = todos.indexOf(escondido(box));
  for (let k = i - 1; k >= 0; k--) {
    const v = (todos[k] as HTMLInputElement).value;
    if (v) return v.split(':').map(Number) as [number, number];
  }
  return [20, 0];
}

/* Vazio: preenche com a semente. Devolve true quando era um campo opcional (o primeiro toque só preenche). */
function preencherVazio(box: Caixa): boolean {
  if (campo(box, 'hh').value !== '' || campo(box, 'hm').value !== '') return false;
  const [a, b] = semente(box);
  mostrar(box, a, b);
  if (box.hasAttribute('data-opcional')) {
    gravar(box);
    return true;
  }
  return false;
}

function mexer(box: Caixa, sinal: string, p: string) {
  if (preencherVazio(box)) return;
  const d = sinal === '+' ? 1 : -1;
  if (p === 'h') {
    // A hora anda em 24h: no relógio de 12h, 11 PM ▲ vira 12 AM e 11 AM ▲ vira 12 PM.
    mostrar(box, (hora24(box) + d + 24) % 24, +campo(box, 'hm').value || 0);
  } else {
    const mm = campo(box, 'hm');
    mm.value = dois(((+mm.value || 0) + d + 60) % 60);
    if (campo(box, 'hh').value === '') mostrar(box, 0, +mm.value);
  }
  gravar(box);
}

function trocarPeriodo(box: Caixa) {
  if (preencherVazio(box)) return;
  periodo(box, box.dataset.pm !== '1');
  if (campo(box, 'hm').value === '') campo(box, 'hm').value = '00';
  gravar(box);
}

let repete: ReturnType<typeof setTimeout> | null = null;
const parar = () => {
  if (repete) {
    clearTimeout(repete);
    clearInterval(repete);
  }
  repete = null;
};
const caixaDe = (el: EventTarget | null): Caixa | null =>
  el instanceof Element ? (el.closest('[data-hora]') as Caixa | null) : null;

/* Segurar a seta passa rápido (útil nos minutos). */
document.addEventListener('pointerdown', e => {
  const b = e.target instanceof Element ? (e.target.closest('[data-hseta],[data-hap]') as HTMLElement | null) : null;
  const box = caixaDe(b);
  if (!b || !box) return;
  e.preventDefault();
  if (b.hasAttribute('data-hap')) {
    trocarPeriodo(box);
    return;
  }
  const [sinal, p] = [b.dataset.hseta![0], b.dataset.hseta![1]];
  mexer(box, sinal, p);
  parar();
  repete = setTimeout(() => {
    repete = setInterval(() => mexer(box, sinal, p), 90);
  }, 400);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => document.addEventListener(t, parar));
document.addEventListener('click', e => {
  const b = e.target instanceof Element ? e.target.closest('[data-hseta],[data-hap]') : null;
  if (!b) return;
  e.preventDefault();
  // Teclado (Enter ou espaço no botão AM/PM): o clique chega sem o toque antes.
  if (b.hasAttribute('data-hap') && (e as MouseEvent).detail === 0) trocarPeriodo(caixaDe(b)!);
});
document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement,
    box = caixaDe(el);
  if (!box || el.type === 'hidden') return;
  el.value = el.value.replace(/\D/g, '').slice(0, 2);
  if (+el.value > +el.dataset.max!) el.value = el.dataset.max!;
  gravar(box);
  if (el.value.length === 2 && el.classList.contains('hh')) campo(box, 'hm').focus();
});
document.addEventListener('focusout', e => {
  const el = e.target as HTMLInputElement,
    box = caixaDe(el);
  if (!box || el.type === 'hidden' || el.value === '') return;
  // No relógio de 12h, a hora fica de 1 a 12 (0 vira 12) e sem o zero na frente, como se escreve lá.
  el.value = doze(box) && el.classList.contains('hh') ? String(+el.value || 12) : dois(+el.value);
  gravar(box);
});
document.addEventListener('keydown', e => {
  const el = e.target as HTMLInputElement,
    box = caixaDe(el);
  if (!box || el.tagName !== 'INPUT' || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
  e.preventDefault();
  mexer(box, e.key === 'ArrowUp' ? '+' : '-', el.classList.contains('hh') ? 'h' : 'm');
});

export {};
