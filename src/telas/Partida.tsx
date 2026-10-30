/* Aba Partida (KAN-160): componente em TypeScript + Preact, com o seletor de rodada sempre no topo.
   O cronômetro continua sendo atualizado por tick(), pelo id "clock" (a cada 250 ms, sem redesenhar a tela). */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { cfg } from '../dominio/caixa.js';
import { artNome, col, sport, timeDoJogo, tn, tnJogo } from '../dominio/esportes.js';
import { attendance, curRodada, pname } from '../dominio/grupo.js';
import { desfazer, emQuadra, entrar, escVazia, podemEntrar, type Esc } from '../dominio/escalacao';
import { tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { artilhariaDe, partidasDe } from '../nucleo/partidas-lista.js';
import { SeletorRodada } from '../ui/componentes';
import { marcarAlterada } from '../ui/dialogos.js';
import { rodadasProntas } from './rodada-partes.js';
import { sumPts } from '../ui/placar.js';
import { proximoJogo, type Proximo } from '../dominio/fila';

type Time = { c: number; players: string[] };
type Rodada = { id: string; date: string; time?: string; times?: Time[] | null };
type Gol = { t: 'a' | 'b'; pid?: string | null; og?: boolean; pts?: number };
type Partida = {
  id: string;
  ca: number;
  cb: number;
  ga: number;
  gb: number;
  goals: Gol[];
  pa?: string[];
  pb?: string[];
};

const st = (): any => estado;
/* Qualquer minuto de 1 a 60, e jogos longos (v60: antes faltavam 9, 11, 13…). */
const MINUTOS = Array.from({ length: 60 }, (_, i) => i + 1).concat([70, 80, 90]);
/* Fim por placar (KAN-175): 0 = sem limite. Vale para gols e para pontos. */
const LIMITES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 21, 25];

