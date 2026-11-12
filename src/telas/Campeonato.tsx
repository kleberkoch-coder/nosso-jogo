/* Campeonato da rodada na aba Partida (KAN-233, pelada-v96): escolher o formato (Livre ou Campeonato), montar o
   campeonato com os critérios de desempate, a classificação e os jogos na ordem. Regras em dominio/campeonato.ts.
   Fica gravado na ficha da rodada (campo camp); as partidas são as de sempre, salvas pelo placar.
   Plano A (decisão do Kleber de 05/11): no Grátis, o botão aparece com o cadeado. Mata-mata (pelada-v97): a chave
   sai da tabela (dominio/mata-mata.ts); as janelas de montar e de "Quem passou?" baixam só quando abertas
   (telas/CampeonatoJanelas.tsx). */
import {
  MAX_TIMES,
  MIN_TIMES,
  classificacao,
  faltam,
  lerCamp,
  lerPar,
  proximo,
  resultados,
  type Camp,
  type Jogo,
} from '../dominio/campeonato';
import { chave, type Origem, type Slot } from '../dominio/mata-mata';
import { col, sport, tn } from '../dominio/esportes.js';
import { comoJogos, nomeFase } from '../ui/zap-partidas';
import { recurso } from '../dominio/grupo.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-campeonato';
import { S as estado } from '../nucleo/estado.js';
import { partidasDe } from '../nucleo/partidas-lista.js';
import { Trava } from '../ui/Plano';
import { Confronto } from '../ui/LinhaPartida';

juntarTextos(textos);

type Time = { c: number | string; players: string[] };
export type Rodada = { id: string; times?: Time[] | null; camp?: unknown };

/* Campeonato da rodada, se houver e valer para estes times. */
export const campDe = (r: Rodada): Camp | null => (r.times ? lerCamp(r.camp, r.times.length) : null);
/* Partidas salvas da rodada como jogos entre posições de times, na ordem da lista (KAN-238: a posição diz a fase). */
export const jogosDe = (r: Rodada): Jogo[] => comoJogos(partidasDe(r.id) as never, r.times);
/* Próximo jogo pela ordem do campeonato: os de todos contra todos e, depois, os do mata-mata com os dois times já
   definidos (null: sem campeonato, acabou, ou esperando dizer quem passou). */
export function proximoDoCamp(r: Rodada): { a: number; b: number } | null {
  const c = campDe(r);
  if (!c) return null;
  const ms = jogosDe(r);
  const g = proximo(c, ms);
  if (g) return g;
  const k = chave(c, ms).proximo;
  return k ? { a: k.a as number, b: k.b as number } : null;
}
export const chaveDe = (r: Rodada) => {
  const c = campDe(r);
  return c ? chave(c, jogosDe(r)) : null;
};

