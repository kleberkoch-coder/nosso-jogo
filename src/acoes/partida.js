/* Ações: Partida: placar, cronômetro e salvar (recalcular os totais fica em acoes/recalcular.ts). Fazem parte de ACT (src/acoes.js). */
import { sport, tn } from '../dominio/esportes.js';
import { curRodada, pname } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { addMatch, delMatch as apagarPartida } from '../nucleo/partidas.js';
import { S } from '../nucleo/estado.js';
import { $, esc, toast, uid } from '../nucleo/util.js';
import { actx, beep, elapsed, setActx, sumPts } from '../ui/placar.js';
import { limiteAtingido, novaPartida } from '../telas/Partida';
import { closeDlg, confirmou, dlg, openDlg } from '../ui/dialogos.js';
import { render } from '../ui/render.js';
import { ACT } from '../acoes.js';

/* KAN-75: título da janela do ponto, pelo catálogo do esporte.
   "+2" vira "+2 pontos"; "Gol" fica "Gol"; "TD" vira "TD (+6)"; "2 pts" fica como está. */
function nomePonto(sc, SP) {
  const [r, p] = sc;
  if (/^\+\d+$/.test(r)) return r + ' ' + (p === 1 ? SP.unit : SP.word.toLowerCase());
  return p > 1 && !/\d/.test(r) ? r + ' (+' + p + ')' : r;
}

const acoes = {
  goal: el => {
    const r = curRodada(),
      L = S.live,
      t = el.dataset.v,
      ti = t === 'a' ? L.a : L.b,
      oi = t === 'a' ? L.b : L.a,
      SP = sport(),
      sc = SP.score[+el.dataset.i || 0],
      pts = sc[1];
    openDlg(`<h3>${esc(tx('partida.pontoTime', { ponto: nomePonto(sc, SP), time: tn(r.times[ti].c) }))}</h3><p class="small muted">${tx('partida.quemMarcou')}</p><div class="vgrid">${r.times[ti].players.map(id => `<button class="opt" data-a="addGoal" data-v="${t}" data-p="${id}" data-pts="${pts}">${esc(pname(id))}</button>`).join('')}</div>
    ${SP.og ? `<p class="small muted" style="margin-top:14px">${tx('partida.contra')}</p><div class="vgrid">${r.times[oi].players.map(id => `<button class="opt" data-a="addGoal" data-v="${t}" data-p="${id}" data-og="1" data-pts="${pts}">${esc(pname(id))}</button>`).join('')}</div>` : ''}
    <div class="dlg-f"><button class="btn" data-a="addGoal" data-v="${t}" data-pts="${pts}">${tx('partida.semAutor')}</button><button class="btn" data-a="close">${tx('comum.cancelar')}</button></div>`);
  },
  addGoal: el => {
    const L = S.live;
    L.goals.push({ t: el.dataset.v, pid: el.dataset.p || null, og: !!el.dataset.og, pts: +el.dataset.pts || 1 });
    /* Fim por placar (KAN-175): avisa uma vez, pausa o cronômetro e toca como no fim do tempo. */
    if (limiteAtingido(L) && !L.limAviso) {
      L.limAviso = true;
      if (L.run) {
        L.el = elapsed();
        L.run = false;
      }
      beep();
    }
    closeDlg();
    render();
  },
  undoGoal: () => {
    S.live.goals.pop();
    if (!limiteAtingido(S.live)) S.live.limAviso = false;
    render();
  },
  clock: () => {
    const L = S.live;
    try {
      if (!actx) setActx(new (window.AudioContext || window.webkitAudioContext)());
      if (actx.state === 'suspended') actx.resume();
    } catch (e) {}
    if (L.run) {
      L.el = elapsed();
      L.run = false;
    } else {
      L.st = Date.now();
      L.run = true;
    }
    $('#clockBtn').textContent = tx(L.run ? 'partida.pausar' : 'partida.iniciar');
  },
  clockReset: () => {
    Object.assign(S.live, { el: 0, run: false, beeped: false });
    render();
  },
  saveMatch: () => {
    const r = curRodada(),
      L = S.live,
      ta = r.times[L.a],
      tb = r.times[L.b],
      ga = sumPts(L.goals, 'a'),
      gb = sumPts(L.goals, 'b');
    addMatch(r.id, {
      id: uid(),
      ca: ta.c,
      cb: tb.c,
      pa: ta.players.slice(),
      pb: tb.players.slice(),
      ga,
      gb,
      goals: L.goals.map(g => ({ t: g.t, pid: g.pid, og: g.og, pts: g.pts || 1 })),
      at: Date.now(),
    });
    /* KAN-175: o próximo jogo sai dos jogos salvos (quem ganha fica, entra quem espera há mais tempo). */
    S.live = novaPartida(r, L);
    toast(`Salvo: ${tn(ta.c)} ${ga} × ${gb} ${tn(tb.c)}`);
  },
  delMatch: el => {
    if (
      confirmou(el, {
        titulo: 'Apagar esta partida?',
        texto: 'O placar e os pontos dela saem do ranking. Não dá para desfazer.',
        acao: 'Apagar partida',
        perigo: true,
      }) !== 'sim'
    )
      return;
    return apagarPartida(curRodada().id, el.dataset.v);
  },
};

export { acoes };
