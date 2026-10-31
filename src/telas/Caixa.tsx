/* Aba Caixa (KAN-135): componente TypeScript + Preact, sem montar HTML como texto (o Preact escapa todo texto sozinho).
   As contas ficam em src/dominio/caixa-regras.ts, com teste próprio. Os botões continuam com data-a e o seletor
   de mês com data-c, então ações, carregando e gravação sem sinal são as mesmas do resto do app.
   Caixa é só para administradores: valores e Pix ficam em privado/caixa (KAN-79). */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { cfg, ptipo } from '../dominio/caixa.js';
import {
  aPagar,
  mesesDoCaixa,
  pendenciasDoMes,
  resumoDoCaixa,
  type APagar,
  type Lancamento,
  type Recebe,
  type RodadaDoMes,
  type Pendencia,
  type Tipo,
} from '../dominio/caixa-regras';
import { somaMes } from '../dominio/afastamento';
import { anteriores } from '../dominio/ciclo';
import { players, pname, rodadas, rodadasDoMes } from '../dominio/grupo.js';
import { saldo as saldoDasFichas, type Resumo } from '../dominio/resumos';
import { tp, tx } from '../i18n/index.js';
import { LOCAL, simboloMoeda } from '../i18n/formatos.js';
import { ciclo, fdm, mesHoje, periodoDe, semMensalNoMes } from '../nucleo/afast';
import { S as estado } from '../nucleo/estado.js';
import { brl, fdate, fmonth, today } from '../nucleo/util.js';
import { QuadroAno } from './QuadroAno';
import { SecaoRateios, rateios } from './Rateios';
import { nomeNoRateio, pendenciasDeRateio } from '../dominio/rateio';

const st = () => estado;
let quadroAberto = false;
type Lanc = Lancamento & { id: string };

/* Pendências do mês com o texto de cada uma (usado pela tela, pelo "Recebi" e pela cobrança no WhatsApp).
   KAN-209: no mês de hoje, a mensalidade é a da competência atual (com o ciclo depois do dia 1, pode ser a do mês
   anterior) e entram as das 6 competências anteriores ainda em aberto ("Em atraso"). Diárias seguem as rodadas do mês. */
