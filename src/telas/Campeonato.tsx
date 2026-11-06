/* Campeonato da rodada na aba Partida (KAN-233, pelada-v96): escolher o formato (Livre ou Campeonato), montar o
   campeonato com os critérios de desempate, a classificação e os jogos na ordem. Regras em dominio/campeonato.ts.
   Fica gravado na ficha da rodada (campo camp); as partidas são as de sempre, salvas pelo placar.
   Plano A (decisão do Kleber de 05/11): no Grátis, o botão aparece com o cadeado. O mata-mata entra na pelada-v97. */
import { useState } from 'preact/hooks';
import {
  CRITERIOS,
  MAX_TIMES,
  MIN_TIMES,
  classificacao,
  faltam,
  lerCamp,
  lerPar,
  proximo,
  resultados,
  type Camp,
  type Criterio,
  type Jogo,
} from '../dominio/campeonato';
import { col, sport, timeDoJogo, tn } from '../dominio/esportes.js';
import { recurso } from '../dominio/grupo.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-campeonato';
import { S as estado } from '../nucleo/estado.js';
import { partidasDe } from '../nucleo/partidas-lista.js';
import { marcarAlterada } from '../ui/dialogos.js';
import { Trava } from '../ui/Plano';

juntarTextos(textos);

type Time = { c: number | string; players: string[] };
type Rodada = { id: string; times?: Time[] | null; camp?: unknown };
type Salva = {
  ta?: number;
  tb?: number;
  ca: number | string;
  cb: number | string;
  ga: number;
  gb: number;
  at?: number;
};

export const PADRAO: Criterio[] = ['saldo', 'gp', 'cd', 'sorteio'];

/* Campeonato da rodada, se houver e valer para estes times. */
export const campDe = (r: Rodada): Camp | null => (r.times ? lerCamp(r.camp, r.times.length) : null);
/* Partidas salvas da rodada como jogos entre posições de times. */
export function jogosDe(r: Rodada): Jogo[] {
  const times = r.times || [];
  return (partidasDe(r.id) as unknown as Salva[])
    .map(m => ({
      a: timeDoJogo(m, 'a', times) as number,
      b: timeDoJogo(m, 'b', times) as number,
      ga: m.ga,
      gb: m.gb,
      at: m.at,
    }))
    .filter(j => j.a >= 0 && j.b >= 0);
}
/* Próximo jogo pela ordem do campeonato (null: sem campeonato ou todos jogados). */
export function proximoDoCamp(r: Rodada) {
  const c = campDe(r);
  return c ? proximo(c, jogosDe(r)) : null;
}

const pontos = () => (sport() as { word: string }).word.toLowerCase();
const nomeCrit = (k: Criterio) => tx('camp.crit.' + k, { pontos: pontos() });
const listaCrit = (c: Criterio[]) => [tx('camp.crit.pts')].concat(c.map(nomeCrit)).join(', ');
const Dot = ({ c }: { c: number | string }) => <span class="dot" style={{ background: col(c).c }}></span>;

/* Escolha do formato, logo abaixo do seletor de rodada. */
export function Formato({ r }: { r: Rodada }) {
  const n = (r.times || []).length,
    c = campDe(r),
    tem = recurso('campeonato'),
    cabe = n >= MIN_TIMES && n <= MAX_TIMES,
    /* Campeonato montado para outro número de times (o sorteio mudou depois). */
    velho = !c && !!r.camp;
  return (
    <div class="panel formato" id="formatoPainel">
      <div class="row between">
        <span class="formato-rotulo">{tx('camp.formato')}</span>
        <div class="seg" role="group" aria-label={tx('camp.formato')}>
          <button data-a="formatoLivre" aria-pressed={!c} id="fmtLivre">
            {tx('camp.livre')}
          </button>
          <button data-a="abrirCampeonato" aria-pressed={!!c} id="fmtCamp" disabled={!c && (!tem || !cabe)}>
            {!c && !tem ? <span aria-hidden="true">🔒 </span> : null}
            {tx('camp.campeonato')}
          </button>
        </div>
      </div>
      {!c && !tem ? <Trava r="campeonato" /> : null}
      {!c && tem && !cabe ? (
        <p class="small muted" style="margin:8px 0 0" id="campMinimo">
          {tx(n < MIN_TIMES ? 'camp.minimo' : 'camp.maximo', { n: n < MIN_TIMES ? MIN_TIMES : MAX_TIMES })}
        </p>
      ) : null}
      {velho ? (
        <p class="small" style="margin:8px 0 0;color:var(--out)" id="campVelho">
          {tx('camp.timesMudaram')}
        </p>
      ) : null}
    </div>
  );
}

