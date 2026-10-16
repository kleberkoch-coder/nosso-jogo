/* Aba Partida (KAN-160): componente em TypeScript + Preact, com o seletor de rodada sempre no topo.
   O cronômetro continua sendo atualizado por tick(), pelo id "clock" (a cada 250 ms, sem redesenhar a tela). */
import { render } from 'preact';
import { cfg } from '../dominio/caixa.js';
import { col, sport, tn } from '../dominio/esportes.js';
import { curRodada, pname } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { partidasDe } from '../nucleo/partidas-lista.js';
import { SeletorRodada } from '../ui/componentes';
import { rodadasProntas } from './rodada-partes.js';
import { sumPts } from '../ui/placar.js';

type Time = { c: number; players: string[] };
type Rodada = { id: string; date: string; time?: string; times?: Time[] | null };
type Gol = { t: 'a' | 'b'; pid?: string | null; og?: boolean; pts?: number };
type Partida = { id: string; ca: number; cb: number; ga: number; gb: number; goals: Gol[] };

const st = (): any => estado;
const MINUTOS = [5, 7, 8, 10, 12, 15, 20, 25, 30, 45];

function Placar({ r }: { r: Rodada }) {
  const L = st().live,
    times = r.times as Time[],
    SP = sport() as unknown as { score: [string, number][] };
  const lado = (t: 'a' | 'b') => {
    const time = times[t === 'a' ? L.a : L.b],
      c = col(time.c);
    const gols = (L.goals as Gol[])
      .filter(g => g.t === t)
      .map(
        g =>
          (g.pid ? pname(g.pid) + (g.og ? ' ' + tx('partida.contraMarca') : '') : '—') +
          ((g.pts || 1) > 1 ? ` (${g.pts})` : '')
      )
      .join(', ');
    return (
      <div>
        <div class="tn">
          <span class="dot" style={{ background: c.c }}></span>
          {tn(time.c)}
        </div>
        <div class="sc">{sumPts(L.goals, t)}</div>
        <div class="goals">{gols}</div>
        <div class={'pts' + (SP.score.length >= 4 ? ' grade' : '')}>
          {SP.score.map(([rotulo], i) => (
            <button key={i} class="btn bib" data-a="goal" data-v={t} data-i={i}>
              {SP.score.length === 1 ? '+ ' + rotulo : rotulo}
            </button>
          ))}
        </div>
      </div>
    );
  };
  return (
    <div class="board">
      <div class="sides">
        {lado('a')}
        <div class="x">×</div>
        {lado('b')}
      </div>
      <div id="clock">--:--</div>
      <div id="clockMsg" class="clock-msg" role="status" hidden>
        {tx('partida.tempoEsgotado')}
      </div>
      <div class="row" style="justify-content:center">
        <button class="btn" data-a="clock" id="clockBtn">
          {tx(L.run ? 'partida.pausar' : 'partida.iniciar')}
        </button>
        <button class="btn" data-a="clockReset">
          {tx('partida.zerar')}
        </button>
        <button class="btn" data-a="undoGoal" disabled={!L.goals.length}>
          {tx('partida.desfazer')}
        </button>
      </div>
    </div>
  );
}

function Ajustes({ r }: { r: Rodada }) {
  const L = st().live,
    times = r.times as Time[];
  const opcoes = (sel: number, pula: number) =>
    times.map((t, i) => (
      <option key={i} value={i} selected={i === sel} disabled={i === pula}>
        {tn(t.c)}
      </option>
    ));
  return (
    <div class="panel">
      <div class="row">
        <label class="f" style="margin:0;flex:1;min-width:120px">
          <span>{tx('partida.timeA')}</span>
          <select class="sel" data-c="ta">
            {opcoes(L.a, L.b)}
          </select>
        </label>
        <label class="f" style="margin:0;flex:1;min-width:120px">
          <span>{tx('partida.timeB')}</span>
          <select class="sel" data-c="tb">
            {opcoes(L.b, L.a)}
          </select>
        </label>
        <label class="f" style="margin:0;width:110px">
          <span>{tx('partida.minutos')}</span>
          <select class="sel" data-c="dur">
            {MINUTOS.map(m => (
              <option key={m} selected={m * 60 === L.dur}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn primary" data-a="saveMatch">
          {tx('partida.salvar')}
        </button>
        {times.length > 2 ? <span class="small muted">{tx('partida.vencedorFica')}</span> : null}
      </div>
    </div>
  );
}

function Salvas({ r }: { r: Rodada }) {
  const S = st(),
    ms = partidasDe(r.id) as Partida[],
    carregou = S.partsRid === r.id && S.loaded.parts;
  const autores = (m: Partida) =>
    m.goals
      .filter(g => g.pid && !g.og)
      .map(g => pname(g.pid) + ((g.pts || 1) > 1 ? ' (' + g.pts + ')' : ''))
      .join(', ');
  return (
    <div class="panel">
      <h3>{tx('partida.salvasTitulo')}</h3>
      {ms.length ? (
        <ul class="plist wrap">
          {ms.map((m, i) => (
            <li key={m.id}>
              <span class="num">{i + 1}</span>
              <span class="pn">
                <span class="dot" style={{ background: col(m.ca).c }}></span> {tn(m.ca)}{' '}
                <b>
                  {m.ga} × {m.gb}
                </b>{' '}
                {tn(m.cb)} <span class="dot" style={{ background: col(m.cb).c }}></span>{' '}
                <span class="small muted">
                  {autores(m) ? ' — ' + (sport() as { word: string }).word.toLowerCase() + ': ' + autores(m) : ''}
                </span>
              </span>
              <button class="btn sm ghost danger" data-a="delMatch" data-v={m.id}>
                {tx('partida.apagar')}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="muted small">{carregou ? tx('partida.nenhumaSalva') : tx('comum.carregando')}</p>
      )}
    </div>
  );
}

function PartidaTela() {
  const S = st();
  if (!rodadasProntas()) return <div class="empty muted">{tx('comum.carregando')}</div>;
  const r = curRodada() as Rodada | null;
  if (!r) {
    return (
      <div class="panel empty">
        <h2>{tx('rodada.nenhuma')}</h2>
        <p class="muted">{tx('partida.semRodada')}</p>
        <button class="btn" data-a="tab" data-v="rodada">
          {tx('partida.irRodada')}
        </button>
      </div>
    );
  }
  /* KAN-160: sem times, o seletor continua no topo para escolher outra rodada. */
  if (!r.times) {
    return (
      <div class="stack">
        <SeletorRodada r={r} />
        <div class="panel empty">
          <h2>{tx('partida.semTimes')}</h2>
          <p class="muted">{tx('partida.semTimesTexto')}</p>
          <button class="btn" data-a="tab" data-v="rodada">
            {tx('partida.irRodada')}
          </button>
        </div>
      </div>
    );
  }
  if (!S.live || S.live.rid !== r.id || S.live.a >= r.times.length || S.live.b >= r.times.length)
    S.live = { rid: r.id, a: 0, b: 1, goals: [], dur: cfg().minutes * 60, el: 0, run: false, st: 0, beeped: false };
  return (
    <div class="stack">
      <SeletorRodada r={r} />
      <Placar r={r} />
      <Ajustes r={r} />
      <Salvas r={r} />
    </div>
  );
}

/* A gestão desenha as abas com texto; a Partida entra num lugar reservado (#partidaRaiz), como Rodada e Caixa. */
const vPartida = () => '<div id="partidaRaiz"></div>';
function montarPartida() {
  const el = document.getElementById('partidaRaiz');
  if (el) render(<PartidaTela />, el);
}

export { montarPartida, vPartida };