type Pend = Omit<Pendencia, 'k'> & {
  k: Pendencia['k'] | 'rateio';
  label: string;
  cob?: string;
  atraso?: boolean;
  nome?: string; // KAN-216: quem é de fora do elenco (no rateio)
};
/* "jan. de 2026": cabe na linha do celular. */
const mesAno = (m: string) => new Date(m + '-15T12:00').toLocaleDateString(LOCAL, { month: 'short', year: 'numeric' });
const dataLocal = (ms?: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const nomeComp = (comp: string) => fmonth(comp).toLowerCase();
export function compDaVista(month: string) {
  return month === today().slice(0, 7) ? mesHoje() : month;
}
function pendencias(month: string): Pend[] {
  const S = st(),
    c = cfg() as { mensal: number; diaria: number };
  const tipo = (id: string): Tipo => (S.jog[id] ? ptipo(id) : 'avulso') as Tipo;
  const lancamentos = Object.values(S.caixa) as Lancamento[],
    elenco: string[] = players().map((p: { id: string }) => p.id),
    valores = { mensal: c.mensal, diaria: c.diaria },
    comp = compDaVista(month);
  const doMes: Pend[] = pendenciasDoMes({
    mes: comp,
    lancamentos,
    elenco,
    tipo,
    rodadas: rodadasDoMes(month),
    valores,
    semMensal: semMensalNoMes(comp),
  }).map(p =>
    Object.assign(p, {
      label: p.k === 'mensal' ? tx('caixa.mensalidade') : tx('caixa.diariaDe', { data: fdate(p.data) }),
      cob: p.k === 'mensal' ? tx('caixa.mensalidadeDe', { mes: nomeComp(comp) }) : undefined,
    })
  );
  if (month !== today().slice(0, 7)) return doMes;
  /* KAN-213: rateios abertos marcados para aparecer nas pendências (o rateio vai em ref). */
  pendenciasDeRateio(rateios()).forEach(x =>
    doMes.push({
      pid: x.pid,
      k: 'rateio',
      ref: x.rid,
      v: x.v / 100,
      label: x.n,
      cob: x.n,
      nome: nomeNoRateio(rateios()[x.rid] || {}, x.pid, pname),
    })
  );
  /* Em atraso: quem entrou no elenco depois do período não deve aquele mês. */
  const atraso: Pend[] = [];
  anteriores(comp).forEach(m => {
    const fim = periodoDe(m).fim;
    pendenciasDoMes({
      mes: m,
      lancamentos,
      elenco: elenco.filter(id => !S.jog[id]?.criado || dataLocal(S.jog[id].criado) <= fim),
      tipo,
      rodadas: [],
      valores,
      semMensal: semMensalNoMes(m),
    }).forEach(p =>
      atraso.push(
        Object.assign(p, { label: mesAno(m), cob: tx('caixa.mensalidadeDe', { mes: nomeComp(m) }), atraso: true })
      )
    );
  });
  return doMes.concat(atraso);
}

/* A pagar por jogo (KAN-172): rodadas carregadas desde o primeiro dia em que alguém passou a receber (S.rodPag). */
function listaAPagar(): APagar[] {
  const S = st();
  return aPagar({
    lancamentos: Object.values(S.caixa) as Lancamento[],
    recebe: ((S.pc || {}).porJogo || {}) as Record<string, Recebe>,
    rodadas: Object.entries((S.rodPag || {}) as Record<string, RodadaDoMes>).map(([id, v]) => ({ ...v, id })),
  });
}

/* Janela "Pagar": os jogos acumulados, todos marcados; o total acompanha as marcas e pode ser ajustado. */
function Pagar({ a }: { a: APagar }) {
  const [marcados, setMarcados] = useState<string[]>(a.jogos.map(j => j.rid));
  const [total, setTotal] = useState<string>(String(a.total));
  const trocar = (rid: string, on: boolean) => {
    const m = on ? marcados.concat(rid) : marcados.filter(x => x !== rid);
    setMarcados(m);
    setTotal(String(Math.round(a.v * m.length * 100) / 100));
  };
  return (
    <>
      <h3>{tx('caixa.pagarTitulo', { nome: pname(a.pid) })}</h3>
      <p class="small muted">{tx('caixa.pagarTexto', { valor: brl(a.v) })}</p>
      <div class="chk" id="apgLista">
        {a.jogos.map(j => (
          <label key={j.rid}>
            <input
              type="checkbox"
              class="apg"
              value={j.rid}
              checked={marcados.includes(j.rid)}
              onChange={e => trocar(j.rid, (e.currentTarget as HTMLInputElement).checked)}
            />
            {fdate(j.date)}
          </label>
        ))}
      </div>
      <label class="f">
        <span>{tx('caixa.pagarTotal', { moeda: simboloMoeda() })}</span>
        <input
          class="inp"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          id="apgv"
          value={total}
          onInput={e => setTotal((e.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="pagarJogos" data-v={a.pid}>
          {tx('caixa.paguei')}
        </button>
      </div>
    </>
  );
}
/* Janela "Novo lançamento" (KAN-209: virou componente). Mensalidade escolhe o mês (ou vários meses de uma vez):
   o valor acompanha a quantidade de meses, e o app grava um lançamento por mês, com a mesma data (acoes/caixa.js). */
const TIPOS_LAN = ['mensal', 'diaria', 'entrada', 'despesa'];
export const mesesParaLancar = () => {
  const c = mesHoje();
  return Array.from({ length: 10 }, (_, i) => somaMes(c, i - 6));
};
function NovoLancamento() {
  const c = cfg() as { mensal: number; diaria: number },
    hoje = mesHoje();
  const [k, setK] = useState('mensal');
  const [meses, setMeses] = useState<string[]>([hoje]);
  const [valor, setValor] = useState(String(c.mensal));
  const [data, setData] = useState(today());
  /* KAN-213: entrada ou despesa pode ficar ligada a um rateio aberto. */
  const abertos = Object.entries(rateios()).filter(([, r]) => r && !r.fim);
  const valorDe = (t: string, n: number) =>
    t === 'mensal' ? String(Math.round(c.mensal * n * 100) / 100) : t === 'diaria' ? String(c.diaria) : '';
  const trocarMes = (m: string, on: boolean) => {
    const l = (on ? meses.concat(m) : meses.filter(x => x !== m)).sort();
    setMeses(l);
    setValor(valorDe('mensal', l.length));
  };
  return (
    <>
      <h3 id="lanTitulo">{tx('caixa.novoLanc')}</h3>
      <label class="f">
        <span>{tx('caixa.tipo')}</span>
        <select
          class="sel"
          id="lk"
          value={k}
          onChange={e => {
            const t = (e.currentTarget as HTMLSelectElement).value;
            setK(t);
            setValor(valorDe(t, meses.length || 1));
          }}
        >
          {TIPOS_LAN.map(t => (
            <option key={t} value={t}>
              {tx('caixa.tipoLanc.' + t)}
            </option>
          ))}
        </select>
      </label>
      <label class="f">
        <span>{tx('caixa.jogadorOpcional')}</span>
        <select class="sel" id="lp2">
          <option value="">—</option>
          {(players() as { id: string; name: string }[]).map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {k === 'mensal' ? (
        <fieldset class="f chk-lista meses-grade" id="lanMeses">
          <legend class="lbl">{tx('caixa.mensalidadeDeQual')}</legend>
          {mesesParaLancar().map(m => (
            <label class="chk-linha" key={m}>
              <input
                type="checkbox"
                class="lm"
                value={m}
                checked={meses.includes(m)}
                onChange={e => trocarMes(m, (e.currentTarget as HTMLInputElement).checked)}
              />
              <span>
                {mesAno(m)}
                {m === hoje ? ' · ' + tx('caixa.atual') : ''}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <div class="row">
        <label class="f" style="flex:1">
          <span>{tx('caixa.valorMoeda', { moeda: simboloMoeda() })}</span>
          <input
            class="inp"
            type="number"
            min="0"
            step="0.01"
            id="lv"
            value={valor}
            onInput={e => setValor((e.currentTarget as HTMLInputElement).value)}
          />
        </label>
        <label class="f" style="flex:1">
          <span>{tx('caixa.data')}</span>
          <input
            class="inp"
            type="date"
            id="ld"
            value={data}
            onInput={e => setData((e.currentTarget as HTMLInputElement).value)}
          />
        </label>
      </div>
      {k === 'mensal' && meses.length > 1 ? (
        <p class="small muted" id="lanDivide">
          {tx('caixa.divideMeses', { n: meses.length, valor: brl((+valor || 0) / meses.length) })}
        </p>
      ) : null}
      {(k === 'entrada' || k === 'despesa') && abertos.length ? (
        <label class="f">
          <span>{tx('rateio.ligarLancamento')}</span>
          <select class="sel" id="lrat">
            <option value="">—</option>
            {abertos.map(([rid, r]) => (
              <option key={rid} value={rid}>
                {r!.n}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label class="f">
        <span>{tx('caixa.descricao')}</span>
        <input class="inp" id="ln" maxLength={60} />
      </label>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="saveLan">
          {tx('caixa.lancar')}
        </button>
      </div>
    </>
  );
}
function montarNovoLancamento() {
  const el = document.getElementById('lanRaiz');
  if (el) render(<NovoLancamento />, el);
}
function montarPagar(pid: string) {
  const a = listaAPagar().find(x => x.pid === pid),
    el = document.getElementById('apgRaiz');
  if (a && el) render(<Pagar a={a} />, el);
  return !!a;
}

const KL: Record<string, string> = {
  mensal: 'caixa.mensalidade',
  diaria: 'caixa.diaria',
  entrada: 'caixa.entrada',
  despesa: 'caixa.despesa',
};
const tipoTxt = (k: string) => (KL[k] ? tx(KL[k]) : k);
const Dinheiro = ({ v, neg }: { v: number; neg?: boolean }) => (
  <div class={'money' + (neg && v < 0 ? ' neg' : '')}>{brl(v)}</div>
);

function Caixa() {
  const S = st(),
    m: string = S.month;
  /* KAN-212: o Quadro do ano fica fechado e só se desenha quando aberto. A gestão redesenha a aba a cada mudança,
     então o "aberto" fica guardado fora do componente (vale até sair do grupo). */
  const [quadro, setQuadroEstado] = useState(quadroAberto);
  const setQuadro = (v: boolean) => {
    quadroAberto = v;
    if (v !== quadro) setQuadroEstado(v);
  };
  const lan: Lanc[] = Object.entries(S.caixa as Record<string, Lancamento>).map(([id, v]) => Object.assign({ id }, v));
  /* KAN-106: só os lançamentos recentes são carregados (janela do mês escolhido). Entradas, saídas e a lista do mês
     saem deles; o saldo de todo o histórico sai das fichas de resumo de cada mês (D11), mantidas a cada lançamento. */
  const fichas = S.resCx ? (Object.values(S.resCx) as Partial<Resumo>[]) : null,
    saldoTotal = fichas ? saldoDasFichas(fichas) : null,
    mesesComCaixa = (fichas || []).filter(f => f.cx && (f.cx.ent || f.cx.sai)).map(f => f.mes as string);
  const r = resumoDoCaixa(lan, m),
    pend = pendencias(m),
    linhaPend = (p: Pend) => {
      const i = pend.indexOf(p);
      return (
        <li key={p.k + p.pid + p.ref}>
          <span class="pn">
            {p.nome || pname(p.pid)} <span class="tag">{p.label}</span>
          </span>
          <b>{brl(p.v)}</b>
          <button
            class="btn sm"
            data-a="payPend"
            data-v={String(i)}
            aria-label={tx('caixa.recebiDe', { nome: p.nome || pname(p.pid), valor: brl(p.v) }) + ' · ' + p.label}
          >
            {tx('caixa.recebi')}
          </button>
        </li>
      );
    },
    pendMes = pend.filter(p => !p.atraso),
    pendAtraso = pend.filter(p => p.atraso),
    /* KAN-209: a mensalidade da vez e o período, quando não é o mês do calendário. */
    compV = compDaVista(m),
    pv = periodoDe(compV),
    cicloInfo =
      compV !== m || (ciclo() || []).length > 0
        ? tx('caixa.cicloInfo', { mes: nomeComp(compV), de: fdm(pv.ini), ate: fdm(pv.fim) })
        : '',
    apg = listaAPagar(),
    totalAPagar = apg.reduce((s, x) => s + x.total, 0);
  const meses = mesesDoCaixa(
    today(),
    lan,
    rodadas().map((x: { date: string }) => x.date),
    mesesComCaixa
  );
  return (
    <div class="stack">
      <div class="row between">
        <h2>{tx('caixa.titulo')}</h2>
        <div class="row">
          <select class="sel" style={{ width: 'auto' }} data-c="month" value={m} aria-label={tx('caixa.mes')}>
            {meses.map(x => (
              <option key={x} value={x}>
                {fmonth(x)}
              </option>
            ))}
          </select>
          <button class="btn primary" data-a="addLan">
            {tx('caixa.lancar')}
          </button>
        </div>
      </div>
      <div class="panel">
        <div class="kpis">
          <div>
            <div class="l">{tx('caixa.saldo')}</div>
            {saldoTotal == null ? <div class="money muted">…</div> : <Dinheiro v={saldoTotal} neg />}
          </div>
          <div>
            <div class="l">{tx('caixa.entradas')}</div>
            <Dinheiro v={r.entradas} />
          </div>
          <div>
            <div class="l">{tx('caixa.saidas')}</div>
            <Dinheiro v={r.saidas} />
          </div>
          {apg.length > 0 && (
            <div id="kpiAPagar">
              <div class="l">{tx('caixa.aPagarTotal')}</div>
              <div class="money neg">{brl(totalAPagar)}</div>
            </div>
          )}
        </div>
      </div>
      {apg.length > 0 && (
        <div class="panel">
          <h3 style={{ margin: 0 }}>{tx('caixa.aPagar')}</h3>
          <p class="small muted">{tx('caixa.aPagarAjuda')}</p>
          <ul class="plist" id="apagarLista">
            {apg.map(a => (
              <li key={a.pid}>
                <span class="pn">
                  {pname(a.pid)} <span class="tag">{tp('caixa.jogos', a.jogos.length)}</span>
                </span>
                <b>{brl(a.total)}</b>
                <button
                  class="btn sm"
                  data-a="abrirPagar"
                  data-v={a.pid}
                  aria-label={tx('caixa.pagarRotulo', { nome: pname(a.pid), valor: brl(a.total) })}
                >
                  {tx('caixa.pagar')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div class="grid2">
        <div class="panel">
          <div class="row between">
            <h3 style={{ margin: 0 }}>{tx('caixa.pendentes')}</h3>
            {pend.length > 0 && (
              <button class="btn sm" data-a="shareCob">
                {tx('caixa.cobrar')}
              </button>
            )}
          </div>
          {cicloInfo ? <p class="small muted ciclo-linha">{cicloInfo}</p> : null}
          <ul class="plist" style={{ marginTop: '6px' }} id="pendLista">
            {pendMes.length ? pendMes.map(linhaPend) : <li class="muted small">{tx('caixa.emDia')}</li>}
          </ul>
          {pendAtraso.length ? (
            <>
              <h4 class="atraso-tit">{tx('caixa.emAtraso', { n: pendAtraso.length })}</h4>
              <ul class="plist" id="atrasoLista">
                {pendAtraso.map(linhaPend)}
              </ul>
            </>
          ) : null}
        </div>
        <div class="panel">
          <h3>{tx('caixa.doMes')}</h3>
          <ul class="plist" id="lanLista">
            {r.doMes.length ? (
              r.doMes.map(l => (
                <li key={l.id}>
                  <span class="pn">
                    {tipoTxt(l.k)}
                    {l.pid ? ' — ' + pname(l.pid) : ''}
                    {l.note ? (
                      <>
                        {' '}
                        <span class="tag">{l.note}</span>
                      </>
                    ) : null}
                    <br />
                    <span class="tag">{fdate(l.d)}</span>
                  </span>
                  <b style={{ color: l.k === 'despesa' ? 'var(--out)' : 'var(--in)' }}>
                    {l.k === 'despesa' ? '−' : '+'}
                    {brl(+l.v || 0)}
                  </b>
                  <button
                    class="btn sm ghost danger"
                    data-a="delLan"
                    data-v={l.id}
                    aria-label={tx('caixa.apagarRotulo', {
                      tipo: tipoTxt(l.k) + (l.pid ? ' — ' + pname(l.pid) : ''),
                      valor: brl(+l.v || 0),
                    })}
                  >
                    ✕
                  </button>
                </li>
              ))
            ) : (
              <li class="muted small">{tx('caixa.nenhum')}</li>
            )}
          </ul>
        </div>
      </div>
      <SecaoRateios />
      <details
        class="panel quadro-painel"
        id="quadroAno"
        open={quadro}
        onToggle={e => setQuadro((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>
          <h3>{tx('quadro.titulo')}</h3>
          <span class="small muted">{tx('quadro.resumo')}</span>
        </summary>
        {quadro ? <QuadroAno /> : null}
      </details>
    </div>
  );
}

/* A gestão desenha as abas com texto; o Caixa entra num lugar reservado (#caixaRaiz) logo depois. */
const vCaixa = () => 'caixaRaiz';
function montarCaixa() {
  const el = document.getElementById('caixaRaiz');
  if (el) render(<Caixa />, el);
}

export { listaAPagar, montarCaixa, montarNovoLancamento, montarPagar, pendencias, vCaixa };