/* Classificação e jogos, quando o campeonato está montado. */
export function PainelCampeonato({ r }: { r: Rodada }) {
  const c = campDe(r);
  if (!c) return null;
  const times = r.times as Time[],
    ms = jogosDe(r),
    res = resultados(c, ms),
    tab = classificacao(c, ms),
    falta = faltam(c, ms),
    prox = proximo(c, ms),
    L = (estado as { live?: { a: number; b: number } }).live;
  return (
    <div class="panel camp" id="campPainel">
      <div class="row between">
        <h3 style="margin:0">{tx('camp.titulo')}</h3>
        <button class="btn sm" data-a="abrirCampeonato" aria-label={tx('camp.desempateRotulo')}>
          {tx('camp.desempate')}
        </button>
      </div>
      <p class="small muted" style="margin:4px 0 8px">
        {falta ? tx('camp.faltam', { n: falta, total: c.jogos.length }) : tx('camp.encerrada')}
      </p>
      {!falta ? (
        <p class="camp-lider" id="campLider">
          <span aria-hidden="true">🏆 </span>
          {tx('camp.lider', { time: tn(tab[0].t) })}
        </p>
      ) : null}
      <div class="tbl">
        <table id="campTabela">
          <thead>
            <tr>
              <th>#</th>
              <th>{tx(sport().pairs ? 'camp.dupla' : 'camp.time')}</th>
              <th>{tx('camp.col.pts')}</th>
              <th>{tx('camp.col.j')}</th>
              <th>{tx('camp.col.v')}</th>
              <th>{tx('camp.col.e')}</th>
              <th>{tx('camp.col.d')}</th>
              <th>{tx('camp.col.pro')}</th>
              <th>{tx('camp.col.contra')}</th>
              <th>{tx('camp.col.saldo')}</th>
            </tr>
          </thead>
          <tbody>
            {tab.map(x => (
              <tr key={x.t} data-t={x.t}>
                <td>{x.pos}</td>
                <td>
                  <Dot c={times[x.t].c} /> {tn(x.t)}
                </td>
                <td class="pts">{x.pts}</td>
                <td>{x.j}</td>
                <td>{x.v}</td>
                <td>{x.e}</td>
                <td>{x.d}</td>
                <td>{x.gp}</td>
                <td>{x.gc}</td>
                <td>{x.sg > 0 ? '+' + x.sg : x.sg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="small muted" style="margin:8px 0 0" id="campCriterios">
        {tx('camp.criterios', { lista: listaCrit(c.crit) })}
      </p>
      <h4 style="margin:14px 0 6px">{tx('camp.jogos')}</h4>
      <ol class="plist camp-jogos" id="campJogos">
        {c.jogos.map((j, i) => {
          const [a, b] = lerPar(j),
            feito = res[i],
            agora = !feito && prox && prox.i === i,
            emQuadra = !feito && L && ((L.a === a && L.b === b) || (L.a === b && L.b === a));
          return (
            <li key={j} class={feito ? 'feito' : agora ? 'agora' : ''} data-j={j}>
              <span class="num">{i + 1}</span>
              <span class="pn">
                <Dot c={times[a].c} /> {tn(a)} <b>{feito ? feito.ga + ' × ' + feito.gb : '×'}</b> {tn(b)}{' '}
                <Dot c={times[b].c} />
              </span>
              {emQuadra ? (
                <span class="tag">{tx('camp.emQuadra')}</span>
              ) : agora ? (
                <span class="tag alt">{tx('camp.proximo')}</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* Janela para montar o campeonato ou mudar o desempate: critérios depois dos pontos, na ordem, cada um ligado ou não. */
let escolha: Criterio[] = PADRAO;
export const desempateEscolhido = () => escolha;
function MontarCampeonato({ r }: { r: Rodada }) {
  const c = campDe(r),
    inicial = c ? c.crit : PADRAO,
    [ordem, setOrdem] = useState<Criterio[]>(() => inicial.concat(CRITERIOS.filter(k => !inicial.includes(k)))),
    [ligados, setLigados] = useState<Criterio[]>(inicial);
  escolha = ordem.filter(k => ligados.includes(k));
  const n = (r.times || []).length,
    subir = (i: number) => {
      marcarAlterada();
      const o = ordem.slice();
      [o[i - 1], o[i]] = [o[i], o[i - 1]];
      setOrdem(o);
    },
    marcar = (k: Criterio, sim: boolean) => {
      marcarAlterada();
      setLigados(sim ? ligados.concat(k) : ligados.filter(x => x !== k));
    };
  return (
    <>
      <h3 id="campDlgTitulo">{tx(c ? 'camp.desempateTitulo' : 'camp.montarTitulo')}</h3>
      {c ? null : <p class="small muted">{tx('camp.montarTexto', { n, jogos: (n * (n - 1)) / 2 })}</p>}
      <fieldset class="f chk-lista camp-crit" id="campCrit">
        <legend class="lbl">{tx('camp.desempateLegenda')}</legend>
        <p class="small muted" style="margin:0 0 6px">
          {tx('camp.desempateAjuda')}
        </p>
        <ol>
          {ordem.map((k, i) => (
            <li key={k} data-k={k}>
              <label class="chk-linha">
                <input
                  type="checkbox"
                  value={k}
                  checked={ligados.includes(k)}
                  onChange={e => marcar(k, (e.currentTarget as HTMLInputElement).checked)}
                />
                <span>{nomeCrit(k)}</span>
              </label>
              {i ? (
                <button
                  type="button"
                  class="btn sm ghost camp-subir"
                  aria-label={tx('camp.subir', { crit: nomeCrit(k) })}
                  onClick={() => subir(i)}
                >
                  ↑
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        <p class="small muted" style="margin:6px 0 0">
          {tx('camp.empateFinal')}
        </p>
      </fieldset>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a={c ? 'salvarDesempate' : 'comecarCampeonato'} id="campOk">
          {tx(c ? 'camp.salvarDesempate' : 'camp.comecar')}
        </button>
      </div>
    </>
  );
}
export const janelaCampeonato = (r: Rodada) => <MontarCampeonato r={r} />;
