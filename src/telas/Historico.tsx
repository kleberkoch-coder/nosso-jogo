/* ---------- Histórico (D10, KAN-85; KAN-218: virou componente) ----------
   Busca rodadas antigas por mês ou por período, 20 de cada vez, sem ficar ouvindo o banco.
   Ao abrir uma rodada: presença, times, partidas e votação daquela rodada. Só leitura.
   Baixa com a aba (abas/historico.ts); os botões usam data-a (histModo, histBuscar, histMais, histAbrir, histVoltar). */
import { render } from 'preact';
import { col, colete, posIdx, sport, tn, tnJogo } from '../dominio/esportes.js';
import { comCores, pname, ppos } from '../dominio/grupo.js';
import { hora } from '../dominio/rodadas.js';
import { tp, tx } from '../i18n/index.js';
import * as banco from '../nucleo/backend.js';
import { S as estado, gp } from '../nucleo/estado.js';
import { $, fdate, fmonth, toast, today } from '../nucleo/util.js';
import { changed } from '../ui/render.js';
import { Pos } from '../ui/componentes';

const st = (): any => estado;
const bk = (): any => (banco as any).B;
const POR_PAGINA = 20;
type Rod = {
  date: string;
  time?: string;
  place?: string;
  cancelada?: boolean;
  np?: number;
  matches?: Partida[];
  times?: Time[];
};
type Time = { c: number; players: string[]; res?: string[] };
type Partida = {
  id?: string;
  at?: number;
  tipo?: string;
  ga: number;
  gb: number;
  goals?: { pid?: string; og?: boolean; pts?: number }[];
};
type Hist = {
  modo: 'mes' | 'periodo';
  mes: string;
  de: string;
  ate: string;
  itens: string[];
  docs: Record<string, Rod>;
  cursor: unknown;
  fim: boolean;
  buscou: boolean;
  carregando: boolean;
  sel: string | null;
  pres: Record<string, { s?: string; t?: number; nome?: string }> | null;
  parts?: Partida[] | null;
};

function estadoHist(): Hist {
  const S = st();
  if (!S.hist)
    S.hist = {
      modo: 'mes',
      mes: today().slice(0, 7),
      de: '',
      ate: '',
      itens: [],
      docs: {},
      cursor: null,
      fim: true,
      buscou: false,
      carregando: false,
      sel: null,
      pres: null,
    };
  return S.hist;
}

function filtro(h: Hist) {
  if (h.modo === 'mes') return { de: h.mes + '-01', ate: h.mes + '-31' };
  return { de: h.de || '0000-01-01', ate: h.ate || '9999-12-31' };
}
const valor = (sel: string) => (($(sel) as HTMLInputElement | null) || { value: '' }).value;

async function buscarHist(mais: boolean) {
  const h = estadoHist();
  if (!mais) {
    if (h.modo === 'mes') h.mes = valor('#hmes') || h.mes;
    else {
      h.de = valor('#hde');
      h.ate = valor('#hate');
    }
    if (h.modo === 'periodo' && h.de && h.ate && h.de > h.ate) return toast(tx('hist.periodoInvalido'));
    h.itens = [];
    h.docs = {};
    h.cursor = null;
    h.sel = null;
  }
  h.carregando = true;
  changed();
  try {
    const f = filtro(h),
      pg = await bk().pagina(
        gp('rodadas'),
        { campo: 'date', de: f.de, ate: f.ate, ordem: 'desc', limite: POR_PAGINA },
        h.cursor
      );
    pg.itens.forEach(([id, d]: [string, Rod]) => {
      h.docs[id] = d;
      h.itens.push(id);
    });
    h.cursor = pg.cursor;
    h.fim = pg.fim;
    h.buscou = true;
  } catch (e) {
    console.warn('histórico', e);
    toast(tx('hist.erro'));
  } finally {
    h.carregando = false;
    changed();
  }
}

async function abrirHist(id: string) {
  const h = estadoHist();
  h.sel = id;
  h.pres = null;
  h.parts = null;
  changed();
  window.scrollTo(0, 0);
  const r = h.docs[id] || ({} as Rod);
  const [pres, parts] = await Promise.all([
    bk()
      .get(gp('rodadas/' + id + '/presencas'))
      .catch((e: unknown) => {
        console.warn('presença do histórico', e);
        return {};
      }),
    (r.np && r.np > 0 ? bk().get(gp('rodadas/' + id + '/partidas')) : Promise.resolve({})).catch((e: unknown) => {
      console.warn('partidas do histórico', e);
      return {};
    }),
  ]);
  h.pres = pres || {};
  h.parts = Object.entries((parts || {}) as Record<string, Partida>)
    .map(([pid, m]): Partida => Object.assign({ id: pid }, m))
    .filter(m => m.tipo !== 'art')
    .concat(r.matches || [])
    .sort((a, b) => (a.at || 0) - (b.at || 0));
  changed();
}

