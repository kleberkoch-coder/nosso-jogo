/* Aba Caixa (KAN-135): componente TypeScript + Preact, sem montar HTML como texto (o Preact escapa todo texto sozinho).
   As contas ficam em src/dominio/caixa-regras.ts, com teste próprio. Os botões continuam com data-a e o seletor
   de mês com data-c, então ações, carregando e gravação sem sinal são as mesmas do resto do app.
   Caixa é só para administradores: valores e Pix ficam em privado/caixa (KAN-79). */
import { render } from 'preact';
import { cfg, ptipo } from '../dominio/caixa.js';
import { mesesDoCaixa, pendenciasDoMes, resumoDoCaixa, type Lancamento, type Tipo } from '../dominio/caixa-regras';
import { players, pname, rodadas, rodadasDoMes } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { brl, fdate, fmonth, today } from '../nucleo/util.js';

const st = (): any => estado;
type Lanc = Lancamento & { id: string };

/* Pendências do mês com o texto de cada uma (usado pela tela, pelo "Recebi" e pela cobrança no WhatsApp). */
function pendencias(month: string) {
  const S = st(),
    c = cfg() as { mensal: number; diaria: number };
  const tipo = (id: string): Tipo => (S.jog[id] ? ptipo(id) : 'avulso') as Tipo;
  return pendenciasDoMes({
    mes: month,
    lancamentos: Object.values(S.caixa) as Lancamento[],
    elenco: players().map((p: { id: string }) => p.id),
    tipo,
    rodadas: rodadasDoMes(month),
    valores: { mensal: c.mensal, diaria: c.diaria },
  }).map(p =>
    Object.assign(p, {
      label: p.k === 'mensal' ? tx('caixa.mensalidade') : tx('caixa.diariaDe', { data: fdate(p.data) }),
    })
  );
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
  const lan: Lanc[] = Object.entries(S.caixa as Record<string, Lancamento>).map(([id, v]) => Object.assign({ id }, v));
  /* Os lançamentos já estão todos carregados, então saldo, entradas e saídas saem deles, exatos.
     A ficha do mês (resumos, cx) é mantida a cada lançamento para quando o caixa passar a carregar só o mês (D11, KAN-106). */
  const r = resumoDoCaixa(lan, m),
    pend = pendencias(m);
  const meses = mesesDoCaixa(
    today(),
    lan,
    rodadas().map((x: { date: string }) => x.date)
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
            <Dinheiro v={r.saldo} neg />
          </div>
          <div>
            <div class="l">{tx('caixa.entradas')}</div>
            <Dinheiro v={r.entradas} />
          </div>
          <div>
            <div class="l">{tx('caixa.saidas')}</div>
            <Dinheiro v={r.saidas} />
          </div>
        </div>
      </div>
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
          <ul class="plist" style={{ marginTop: '6px' }} id="pendLista">
            {pend.length ? (
              pend.map((p, i) => (
                <li key={p.k + p.pid + p.ref}>
                  <span class="pn">
                    {pname(p.pid)} <span class="tag">{p.label}</span>
                  </span>
                  <b>{brl(p.v)}</b>
                  <button
                    class="btn sm"
                    data-a="payPend"
                    data-v={String(i)}
                    aria-label={tx('caixa.recebiDe', { nome: pname(p.pid), valor: brl(p.v) })}
                  >
                    {tx('caixa.recebi')}
                  </button>
                </li>
              ))
            ) : (
              <li class="muted small">{tx('caixa.emDia')}</li>
            )}
          </ul>
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
    </div>
  );
}

/* A gestão desenha as abas com texto; o Caixa entra num lugar reservado (#caixaRaiz) logo depois. */
const vCaixa = () => '<div id="caixaRaiz"></div>';
function montarCaixa() {
  const el = document.getElementById('caixaRaiz');
  if (el) render(<Caixa />, el);
}

export { montarCaixa, pendencias, vCaixa };
