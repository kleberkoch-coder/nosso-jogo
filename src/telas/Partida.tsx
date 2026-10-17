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
import { proximoJogo, type Proximo } from '../dominio/fila';

type Time = { c: number; players: string[] };
type Rodada = { id: string; date: string; time?: string; times?: Time[] | null };
type Gol = { t: 'a' | 'b'; pid?: string | null; og?: boolean; pts?: number };
type Partida = { id: string; ca: number; cb: number; ga: number; gb: number; goals: Gol[] };

const st = (): any => estado;
const MINUTOS = [5, 7, 8, 10, 12, 15, 20, 25, 30, 45];
/* Fim por placar (KAN-175): 0 = sem limite. Vale para gols e para pontos. */
const LIMITES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 21, 25];

/* Sugestão do próximo jogo (KAN-175), a partir dos jogos salvos desta rodada (dominio/fila.ts). */
function sugestao(r: Rodada): Proximo {
  const times = r.times as Time[],
    pos = (c: number) => times.findIndex(t => t.c === c);
  const jogos = (partidasDe(r.id) as Partida[])
    .map(m => ({ a: pos(m.ca), b: pos(m.cb), ga: m.ga, gb: m.gb }))
    .filter(j => j.a >= 0 && j.b >= 0);
  return proximoJogo(times.length, jogos);
}
/* Quem está esperando, na ordem da fila, fora os dois times em quadra (mesmo que trocados à mão). */
function naEspera(r: Rodada, a: number, b: number): number[] {
  const s = sugestao(r);
  return [s.b, ...s.espera, s.a].filter((t, i, l) => t !== a && t !== b && l.indexOf(t) === i);
}
/* Placar chegou ao limite? */
const limiteAtingido = (L: { lim?: number; goals: Gol[] }) =>
  !!L.lim && (sumPts(L.goals, 'a') >= L.lim || sumPts(L.goals, 'b') >= L.lim);
/* Partida nova da rodada: times sugeridos, mantendo o tempo e o limite escolhidos antes. */
function novaPartida(r: Rodada, antes?: { dur?: number; lim?: number } | null) {
  const s = sugestao(r);
  return {
    rid: r.id,
    a: s.a,
    b: s.b,
    auto: true,
    goals: [],
    dur: antes && antes.dur != null ? antes.dur : cfg().minutes * 60,
    lim: (antes && antes.lim) || 0,
    el: 0,
    run: false,
    st: 0,
    beeped: false,
  };
}

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
      {limiteAtingido(L) ? (
        <div id="limMsg" class="clock-msg" role="status">
          {tx('partida.limiteAtingido', { n: L.lim })}
        </div>
      ) : null}
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
    times = r.times as Time[],
    espera = times.length > 2 ? naEspera(r, L.a, L.b) : [];
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
        <label class="f" style="margin:0;width:124px">
          <span>{tx('partida.minutos')}</span>
          <select class="sel" data-c="dur">
            {MINUTOS.map(m => (
              <option key={m} value={m} selected={m * 60 === L.dur}>
                {m}
              </option>
            ))}
            <option value="0" selected={L.dur === 0}>
              {tx('partida.semTempo')}
            </option>
          </select>
        </label>
        <label class="f" style="margin:0;width:130px">
          <span>{tx('partida.fimPorPlacar')}</span>
          <select class="sel" data-c="lim">
            {LIMITES.map(n => (
              <option key={n} value={n} selected={n === (L.lim || 0)}>
                {n ? n : tx('partida.semLimite')}
              </option>
            ))}
          </select>
        </label>
      </div>
      {espera.length ? (
        <p class="small" id="naEspera" style="margin:10px 0 0">
          <span class="muted">{tx('partida.naEspera')}</span>{' '}
          {espera.map((t, i) => (
            <span key={t}>
              {i ? ' · ' : ''}
              <span class="dot" style={{ background: col(times[t].c).c }}></span> {tn(times[t].c)}
            </span>
          ))}
        </p>
      ) : null}
      <div class="row" style="margin-top:12px">
        <button class="btn primary" data-a="saveMatch">
          {tx('partida.salvar')}
        </button>
        {times.length > 2 ? <span class="small muted">{tx('partida.sugestao')}</span> : null}
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
  const L = S.live;
  if (!L || L.rid !== r.id || L.a >= r.times.length || L.b >= r.times.length) S.live = novaPartida(r, L);
  else if (L.auto && !L.goals.length && !L.run && !L.el) {
    /* Ainda não começou: acompanha os jogos salvos (que podem chegar depois, ou de outro aparelho). */
    const s = sugestao(r);
    L.a = s.a;
    L.b = s.b;
  }
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

export { limiteAtingido, montarPartida, novaPartida, vPartida };
