/* Aba Ranking como componente em TypeScript + Preact (KAN-203; antes, telas/ranking.js). Por fora, a mesma tela:
   os mesmos data-c (rank, rankAno, rankMes) e data-a (recalc), que eventos.js e as ações já conhecem.
   Soma as fichas de resumo do período (D11, KAN-87): o ano lê até 12 fichas, o mês lê 1; nunca todas as partidas.
   KAN-119: sem o ranking do ano (Plano A), só os meses do ano atual, um de cada vez, com a Trava do plano. */
import { render } from 'preact';
import { col, sport, tnJogo } from '../dominio/esportes.js';
import { pname, recurso, rodById } from '../dominio/grupo.js';
import { placares, ranking } from '../dominio/resumos';
import { tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { fdate, fmonth, today } from '../nucleo/util.js';
import { Trava } from '../ui/Plano';

const st = (): any => estado;
type Linha = ReturnType<typeof ranking>[number];
type Coluna = keyof Linha;

const anual = () => recurso('rankingAnual');
export function anoRank(): string {
  return (anual() && st().rankAno) || today().slice(0, 4);
}
const mesRank = (): string => st().rankMes || (anual() ? '' : today().slice(5, 7));
function docsDoPeriodo() {
  const m = mesRank();
  return (Object.values(st().res || {}) as { mes?: string }[]).filter(
    d => d && d.mes && (!m || d.mes.slice(5, 7) === m)
  );
}
function periodoRecalc() {
  const a = anoRank(),
    m = mesRank();
  return a === 'todos' ? 'todos' : m ? a + '-' + m : a;
}
const MESES = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const nomeMes = (a: string, m: string) => fmonth(a + '-' + m).replace(/\s*(de\s*)?\d{4}$/, '');

function Filtros() {
  const a = anoRank(),
    anoAtual = +today().slice(0, 4),
    anos = [anoAtual, anoAtual - 1, anoAtual - 2].map(String),
    m = mesRank();
  return (
    <>
      <div class="row">
        {anual() ? (
          <select class="sel" style="width:auto" data-c="rankAno" aria-label={tx('rank.ano')}>
            {anos.map(x => (
              <option key={x} value={x} selected={x === a}>
                {x}
              </option>
            ))}
            <option value="todos" selected={a === 'todos'}>
              {tx('rank.todosAnos')}
            </option>
          </select>
        ) : null}
        {a === 'todos' ? null : (
          <select class="sel" style="width:auto" data-c="rankMes" aria-label={tx('rank.mes')}>
            {anual() ? (
              <option value="" selected={m === ''}>
                {tx('rank.anoInteiro')}
              </option>
            ) : null}
            {MESES.map(x => (
              <option key={x} value={x} selected={x === m}>
                {nomeMes(a, x)}
              </option>
            ))}
          </select>
        )}
      </div>
      {anual() ? null : <Trava r="rankingAnual" />}
    </>
  );
}

function colunas(): [Coluna, string][] {
  return [
    ['pts', tx('rank.col.pts')],
    ['j', tx('rank.col.j')],
    ['v', tx('rank.col.v')],
    ['e', tx('rank.col.e')],
    ['d', tx('rank.col.d')],
    ['ap', tx('rank.col.ap')],
    ['gols', (sport() as { word: string }).word],
    ['mvp', tx('rank.col.mvp')],
    ['bagre', tx('rank.col.bagre')],
  ];
}

function Topo() {
  const cols = colunas(),
    k = st().rankSort;
  return (
    <>
      <div class="row between">
        <h2>{tx('rank.titulo')}</h2>
        <label class="row small muted">
          {tx('rank.ordenar')}{' '}
          <select class="sel" style="width:auto" data-c="rank">
            {cols.map(([c, l]) => (
              <option key={c} value={c} selected={c === k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Filtros />
    </>
  );
}

function Tabela({ linhas }: { linhas: Linha[] }) {
  const cols = colunas();
  return (
    <div class="panel tbl">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>{tx('rank.jogador')}</th>
            {cols.map(([c, l]) => (
              <th key={c}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((x, i) => (
            <tr key={x.id} class={i === 0 ? 'lead' : ''}>
              <td>{i + 1}</td>
              <td>{pname(x.id)}</td>
              <td class="pts">{x.pts}</td>
              <td>{x.j}</td>
              <td>{x.v}</td>
              <td>{x.e}</td>
              <td>{x.d}</td>
              <td>{x.ap}%</td>
              <td>{x.gols}</td>
              <td>{x.mvp}</td>
              <td>{x.bagre}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="small muted" style="margin-top:8px">
        {tx('rank.pontos')}
      </p>
    </div>
  );
}

type Jogo = Parameters<typeof tnJogo>[0] & { ca: number; ga: number; gb: number };
function Placares({ rs }: { rs: { rid: string; date: string; jogos: Jogo[] }[] }) {
  return (
    <div class="panel">
      <h3>{tx('rank.historico')}</h3>
      <ul class="plist wrap">
        {rs.map(r => {
          const times = ((rodById(r.rid) || {}) as { times?: unknown }).times;
          return (
            <li key={r.rid + r.date}>
              <b style="min-width:110px">{fdate(r.date)}</b>
              <span class="small muted pn">
                {r.jogos.map((m, i) => (
                  <span key={i}>
                    {i ? ' · ' : ''}
                    <span class="dot" style={{ background: col(m.ca).c }}></span> {tnJogo(m, 'a', times)} {m.ga}×{m.gb}{' '}
                    {tnJogo(m, 'b', times)}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RankingTela() {
  const S = st();
  if (((S.migr || {}).v || 0) < 18)
    return (
      <div class="stack">
        <Topo />
        <div class="panel empty">
          <p class="muted">{tx('resumo.preparando')}</p>
        </div>
      </div>
    );
  if (!S.loaded.res)
    return (
      <div class="stack">
        <Topo />
        <div class="empty muted">{tx('comum.carregando')}</div>
      </div>
    );
  const docs = docsDoPeriodo() as Parameters<typeof ranking>[0],
    linhas = ranking(docs),
    k = (S.rankSort || 'pts') as Coluna;
  linhas.sort((x, y) => (y[k] as number) - (x[k] as number) || y.pts - x.pts || y.gols - x.gols);
  const rs = placares(docs) as unknown as { rid: string; date: string; jogos: Jogo[] }[];
  return (
    <div class="stack">
      <Topo />
      {linhas.length ? (
        <Tabela linhas={linhas} />
      ) : (
        <div class="panel empty">
          <h2>{tx('rank.semPartidas')}</h2>
          <p class="muted">{tx('rank.semPartidasTexto')}</p>
        </div>
      )}
      {rs.length ? <Placares rs={rs} /> : null}
      <div class="row small muted" style="justify-content:space-between">
        <span>{tx('resumo.ajuda')}</span>
        <button class="btn sm" data-a="recalc" data-v={periodoRecalc()}>
          {tx('resumo.recalcular')}
        </button>
      </div>
    </div>
  );
}

/* A gestão desenha as abas com texto; o Ranking entra num lugar reservado (#rankRaiz). */
export const vRanking = () => 'rankRaiz';
export function montarRanking() {
  const el = document.getElementById('rankRaiz');
  if (el) render(<RankingTela />, el);
}