/* Sugestão do próximo jogo (KAN-175), a partir dos jogos salvos desta rodada (dominio/fila.ts). */
function sugestao(r: Rodada): Proximo {
  const times = r.times as Time[],
    pos = (m: Partida, l: 'a' | 'b') => timeDoJogo(m, l, times) as number;
  const jogos = (partidasDe(r.id) as Partida[])
    .map(m => ({ a: pos(m, 'a'), b: pos(m, 'b'), ga: m.ga, gb: m.gb }))
    .filter(j => j.a >= 0 && j.b >= 0);
  return proximoJogo(times.length, jogos);
}
/* Quem está esperando, na ordem da fila, fora os dois times em quadra (mesmo que trocados à mão). */
function naEspera(r: Rodada, a: number, b: number): number[] {
  const s = sugestao(r);
  return [s.b, ...s.espera, s.a].filter((t, i, l) => t !== a && t !== b && l.indexOf(t) === i);
}
/* Escalação da partida em andamento (KAN-177): o time do sorteio mais quem entrou, menos quem saiu. */
function escDe(L: { esc?: Record<string, Esc | null> }, t: 'a' | 'b'): Esc {
  return (L.esc && L.esc[t]) || escVazia();
}
function quadra(r: Rodada, t: 'a' | 'b') {
  const L = st().live,
    time = (r.times as Time[])[t === 'a' ? L.a : L.b];
  return emQuadra(time ? time.players : [], escDe(L, t));
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
          {tn(t === 'a' ? L.a : L.b)}
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
        {/* Em duplas não há troca no meio do jogo (KAN-192): sem Escalação. */}
        {sport().pairs ? null : (
          <button class="btn sm" data-a="abrirEscalacao" data-v={t} style="margin:8px auto 4px">
            {tx('partida.escalacao')}
          </button>
        )}
        {(() => {
          const e = escDe(L, t),
            base = new Set(time.players),
            novos = e.entrou.filter(id => !base.has(id) && !e.saiu.includes(id));
          return novos.length || e.saiu.length ? (
            <div class="goals esc-resumo">
              {novos.length ? tx('partida.entraram', { nomes: novos.map(pname).join(', ') }) : ''}
              {novos.length && e.saiu.length ? ' · ' : ''}
              {e.saiu.length ? tx('partida.sairam', { nomes: e.saiu.map(pname).join(', ') }) : ''}
            </div>
          ) : null;
        })()}
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
        {tn(i)}
      </option>
    ));
  return (
    <div class="panel">
      <div class="row">
        <label class="f" style="margin:0;flex:1;min-width:120px">
          <span>{tx(sport().pairs ? 'partida.duplaA' : 'partida.timeA')}</span>
          <select class="sel" data-c="ta">
            {opcoes(L.a, L.b)}
          </select>
        </label>
        <label class="f" style="margin:0;flex:1;min-width:120px">
          <span>{tx(sport().pairs ? 'partida.duplaB' : 'partida.timeB')}</span>
          <select class="sel" data-c="tb">
            {opcoes(L.b, L.a)}
          </select>
        </label>
        <label class="f" style="margin:0;width:124px">
          <span>{tx('partida.minutos')}</span>
          <select class="sel" data-c="dur">
            {(L.dur && !MINUTOS.includes(L.dur / 60) ? [Math.round(L.dur / 60)] : []).concat(MINUTOS).map(m => (
              <option key={m} value={m} selected={m * 60 === L.dur || (m === Math.round(L.dur / 60) && L.dur > 0)}>
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
              <span class="dot" style={{ background: col(times[t].c).c }}></span> {tn(t)}
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
                <span class="dot" style={{ background: col(m.ca).c }}></span> {tnJogo(m, 'a', r.times)}{' '}
                <b>
                  {m.ga} × {m.gb}
                </b>{' '}
                {tnJogo(m, 'b', r.times)} <span class="dot" style={{ background: col(m.cb).c }}></span>{' '}
                <span class="small muted">
                  {autores(m) ? ' — ' + (sport() as { word: string }).word.toLowerCase() + ': ' + autores(m) : ''}
                </span>
              </span>
              <button
                class="btn sm"
                data-a="editarPartida"
                data-v={m.id}
                aria-label={tx('partida.editarRotulo', { n: i + 1 })}
              >
                {tx('partida.editar')}
              </button>
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

/* Artilharia da rodada (KAN-178): para quem lança só o total de gols de cada jogador, sem partida a partida. */
function Artilharia({ r }: { r: Rodada }) {
  const a = artilhariaDe(r.id) as { gols?: Record<string, number> } | null,
    lista = Object.entries((a && a.gols) || {})
      .filter(([, n]) => n > 0)
      .sort((x, y) => y[1] - x[1] || pname(x[0]).localeCompare(pname(y[0])));
  return (
    <div class="panel" id="artPainel">
      <div class="row between">
        <h3 style="margin:0">{tx('partida.artTitulo', { nome: artNome() })}</h3>
        <button class="btn sm" data-a="abrirArtilharia">
          {tx(a ? 'partida.artEditar' : 'partida.artLancar')}
        </button>
      </div>
      <p class="small muted" style="margin:6px 0 0">
        {lista.length ? lista.map(([p, n]) => pname(p) + ' ' + n).join(' · ') : tx('partida.artAjuda')}
      </p>
    </div>
  );
}
let artEdicao: Record<string, number> | null = null;
const artAtual = () => artEdicao;
function LancarArtilharia({ r }: { r: Rodada }) {
  const a = artilhariaDe(r.id) as { gols?: Record<string, number> } | null;
  const [gols, setGols] = useState<Record<string, number>>({ ...((a && a.gols) || {}) });
  artEdicao = gols;
  const ids = [...new Set([...(r.times as Time[]).flatMap(x => x.players), ...Object.keys(gols)])],
    somar = (id: string, d: number) => {
      marcarAlterada(); // KAN-202: tocar fora pergunta antes de descartar
      setGols({ ...gols, [id]: Math.max(0, (gols[id] || 0) + d) });
    },
    temGolEmPartida = (partidasDe(r.id) as Partida[]).some(m => m.ga || m.gb);
  return (
    <>
      <h3>{tx('partida.artTitulo', { nome: artNome() })}</h3>
      <p class="small muted">{tx('partida.artTexto', { ponto: (sport() as { word: string }).word.toLowerCase() })}</p>
      {temGolEmPartida ? (
        <p class="small" style="color:var(--out)">
          {tx('partida.artAviso', { ponto: (sport() as { word: string }).word.toLowerCase() })}
        </p>
      ) : null}
      <ul class="plist" id="artLista">
        {ids.map(id => (
          <li key={id}>
            <span class="pn">{pname(id)}</span>
            <button
              type="button"
              class="btn sm"
              aria-label={tx('partida.artMenos', { nome: pname(id) })}
              onClick={() => somar(id, -1)}
              disabled={!gols[id]}
            >
              −
            </button>
            <b class="art-n" data-p={id} style="min-width:2ch;text-align:center">
              {gols[id] || 0}
            </b>
            <button
              type="button"
              class="btn sm"
              aria-label={tx('partida.artMais', { nome: pname(id) })}
              data-p={id}
              onClick={() => somar(id, 1)}
            >
              +
            </button>
          </li>
        ))}
      </ul>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="salvarArtilharia">
          {tx('partida.artSalvar', { nome: artNome().toLowerCase() })}
        </button>
      </div>
    </>
  );
}
function montarArtilharia() {
  const r = curRodada() as Rodada | null,
    el = document.getElementById('artRaiz');
  if (!r || !r.times || !el) return false;
  render(<LancarArtilharia r={r} />, el);
  return true;
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
      <Artilharia r={r} />
    </div>
  );
}

/* Janela da escalação de um lado (KAN-177): quem está na partida, trocar e puxar de outro time ou da lista de presença. */
function Escalacao({ r, t }: { r: Rodada; t: 'a' | 'b' }) {
  const [, redesenhar] = useState(0);
  const L = st().live,
    times = r.times as Time[],
    idx = t === 'a' ? L.a : L.b,
    time = times[idx],
    e = escDe(L, t),
    q = quadra(r, t),
    outro = quadra(r, t === 'a' ? 'b' : 'a'),
    base = new Set(time.players),
    S = st(),
    presentes = S.presRid === r.id ? (attendance().inn as string[]) : [],
    opc = podemEntrar(
      times.map(x => x.players),
      q.jogaram.concat(outro.jogaram),
      presentes
    );
  const gravar = (nova: Esc) => {
    L.esc = Object.assign({}, L.esc, { [t]: nova });
    redesenhar(n => n + 1);
    changedTela();
  };
  const confirmar = () => {
    const quem = (document.getElementById('escQuem') as HTMLSelectElement).value,
      lugar = (document.getElementById('escLugar') as HTMLSelectElement).value;
    if (quem) gravar(entrar(e, quem, lugar || null));
  };
  const temOpcao = opc.semTime.length || opc.deTimes.some((x, i) => i !== idx && x.length);
  return (
    <>
      <h3>
        <span class="dot" style={{ background: col(time.c).c }}></span> {tx('partida.escalacaoDe', { time: tn(idx) })}
      </h3>
      <p class="small muted">{tx('partida.escalacaoTexto')}</p>
      <ul class="plist" id="escLista">
        {q.jogaram.map(id => {
          const saiu = e.saiu.includes(id),
            veio = !base.has(id);
          return (
            <li key={id}>
              <span class="pn">
                {pname(id)} {veio ? <span class="tag">{tx('partida.entrou')}</span> : null}{' '}
                {saiu ? <span class="tag alt">{tx('partida.saiu')}</span> : null}
              </span>
              {veio || saiu ? (
                <button type="button" class="btn sm ghost" onClick={() => gravar(desfazer(e, id))}>
                  {tx('partida.desfazerEsc')}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {temOpcao ? (
        <div class="panel" style="margin:10px 0 0">
          <label class="f">
            <span>{tx('partida.quemEntra')}</span>
            <select class="sel" id="escQuem">
              {times.map((x, i) =>
                i === idx || !opc.deTimes[i].length ? null : (
                  <optgroup key={i} label={tn(i)}>
                    {opc.deTimes[i].map(id => (
                      <option key={id} value={id}>
                        {pname(id)}
                      </option>
                    ))}
                  </optgroup>
                )
              )}
              {opc.semTime.length ? (
                <optgroup label={tx('partida.semTime')}>
                  {opc.semTime.map(id => (
                    <option key={id} value={id}>
                      {pname(id)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <label class="f">
            <span>{tx('partida.noLugarDe')}</span>
            <select class="sel" id="escLugar">
              <option value="">{tx('partida.soCompletar')}</option>
              {q.atuais.map(id => (
                <option key={id} value={id}>
                  {pname(id)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" class="btn" id="escConfirmar" onClick={confirmar}>
            {tx('partida.confirmarEntrada')}
          </button>
        </div>
      ) : (
        <p class="small muted">{tx('partida.ninguemParaEntrar')}</p>
      )}
      <div class="dlg-f">
        <button class="btn primary" data-a="close">
          {tx('partida.pronto')}
        </button>
      </div>
    </>
  );
}
let changedTela = () => {};
function montarEscalacao(t: 'a' | 'b', redesenharTela: () => void) {
  const r = curRodada() as Rodada | null,
    el = document.getElementById('escRaiz');
  if (!r || !r.times || !el) return false;
  changedTela = redesenharTela;
  render(<Escalacao r={r} t={t} />, el);
  return true;
}

/* Editar partida salva (KAN-176): os gols de cada lado, com o autor; o placar sai dos gols.
   O que está na janela fica em "edicao", que a ação salvarEdicao lê ao gravar. */
let edicao: { mid: string; goals: Gol[] } | null = null;
const edicaoAtual = () => edicao;
function EditarPartida({ m }: { m: Partida }) {
  const [goals, setGoals] = useState<Gol[]>(m.goals.map(g => ({ ...g })));
  edicao = { mid: m.id, goals };
  const SP = sport() as unknown as { score: [string, number][]; og?: boolean },
    mudar = (gs: Gol[]) => {
      marcarAlterada(); // KAN-202
      setGoals(gs);
    };
  const lado = (t: 'a' | 'b') => {
    const meus = (t === 'a' ? m.pa : m.pb) || [],
      deles = (t === 'a' ? m.pb : m.pa) || [],
      cor = t === 'a' ? m.ca : m.cb;
    return (
      <div class="panel" style="margin:0 0 10px">
        <h3 style="margin:0 0 6px">
          <span class="dot" style={{ background: col(cor).c }}></span>{' '}
          {tnJogo(m, t, ((curRodada() as Rodada | null) || { times: [] }).times)} · {sumPts(goals, t)}
        </h3>
        <ul class="plist">
          {goals.map((g, i) =>
            g.t !== t ? null : (
              <li key={i}>
                <select
                  class="sel ed-autor"
                  aria-label={tx('partida.autorDoGol')}
                  value={g.pid ? (g.og ? 'c:' : 'p:') + g.pid : ''}
                  onChange={e => {
                    const v = (e.currentTarget as HTMLSelectElement).value,
                      gs = goals.slice();
                    gs[i] = { ...g, pid: v ? v.slice(2) : null, og: v.startsWith('c:') };
                    mudar(gs);
                  }}
                >
                  <option value="">{tx('partida.semAutor')}</option>
                  {meus.map(id => (
                    <option key={id} value={'p:' + id}>
                      {pname(id)}
                    </option>
                  ))}
                  {SP.og
                    ? deles.map(id => (
                        <option key={'c' + id} value={'c:' + id}>
                          {pname(id) + ' ' + tx('partida.contraMarca')}
                        </option>
                      ))
                    : null}
                </select>
                {(g.pts || 1) > 1 ? <span class="tag">+{g.pts}</span> : null}
                <button
                  type="button"
                  class="btn sm ghost danger"
                  aria-label={tx('partida.tirarGol')}
                  onClick={() => mudar(goals.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </li>
            )
          )}
        </ul>
        <div class="row" style="margin-top:6px">
          {SP.score.map(([rotulo, pts], k) => (
            <button
              key={k}
              type="button"
              class="btn sm ed-mais"
              data-lado={t}
              onClick={() => mudar(goals.concat({ t, pid: null, og: false, pts }))}
            >
              {SP.score.length === 1 ? '+ ' + rotulo : rotulo}
            </button>
          ))}
        </div>
      </div>
    );
  };
  return (
    <>
      <h3>{tx('partida.editarTitulo')}</h3>
      <p class="small muted">{tx('partida.editarTexto')}</p>
      {lado('a')}
      {lado('b')}
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="salvarEdicao" data-v={m.id}>
          {tx('partida.salvarEdicao', { a: sumPts(goals, 'a'), b: sumPts(goals, 'b') })}
        </button>
      </div>
    </>
  );
}
function montarEdicao(mid: string) {
  const r = curRodada() as Rodada | null,
    m = r && (partidasDe(r.id) as Partida[]).find(x => x.id === mid),
    el = document.getElementById('edRaiz');
  if (!m || !el) return false;
  render(<EditarPartida m={m} />, el);
  return true;
}

/* A gestão desenha as abas com texto; a Partida entra num lugar reservado (#partidaRaiz), como Rodada e Caixa. */
const vPartida = () => 'partidaRaiz';
function montarPartida() {
  const el = document.getElementById('partidaRaiz');
  if (el) render(<PartidaTela />, el);
}

export {
  artAtual,
  edicaoAtual,
  limiteAtingido,
  montarArtilharia,
  montarEdicao,
  montarEscalacao,
  montarPartida,
  novaPartida,
  quadra,
  vPartida,
};