const pontos = () => (sport() as { word: string }).word.toLowerCase();
export const nomeCrit = (k: string) => tx('camp.crit.' + k, { pontos: pontos() });
const listaCrit = (c: string[]) => [tx('camp.crit.pts')].concat(c.map(nomeCrit)).join(', ');
/* Nome da fase e de onde vem cada time ("1º colocado", "Vencedor da semifinal 1"). */
export { nomeFase };
const origem = (o: Origem, slots: Slot[]) => {
  if ('col' in o) return tx('mata.colocado', { n: o.col });
  const s = slots.find(x => x.id === ('venc' in o ? o.venc : o.perd));
  return tx('venc' in o ? 'mata.vencedor' : 'mata.perdedor', { jogo: s ? nomeFase(s) : '' });
};
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
    k = chave(c, ms),
    L = (estado as { live?: { a: number; b: number } }).live,
    emQuadra = (a: number | null, b: number | null) =>
      !!L && a != null && b != null && ((L.a === a && L.b === b) || (L.a === b && L.b === a));
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
      {k.campeao != null ? (
        <p class="camp-lider" id="campLider">
          <span aria-hidden="true">🏆 </span>
          {tx('mata.campeao', { time: tn(k.campeao) })}
          {k.vice != null ? <span class="small muted">{' · ' + tx('mata.vice', { time: tn(k.vice) })}</span> : null}
          {k.terceiro != null && c.mm.t3 ? (
            <span class="small muted">{' · ' + tx('mata.terceiro', { time: tn(k.terceiro) })}</span>
          ) : null}
        </p>
      ) : !falta && c.mm.k ? (
        <p class="small" id="campMataAviso" style="margin:0 0 8px">
          {tx('mata.comeca')}
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
        {tx('camp.criterios', { lista: listaCrit(c.crit) })} {tx('mata.formato', { mata: tx(nomeMata(c.mm)) })}
      </p>
      <h4 style="margin:14px 0 6px">{tx('camp.jogos')}</h4>
      <ol class="plist camp-jogos" id="campJogos">
        {c.jogos.map((j, i) => {
          const [a, b] = lerPar(j),
            feito = res[i],
            agora = !feito && prox && prox.i === i,
            quadra = !feito && emQuadra(a, b);
          return (
            <li key={j} class={feito ? 'feito' : agora ? 'agora' : ''} data-j={j}>
              <span class="num">{i + 1}</span>
              <span class="pn">
                <Confronto
                  ca={times[a].c}
                  cb={times[b].c}
                  na={tn(a)}
                  nb={tn(b)}
                  ga={feito ? feito.ga : null}
                  gb={feito ? feito.gb : null}
                />
              </span>
              {quadra ? (
                <span class="tag">{tx('camp.emQuadra')}</span>
              ) : agora ? (
                <span class="tag alt">{tx('camp.proximo')}</span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {k.slots.length ? (
        <>
          <h4 style="margin:14px 0 6px">{tx('mata.titulo')}</h4>
          <ol class="plist wrap camp-jogos camp-chave" id="campChave">
            {k.slots.map(x => {
              const agora = k.proximo && k.proximo.id === x.id,
                lado = (t: number | null, o: Origem) =>
                  t != null ? (
                    <>
                      <Dot c={times[t].c} /> {tn(t)}
                    </>
                  ) : (
                    <span class="muted">{origem(o, k.slots)}</span>
                  );
              return (
                <li key={x.id} class={x.res ? 'feito' : agora ? 'agora' : ''} data-s={x.id}>
                  <span class="pn">
                    <span class="camp-fase small">{nomeFase(x)}</span>
                    {lado(x.a, x.oa)} <b>{x.res ? x.res.ga + ' × ' + x.res.gb : '×'}</b> {lado(x.b, x.ob)}
                    {x.dec ? (
                      <span class="small muted">
                        {' · '}
                        {x.dec.a != null && x.dec.b != null
                          ? tx('mata.penaltis', { a: x.dec.a, b: x.dec.b, time: tn(x.dec.p) })
                          : tx('mata.passou', { time: tn(x.dec.p) })}
                      </span>
                    ) : null}
                  </span>
                  {x.falta ? (
                    <button class="btn sm" data-a="quemPassou" data-v={x.id}>
                      {tx('mata.quemPassou')}
                    </button>
                  ) : !x.res && emQuadra(x.a, x.b) ? (
                    <span class="tag">{tx('camp.emQuadra')}</span>
                  ) : agora ? (
                    <span class="tag alt">{tx('camp.proximo')}</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </div>
  );
}
/* KAN-238: campeonato encerrado (ou parado esperando "Quem passou?"): no lugar do placar, o resultado e o convite
   para jogar fora do campeonato. Quem quiser mais partidas toca em "Jogar partida fora do campeonato". */
export function FimDoCampeonato({ r }: { r: Rodada }) {
  const k = chaveDe(r);
  if (!k) return null;
  if (!k.encerrado)
    return (
      <div class="panel camp-fim" id="campEsperando">
        <h3 style="margin:0 0 6px">{tx('camp.esperandoTitulo')}</h3>
        <p class="small muted" style="margin:0 0 10px">
          {tx('camp.esperandoTexto')}
        </p>
        <div class="row">
          {k.esperando.map(s => (
            <button key={s.id} class="btn primary" data-a="quemPassou" data-v={s.id}>
              {tx('camp.decidir', { fase: nomeFase(s) })}
            </button>
          ))}
        </div>
      </div>
    );
  return (
    <div class="panel camp-fim" id="campFim">
      <h3 style="margin:0 0 6px">{tx('camp.encerradoTitulo')}</h3>
      <p class="camp-lider" style="margin:0 0 4px">
        <span aria-hidden="true">🏆 </span>
        {tx('mata.campeao', { time: tn(k.campeao as number) })}
      </p>
      <p class="small muted" style="margin:0 0 12px">
        {[
          k.vice != null ? tx('mata.vice', { time: tn(k.vice) }) : '',
          k.terceiro != null && k.slots.some(s => s.id === 't3') ? tx('mata.terceiro', { time: tn(k.terceiro) }) : '',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <button class="btn" data-a="jogarFora" id="jogarFora">
        {tx('camp.jogarFora')}
      </button>
    </div>
  );
}
/* Aviso em cima do placar enquanto se joga fora do campeonato encerrado. */
export function AvisoFora() {
  return (
    <div class="inbar info" id="campForaAviso">
      <span>{tx('camp.foraAviso')}</span>
      <button class="btn sm" data-a="voltarCamp">
        {tx('camp.voltarCamp')}
      </button>
    </div>
  );
}
/* Nome do mata-mata ("Semifinais (1º × 4º, 2º × 3º) e final"). */
export const nomeMata = (m: { k: number; t3: boolean }) => 'mata.o.' + m.k + (m.t3 ? 't' : '');