/* Local numa linha só, com "…", e o que vem depois (cancelada, times, partidas) ao lado (KAN-146). */
function Local({ r, extra, classe }: { r: Rod; extra: string; classe: string }) {
  return (
    <span class={classe + ' linha-local'}>
      <span class="corta" data-corta>
        {r.place || tx('publico.localADefinir')}
      </span>
      <span class="extra">{extra}</span>
    </span>
  );
}

/* Cartão de time só para ver (era teamCard em texto, telas/rodada-partes.js). */
function CartaoTime({ t, i }: { t: Time; i: number }) {
  const c = col(t.c) as { c: string; n: string },
    pares = !!sport().pairs,
    rs = (id: string) => ((t.res || []).includes(id) ? 1 : 0),
    ps = t.players.slice().sort((a, b) => rs(a) - rs(b) || posIdx(ppos(a)) - posIdx(ppos(b)));
  return (
    <div class="team">
      <div class={'band' + (c.n === 'Branco' && !pares ? ' branco' : '')} style={{ background: c.c }}></div>
      <div class="th">
        <b>{tn(i)}</b>
        <span class="tag">
          {pares ? '' : colete(t.c) + ' · '}
          {t.players.length}
        </span>
      </div>
      <ul>
        {ps.map(id => (
          <li key={id} class={rs(id) ? 'reserva' : ''}>
            <Pos id={id} />
            <span class="pn">
              {pname(id)}
              {rs(id) ? (
                <>
                  {' '}
                  <span class="tag">{'· ' + tx('times.reserva')}</span>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Busca({ h }: { h: Hist }) {
  return (
    <div class="panel">
      <h2>{tx('hist.titulo')}</h2>
      <p class="small muted" style={{ marginTop: '2px' }}>
        {tx('hist.ajuda')}
      </p>
      <div class="seg" style={{ display: 'flex', margin: '10px 0 12px' }}>
        <button style={{ flex: 1 }} data-a="histModo" data-v="mes" aria-pressed={h.modo === 'mes' ? 'true' : 'false'}>
          {tx('hist.porMes')}
        </button>
        <button
          style={{ flex: 1 }}
          data-a="histModo"
          data-v="periodo"
          aria-pressed={h.modo === 'periodo' ? 'true' : 'false'}
        >
          {tx('hist.porPeriodo')}
        </button>
      </div>
      {h.modo === 'mes' ? (
        <label class="f">
          <span>{tx('hist.mes')}</span>
          <input class="inp" type="month" id="hmes" defaultValue={h.mes} />
        </label>
      ) : (
        <div class="row">
          <label class="f" style={{ flex: 1, minWidth: '140px' }}>
            <span>{tx('hist.de')}</span>
            <input class="inp" type="date" id="hde" defaultValue={h.de} />
          </label>
          <label class="f" style={{ flex: 1, minWidth: '140px' }}>
            <span>{tx('hist.ate')}</span>
            <input class="inp" type="date" id="hate" defaultValue={h.ate} />
          </label>
        </div>
      )}
      <button class="btn primary" data-a="histBuscar">
        {tx('hist.buscar')}
      </button>
    </div>
  );
}

function Lista({ h }: { h: Hist }) {
  if (!h.buscou) return h.carregando ? <div class="empty muted">{tx('comum.carregando')}</div> : null;
  if (!h.itens.length)
    return (
      <div class="panel empty">
        <p class="muted">{h.modo === 'mes' ? tx('hist.vazioMes', { mes: fmonth(h.mes) }) : tx('hist.vazioPeriodo')}</p>
      </div>
    );
  return (
    <div class="panel">
      <ul class="plist">
        {h.itens.map(id => {
          const r = h.docs[id]!,
            np = r.np != null ? r.np : (r.matches || []).length;
          return (
            <li key={id}>
              <span class="pn">
                <b>{fdate(r.date)}</b>
                {r.time ? ' · ' + hora(r) : ''}
                <br />
                <Local
                  r={r}
                  classe="tag"
                  extra={
                    (r.cancelada ? ' · ' + tx('hist.cancelada') : '') +
                    (r.times ? ' · ' + tp('hist.times', r.times.length) : '') +
                    (np ? ' · ' + tp('hist.partidas', np) : '')
                  }
                />
              </span>
              <button class="btn sm" data-a="histAbrir" data-v={id}>
                {tx('hist.abrir')}
              </button>
            </li>
          );
        })}
      </ul>
      {h.fim ? null : (
        <div class="row" style={{ justifyContent: 'center', marginTop: '12px' }}>
          <button class="btn" data-a="histMais">
            {tx('hist.verMais')}
          </button>
        </div>
      )}
    </div>
  );
}

function Detalhe({ h }: { h: Hist }) {
  const S = st(),
    id = h.sel as string,
    r = comCores(h.docs[id]) as Rod | null;
  if (!r) return null;
  const pres = h.pres,
    inn = pres
      ? Object.entries(pres)
          .filter(([, p]) => p.s === 'in')
          .sort((a, b) => (a[1].t || 0) - (b[1].t || 0))
          .map(([pid]) => pid)
      : [];
  const ms = h.parts || [],
    vs = Object.entries(
      (S.vot || {}) as Record<
        string,
        { rid: string; title: string; open?: boolean; cats: { id: string; name: string }[]; resultado?: any }
      >
    ).filter(([, v]) => v.rid === id);
  const nomeP = (pid: string) => (pres && pres[pid] && pres[pid].nome) || pname(pid);
  return (
    <div class="stack">
      <div class="row">
        <button class="btn sm" data-a="histVoltar">
          ← {tx('hist.voltar')}
        </button>
      </div>
      <div class="panel">
        <h2>
          {fdate(r.date)}
          {r.time ? ' · ' + hora(r) : ''}
        </h2>
        <div class="muted linha-local">
          <span class="corta" data-corta>
            {r.place || tx('publico.localADefinir')}
          </span>
          <span class="extra">{r.cancelada ? ' · ' + tx('hist.cancelada') : ''}</span>
        </div>
      </div>
      <div class="panel">
        <h3>
          {tx('hist.confirmados')} {pres ? '(' + inn.length + ')' : ''}
        </h3>
        {!pres ? (
          <p class="muted small">{tx('comum.carregando')}</p>
        ) : inn.length ? (
          <ol class="plist">
            {inn.map((pid, i) => (
              <li key={pid}>
                <span class="num">{i + 1}</span>
                <span class="pn">{nomeP(pid)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p class="muted small">{tx('hist.semConfirmados')}</p>
        )}
      </div>
      <div class="panel">
        <h3>{tx('hist.timesTitulo')}</h3>
        {r.times ? (
          <div class="teams">
            {r.times.map((t, i) => (
              <CartaoTime key={i} t={t} i={i} />
            ))}
          </div>
        ) : (
          <p class="muted small">{tx('hist.semSorteio')}</p>
        )}
      </div>
      <div class="panel">
        <h3>{tx('hist.partidasTitulo')}</h3>
        {!h.parts ? (
          <p class="muted small">{tx('comum.carregando')}</p>
        ) : ms.length ? (
          <ul class="plist wrap">
            {ms.map((m, i) => {
              const gs = (m.goals || []).filter(g => g.pid && !g.og);
              return (
                <li key={m.id || i}>
                  <span class="num">{i + 1}</span>
                  <span class="pn">
                    {tnJogo(m, 'a', r.times)} <b>{m.ga + ' × ' + m.gb}</b> {tnJogo(m, 'b', r.times)}
                    {gs.length ? (
                      <>
                        {' '}
                        <span class="small muted">
                          — {String(sport().word).toLowerCase()}:{' '}
                          {gs.map(g => pname(g.pid) + ((g.pts || 1) > 1 ? ' (' + g.pts + ')' : '')).join(', ')}
                        </span>
                      </>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p class="muted small">{tx('hist.semPartidas')}</p>
        )}
      </div>
      <div class="panel">
        <h3>{tx('hist.votacaoTitulo')}</h3>
        {vs.length ? (
          vs.map(([vid, v]) => (
            <div key={vid}>
              <p style={{ margin: '0 0 8px' }}>
                <b>{v.title}</b>{' '}
                <span class="tag">{'· ' + tx(v.open ? 'hist.votacaoAberta' : 'hist.votacaoEncerrada')}</span>
              </p>
              {!v.open && v.resultado ? (
                <ul class="plist">
                  {v.cats.map(c => (
                    <li key={c.id}>
                      <span class="pn">{c.name}</span>
                      <b>
                        {((v.resultado[c.id] || {}).winners || []).map((x: string) => pname(x)).join(tx('voto.e')) ||
                          tx('voto.semVotos')}
                      </b>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))
        ) : (
          <p class="muted small">{tx('hist.semVotacao')}</p>
        )}
      </div>
    </div>
  );
}

function Historico() {
  const h = estadoHist();
  if (h.sel) return <Detalhe h={h} />;
  return (
    <div class="stack">
      <Busca key={h.modo} h={h} />
      <Lista h={h} />
    </div>
  );
}

/* A gestão desenha as abas com texto; o Histórico entra num lugar reservado (#histRaiz) logo depois. */
const vHistorico = () => 'histRaiz';
function montarHistorico() {
  const el = document.getElementById('histRaiz');
  if (el) render(<Historico />, el);
}

export { abrirHist, buscarHist, estadoHist, montarHistorico, vHistorico };
