/* Ações: Partida: placar, cronômetro e salvar (recalcular os totais fica em acoes/recalcular.ts). Fazem parte de ACT (src/acoes.js). */
import { sport, tn } from '../dominio/esportes.js';
import { curRodada, pname } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { addMatch, delMatch as apagarPartida, editMatch, salvarArtilharia } from '../nucleo/partidas.js';
import { GB, S, w } from '../nucleo/estado.js';
import { $, esc, toast, uid } from '../nucleo/util.js';
import { actx, beep, elapsed, setActx, sumPts } from '../ui/placar.js';
import { artAtual, limiteAtingido, montarArtilharia, montarEscalacao, novaPartida, quadra } from '../telas/Partida';
import { correcaoAtual, edicaoAtual, montarCorrecao, montarEdicao } from '../telas/PartidaGols';
import { artilhariaDe, partidasDe } from '../nucleo/partidas-lista.js';
import { mandarPartidas } from '../ui/zap-partidas';
import { closeDlg, confirmou, dlg, openDlg } from '../ui/dialogos.js';
import { janelaPonto } from '../ui/JanelaPonto';
import { changed, render } from '../ui/render.js';
import { ACT } from '../acoes.js';
import { campDe, desempateEscolhido, janelaCampeonato } from '../telas/Campeonato';
import { MAX_TIMES, MIN_TIMES, novoCampeonato } from '../dominio/campeonato';
import { recurso } from '../dominio/grupo.js';
import { op } from '../nucleo/backend.js';

/* KAN-233: grava o campeonato na ficha da rodada (campo camp), com a tela mudando na hora. */
function gravarCamp(r, camp) {
  const d = S.rod[r.id] || {};
  S.rod[r.id] = Object.assign({}, d, { camp });
  if (!camp) delete S.rod[r.id].camp;
  changed();
  return w(GB.patch('rodadas/' + r.id, { camp: camp || op.apagar() }));
}

/* KAN-75: título da janela do ponto, pelo catálogo do esporte.
   "+2" vira "+2 pontos"; "Gol" fica "Gol"; "TD" vira "TD (+6)"; "2 pts" fica como está. */
function nomePonto(sc, SP) {
  const [r, p] = sc;
  if (/^\+\d+$/.test(r)) return r + ' ' + (p === 1 ? SP.unit : SP.word.toLowerCase());
  return p > 1 && !/\d/.test(r) ? r + ' (+' + p + ')' : r;
}

