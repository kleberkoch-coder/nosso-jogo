/* Quadro de mensalidades do ano (KAN-212): mensalistas nas linhas, as 12 competências nas colunas.
   Mostra só para quem tem a permissão de Caixa (a aba Caixa já exige). "Em aberto" é um botão que lança a mensalidade
   daquela competência na hora, com "Desfazer" (data-a="payMes", acoes/caixa.js). As contas ficam em dominio/quadro.ts. */
import { useState } from 'preact/hooks';
import { cfg, ptipo } from '../dominio/caixa.js';
import { pname, players } from '../dominio/grupo.js';
import { pagosPorComp, quadroDoAno, type Celula } from '../dominio/quadro';
import type { Lancamento } from '../dominio/resumos';
import { tp, tx } from '../i18n/index.js';
import { LOCAL } from '../i18n/formatos.js';
import { compDe, mesHoje, semMensalidadeEm } from '../nucleo/afast';
import { S as estado } from '../nucleo/estado.js';
import { brl, fdate, fmonth } from '../nucleo/util.js';

const st = () => estado;
/* Ano escolhido: a gestão redesenha a aba a cada mudança, então fica guardado fora do componente. */
let anoVisto = 0;
const mesCol = (m: string) => new Date(m + '-15T12:00').toLocaleDateString(LOCAL, { month: 'short' }).replace('.', '');
const dataLocal = (ms?: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

/* Data do pagamento, quando o lançamento está entre os carregados (os mais antigos mostram só o valor). */
function dataPaga(pid: string, comp: string): string {
  const l = (Object.values(st().caixa || {}) as Lancamento[]).find(
    x => x.k === 'mensal' && x.pid === pid && x.ref === comp
  );
  return l && l.d ? fdate(l.d) : '';
}
function Cel({ pid, c }: { pid: string; c: Celula }) {
  const nome = pname(pid),
    mes = fmonth(c.comp).toLowerCase();
  if (c.estado === 'pago') {
    const d = dataPaga(pid, c.comp),
      t = tx(d ? 'quadro.pagoEm' : 'quadro.pago', { nome, mes, valor: brl(c.v), data: d });
    return (
      <td class="q-pago" title={t}>
        <span aria-hidden="true">✓</span>
        <span class="sr">{t}</span>
      </td>
    );
  }
  if (c.estado === 'aberto')
    return (
      <td class="q-aberto">
        <button
          class="q-btn"
          data-a="payMes"
          data-p={pid}
          data-v={c.comp}
          aria-label={tx('quadro.receber', { nome, mes, valor: brl(cfg().mensal) })}
        >
          {tx('quadro.abertoCurto')}
        </button>
      </td>
    );
  const k = c.estado === 'isento' ? 'quadro.isento' : c.estado === 'antes' ? 'quadro.antes' : 'quadro.futuro';
  return (
    <td class={'q-' + c.estado} title={tx(k, { nome, mes })}>
      <span aria-hidden="true">
        {c.estado === 'isento' ? tx('quadro.afastCurto') : c.estado === 'antes' ? '—' : ''}
      </span>
      <span class="sr">{tx(k, { nome, mes })}</span>
    </td>
  );
}

export function QuadroAno() {
  const S = st(),
    hoje = mesHoje(),
    anoHoje = +hoje.slice(0, 4);
  const [ano, setAnoEstado] = useState<number>(anoVisto || anoHoje);
  const setAno = (a: number) => {
    anoVisto = a;
    setAnoEstado(a);
  };
  const fichas = Object.values(S.resCx || {}) as { mes?: string; mens?: Record<string, number> }[],
    lanc = Object.values(S.caixa || {}) as Lancamento[];
  const primeiro = Math.min(
    anoHoje,
    ...fichas.filter(f => f.mes && f.mens && Object.keys(f.mens).length).map(f => +(f.mes as string).slice(0, 4))
  );
  const mensalistas = players()
    .filter((p: { id: string }) => ptipo(p.id) === 'mensalista')
    .map((p: { id: string }) => {
      const c = S.jog[p.id]?.criado;
      return { pid: p.id, entrou: c ? compDe(dataLocal(c)) : undefined };
    });
  const q = quadroDoAno({
    ano: String(ano),
    hoje,
    mensalistas,
    pagos: pagosPorComp(fichas, lanc),
    semMensal: semMensalidadeEm,
  });
  return (
    <div class="quadro">
      <div class="row between quadro-ano">
        <button
          class="btn sm ghost"
          disabled={ano <= primeiro}
          onClick={() => setAno(ano - 1)}
          aria-label={tx('quadro.anoAnterior')}
        >
          ‹
        </button>
        <b aria-live="polite">{ano}</b>
        <button
          class="btn sm ghost"
          disabled={ano >= anoHoje + 1}
          onClick={() => setAno(ano + 1)}
          aria-label={tx('quadro.anoSeguinte')}
        >
          ›
        </button>
      </div>
      {S.resCx == null ? <p class="small muted">{tx('quadro.carregando')}</p> : null}
      {!q.linhas.length ? (
        <p class="small muted">{tx('quadro.semMensalistas')}</p>
      ) : (
        <div class="quadro-rolar" tabIndex={0} aria-label={tx('quadro.rolar')}>
          <table class="quadro-tab" id="quadroTab">
            <thead>
              <tr>
                <th scope="col" class="q-nome">
                  {tx('quadro.jogador')}
                </th>
                {q.meses.map(m => (
                  <th scope="col" key={m} class={m === hoje ? 'q-hoje' : ''}>
                    {mesCol(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.linhas.map(l => (
                <tr key={l.pid} data-pid={l.pid}>
                  <th scope="row" class="q-nome">
                    {pname(l.pid)}
                    {l.aberto ? (
                      <span class="q-conta" title={tp('quadro.emAberto', l.aberto)}>
                        <span aria-hidden="true">{l.aberto}</span>
                        <span class="sr">{tp('quadro.emAberto', l.aberto)}</span>
                      </span>
                    ) : null}
                  </th>
                  {l.cel.map(c => (
                    <Cel key={c.comp} pid={l.pid} c={c} />
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" class="q-nome">
                  {tx('quadro.pagaram')}
                </th>
                {q.pagaram.map((n, i) => (
                  <td key={q.meses[i]} class="q-total">
                    {n || ''}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" class="q-nome">
                  {tx('quadro.recebido')}
                </th>
                {q.recebido.map((v, i) => (
                  <td key={q.meses[i]} class="q-total">
                    {v ? brl(v).replace(/,00$/, '') : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p class="small muted quadro-legenda">{tx('quadro.legenda')}</p>
    </div>
  );
}
