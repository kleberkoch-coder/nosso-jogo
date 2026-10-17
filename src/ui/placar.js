import { S } from '../nucleo/estado.js';

/* ---------- Partida: placar e cronômetro (a tela fica em telas/Partida.tsx, KAN-160) ---------- */
function sumPts(gs, t) {
  return gs.filter(g => g.t === t).reduce((s, g) => s + (g.pts || 1), 0);
}
function elapsed() {
  const L = S.live;
  return L.el + (L.run ? (Date.now() - L.st) / 1000 : 0);
}
/* KAN-73: quando o tempo acaba, o número pisca só 3 vezes e fica parado (a classe "pisca" entra uma vez só). */
function tick() {
  const el = document.getElementById('clock');
  if (!el || !S.live) return;
  /* Sem tempo (KAN-175): conta para cima, sem alarme. */
  if (!S.live.dur) {
    const s = elapsed();
    el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    el.classList.remove('over', 'pisca');
    const m = document.getElementById('clockMsg');
    if (m) m.hidden = true;
    return;
  }
  const rem = S.live.dur - elapsed(),
    a = Math.abs(rem);
  el.textContent =
    (rem < 0 ? '+' : '') +
    String(Math.floor(a / 60)).padStart(2, '0') +
    ':' +
    String(Math.floor(a % 60)).padStart(2, '0');
  el.classList.toggle('over', rem <= 0);
  if (rem > 0) S.live.pisc = false;
  else if (!S.live.pisc) {
    S.live.pisc = true;
    el.classList.add('pisca');
  }
  const msg = document.getElementById('clockMsg');
  if (msg) msg.hidden = rem > 0;
  if (rem <= 0 && !S.live.beeped && S.live.run) {
    S.live.beeped = true;
    beep();
  }
}
setInterval(() => {
  if (S.tab === 'partida' && S.route.n === 'admin') tick();
}, 250);
let actx = null;
function beep() {
  try {
    if (!actx) return;
    [0, 0.35, 0.7].forEach(d => {
      const o = actx.createOscillator(),
        g = actx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(actx.destination);
      g.gain.setValueAtTime(0.25, actx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d + 0.3);
      o.start(actx.currentTime + d);
      o.stop(actx.currentTime + d + 0.3);
    });
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  } catch (e) {}
}

function setActx(v) {
  actx = v;
}

export { actx, beep, elapsed, setActx, sumPts, tick };