const acoes = {
  /* KAN-233: formato da rodada. Campeonato abre a janela (montar ou mudar o desempate); Livre desfaz, com confirmação. */
  abrirCampeonato: () => {
    const r = curRodada();
    if (!r || !r.times) return;
    const n = r.times.length;
    if (!campDe(r) && (!recurso('campeonato') || n < MIN_TIMES || n > MAX_TIMES)) return;
    openDlg(janelaCampeonato(r));
    dlg.setAttribute('aria-labelledby', 'campDlgTitulo');
    setTimeout(() => $('#campCrit input')?.focus(), 30);
  },
  comecarCampeonato: () => {
    const r = curRodada();
    if (!r || !r.times || campDe(r)) return closeDlg();
    const c = novoCampeonato(r.times.length, desempateEscolhido(), Date.now(), Math.floor(Math.random() * 2 ** 31));
    closeDlg();
    /* O jogo em andamento que ainda não começou passa a ser o primeiro do campeonato. */
    const L = S.live;
    if (L && L.rid === r.id && !L.goals.length && !L.run && !L.el) L.auto = true;
    toast(tx('camp.comecou', { n: c.jogos.length }));
    return gravarCamp(r, c);
  },
  salvarDesempate: () => {
    const r = curRodada(),
      c = r && campDe(r);
    if (!c) return closeDlg();
    closeDlg();
    toast(tx('camp.desempateSalvo'));
    return gravarCamp(r, Object.assign({}, c, { crit: desempateEscolhido() }));
  },
  formatoLivre: el => {
    const r = curRodada();
    if (!r || !r.camp) return;
    if (
      confirmou(el, {
        titulo: tx('camp.livreTitulo'),
        texto: tx('camp.livreTexto'),
        acao: tx('camp.livreAcao'),
      }) !== 'sim'
    )
      return;
    toast(tx('camp.voltouLivre'));
    return gravarCamp(r, null);
  },
  goal: el => {
    const r = curRodada(),
      L = S.live,
      t = el.dataset.v,
      ti = t === 'a' ? L.a : L.b,
      oi = t === 'a' ? L.b : L.a,
      SP = sport(),
      sc = SP.score[+el.dataset.i || 0],
      pts = sc[1];
    janelaPonto({
      titulo: tx('partida.pontoTime', { ponto: nomePonto(sc, SP), time: tn(ti) }),
      t,
      pts,
      atuais: quadra(r, t).atuais,
      contra: SP.og ? quadra(r, t === 'a' ? 'b' : 'a').atuais : null,
    });
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
  /* KAN-232: as partidas da rodada no WhatsApp, com a artilharia e a classificação. */
  zapPartidas: () => {
    const r = curRodada();
    if (!r) return;
    const ms = partidasDe(r.id);
    if (!ms.length) return;
    const a = artilhariaDe(r.id);
    mandarPartidas(r, ms, a && a.gols);
  },
  /* KAN-229: corrigir qualquer gol da partida em andamento (autor, time, tirar ou somar). */
  corrigirGols: () => {
    if (!S.live) return;
    openDlg('cgRaiz');
    dlg.setAttribute('aria-labelledby', 'cgTitulo');
    if (!montarCorrecao()) closeDlg();
    else setTimeout(() => $('#cgRaiz .ed-autor')?.focus(), 30);
  },
  salvarCorrecao: () => {
    const gs = correcaoAtual(),
      L = S.live;
    if (!gs || !L) return;
    L.goals = gs.map(g => ({ t: g.t, pid: g.pid || null, og: !!g.og, pts: g.pts || 1 }));
    /* Se a correção tirou o placar do limite, o aviso some; se chegou nele, avisa como num gol. */
    if (!limiteAtingido(L)) L.limAviso = false;
    else if (!L.limAviso) {
      L.limAviso = true;
      if (L.run) {
        L.el = elapsed();
        L.run = false;
      }
    }
    closeDlg();
    toast(tx('partida.corrigido', { a: sumPts(L.goals, 'a'), b: sumPts(L.goals, 'b') }));
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
      /* v60: posição dos times na rodada, para o nome "Time 1" não depender da cor do colete. */
      ta: L.a,
      tb: L.b,
      /* KAN-177: quem esteve em quadra (com empréstimos e trocas) conta o jogo e o resultado. */
      pa: quadra(r, 'a').jogaram,
      pb: quadra(r, 'b').jogaram,
      ga,
      gb,
      goals: L.goals.map(g => ({ t: g.t, pid: g.pid, og: g.og, pts: g.pts || 1 })),
      at: Date.now(),
    });
    /* KAN-175: o próximo jogo sai dos jogos salvos (quem ganha fica, entra quem espera há mais tempo). */
    S.live = novaPartida(r, L);
    toast(tx('partida.salva', { a: tn(L.a), ga, gb, b: tn(L.b) }));
  },
  /* KAN-178: artilharia da rodada (só o total de gols de cada jogador). */
  abrirArtilharia: () => {
    openDlg('artRaiz');
    if (!montarArtilharia()) closeDlg();
  },
  salvarArtilharia: () => {
    const g = artAtual(),
      r = curRodada();
    if (!g || !r) return;
    const gols = {};
    Object.entries(g).forEach(([id, n]) => {
      if (n > 0) gols[id] = n;
    });
    closeDlg();
    toast(tx('partida.artSalva'));
    return salvarArtilharia(r.id, gols);
  },
  /* KAN-177: escalação de um lado (empréstimo, troca, alguém da lista de presença). */
  abrirEscalacao: el => {
    openDlg('escRaiz');
    if (!montarEscalacao(el.dataset.v, render)) closeDlg();
  },
  /* KAN-176: corrigir uma partida salva (autores, gols a mais ou a menos). */
  editarPartida: el => {
    openDlg('edRaiz');
    if (!montarEdicao(el.dataset.v)) closeDlg();
  },
  salvarEdicao: el => {
    const e = edicaoAtual(),
      r = curRodada();
    if (!e || !r || e.mid !== el.dataset.v) return;
    const goals = e.goals.map(g => ({ t: g.t, pid: g.pid || null, og: !!g.og, pts: g.pts || 1 })),
      ga = sumPts(goals, 'a'),
      gb = sumPts(goals, 'b');
    closeDlg();
    toast(tx('partida.editada', { a: ga, b: gb }));
    return editMatch(r.id, e.mid, { goals, ga, gb });
  },
  delMatch: el => {
    if (
      confirmou(el, {
        titulo: tx('partida.apagarTitulo'),
        texto: tx('partida.apagarTexto'),
        acao: tx('partida.apagarAcao'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    return apagarPartida(curRodada().id, el.dataset.v);
  },
};

export { acoes };
