/* Rateios (vaquinhas) no Caixa (KAN-213): a seção com os cartões e a janela "Novo rateio".
   Parte sob demanda do Caixa. Os botões usam data-a (acoes/rateio.ts); as contas ficam em dominio/rateio.ts. */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { ptipo } from '../dominio/caixa.js';
import { pname, players } from '../dominio/grupo.js';
import { centavos, dividirRateio, situacao, soma, valorFixo, type Rateio, type Rateios } from '../dominio/rateio';
import { tp, tx } from '../i18n/index.js';
import { simboloMoeda } from '../i18n/formatos.js';
import { S as estado } from '../nucleo/estado.js';
import { brl } from '../nucleo/util.js';

const st = (): any => estado;
export const rateios = (): Rateios => (st().pc || {}).rat || {};
const reais = (c: number) => brl(c / 100);

/* O que a janela tem agora (a ação "Salvar" lê daqui). */
type Rascunho = { n: string; modo: 'total' | 'fixo'; base: number; part: Record<string, number>; pend: boolean };
let atual: Rascunho | null = null;
export const rascunho = () => atual;

function Janela({ rid }: { rid: string }) {
  const r: Partial<Rateio> = (rid && rateios()[rid]) || {};
  const elenco = players() as { id: string; name: string }[],
    mensalistas = elenco.filter(p => ptipo(p.id) === 'mensalista').map(p => p.id);
  const [n, setN] = useState(r.n || '');
  const [modo, setModo] = useState<'total' | 'fixo'>(r.modo || 'total');
  const [base, setBase] = useState(r.base ? String(r.base / 100) : '');
  const [sel, setSel] = useState<string[]>(Object.keys(r.part || {}));
  const [pend, setPend] = useState(rid ? !!r.pend : true);
  /* Ao editar, os valores gravados que fogem da conta automática ficam como ajustados. */
  const [ajust, setAjust] = useState<Record<string, string>>(() => {
    if (!r.part) return {};
    const pids = Object.keys(r.part),
      auto = r.modo === 'fixo' ? valorFixo(r.base || 0, pids) : dividirRateio(r.base || 0, pids),
      o: Record<string, string> = {};
    pids.forEach(p => {
      if (r.part![p] !== auto[p]) o[p] = String(r.part![p]! / 100);
    });
    return o;
  });
  const ajustC: Record<string, number> = {};
  Object.entries(ajust).forEach(([p, v]) => {
    if (sel.includes(p) && v !== '') ajustC[p] = centavos(v);
  });
  const ordem = elenco.map(p => p.id).filter(id => sel.includes(id)),
    part = modo === 'total' ? dividirRateio(centavos(base), ordem, ajustC) : valorFixo(centavos(base), ordem, ajustC),
    total = soma(part);
  atual = { n: n.trim(), modo, base: centavos(base), part, pend };
  const marcar = (pid: string, on: boolean) => setSel(on ? sel.concat(pid) : sel.filter(x => x !== pid));
  return (
    <>
      <h3 id="ratTitulo">{tx(rid ? 'rateio.editar' : 'rateio.novo')}</h3>
      <label class="f">
        <span>{tx('rateio.nome')}</span>
        <input
          class="inp"
          id="rtn"
          maxLength={40}
          value={n}
          placeholder={tx('rateio.nomeExemplo')}
          onInput={e => setN((e.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <fieldset class="f chk-lista" id="rtModo">
        <legend class="lbl">{tx('rateio.comoDividir')}</legend>
        {(['total', 'fixo'] as const).map(m => (
          <label class="chk-linha" key={m}>
            <input type="radio" name="rtModo" value={m} checked={modo === m} onChange={() => setModo(m)} />
            <span>{tx('rateio.modo.' + m)}</span>
          </label>
        ))}
      </fieldset>
      <label class="f">
        <span>{tx(modo === 'total' ? 'rateio.valorTotal' : 'rateio.valorPessoa', { moeda: simboloMoeda() })}</span>
        <input
          class="inp"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          id="rtv"
          value={base}
          onInput={e => setBase((e.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <fieldset class="f rat-part" id="rtPart">
        <legend class="lbl">{tx('rateio.quem', { n: sel.length })}</legend>
        <div class="row rat-atalhos">
          <button type="button" class="btn sm" id="rtMensalistas" onClick={() => setSel(mensalistas)}>
            {tx('rateio.todosMensalistas')}
          </button>
          <button type="button" class="btn sm ghost" id="rtLimpar" onClick={() => setSel([])}>
            {tx('rateio.limpar')}
          </button>
        </div>
        {elenco.map(p => {
          const on = sel.includes(p.id);
          return (
            <div class={'rat-linha' + (on ? ' on' : '')} key={p.id}>
              <label class="chk-linha">
                <input
                  type="checkbox"
                  class="rtp"
                  value={p.id}
                  checked={on}
                  onChange={e => marcar(p.id, (e.currentTarget as HTMLInputElement).checked)}
                />
                <span>{p.name}</span>
              </label>
              {on ? (
                <input
                  class="inp rat-valor"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  step="0.01"
                  data-p={p.id}
                  aria-label={tx('rateio.valorDe', { nome: p.name })}
                  value={p.id in ajust ? ajust[p.id] : String((part[p.id] || 0) / 100)}
                  onInput={e => setAjust({ ...ajust, [p.id]: (e.currentTarget as HTMLInputElement).value })}
                />
              ) : null}
            </div>
          );
        })}
      </fieldset>
      <p class="small muted" id="rtSoma" aria-live="polite">
        {tx('rateio.soma', { n: ordem.length, valor: reais(total) })}
        {modo === 'total' && centavos(base) > 0 && total !== centavos(base)
          ? ' · ' + tx('rateio.somaDifere', { valor: reais(centavos(base)) })
          : ''}
      </p>
      <label class="chk-linha">
        <input
          type="checkbox"
          id="rtpend"
          checked={pend}
          onChange={e => setPend((e.currentTarget as HTMLInputElement).checked)}
        />
        <span>{tx('rateio.mostrarPendencias')}</span>
      </label>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="ratSalvar" data-v={rid}>
          {tx(rid ? 'rateio.salvar' : 'rateio.criar')}
        </button>
      </div>
    </>
  );
}
export function montarRateio(rid: string) {
  const el = document.getElementById('ratRaiz');
  if (el) render(<Janela key={rid || 'novo'} rid={rid} />, el);
}

function Cartao({ rid, r }: { rid: string; r: Rateio }) {
  const s = situacao(r),
    aberto = !r.fim;
  return (
    <div class="panel rateio" id={'rat-' + rid} data-rid={rid}>
      <div class="row between">
        <h3 class="rat-nome">{r.n}</h3>
        {aberto ? null : <span class="tag">{tx('rateio.encerrado')}</span>}
      </div>
      <p class="small rat-resumo">
        {tx('rateio.entrou', { entrou: reais(s.entrou), total: reais(s.total) })}
        {s.falta > 0 ? (
          <>
            {' · '}
            <b class="rat-falta">{tx('rateio.falta', { valor: reais(s.falta) })}</b>
          </>
        ) : null}
        {s.gasto ? ' · ' + tx('rateio.gasto', { valor: reais(s.gasto) }) : ''}
      </p>
      {s.faltam.length ? (
        <>
          <h4 class="rat-sub">{tx(aberto ? 'rateio.faltaPagar' : 'rateio.naoPagaram', { n: s.faltam.length })}</h4>
          <ul class="plist rat-faltam">
            {s.faltam.map(([pid, v]) => (
              <li key={pid}>
                <span class="pn">{pname(pid)}</span>
                <b>{reais(v)}</b>
                {aberto ? (
                  <button
                    class="btn sm"
                    data-a="ratRecebi"
                    data-v={rid}
                    data-p={pid}
                    aria-label={tx('caixa.recebiDe', { nome: pname(pid), valor: reais(v) }) + ' · ' + r.n}
                  >
                    {tx('caixa.recebi')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p class="small muted">{tx('rateio.todosPagaram')}</p>
      )}
      {s.pagaram.length ? (
        <details class="small rat-pagaram">
          <summary>{tp('rateio.pagaram', s.pagaram.length)}</summary>
          <ul class="plist">
            {s.pagaram.map(([pid, v]) => (
              <li key={pid}>
                <span class="pn">{pname(pid)}</span>
                <b>{reais(v)}</b>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div class="row rat-acoes">
        {aberto && s.faltam.length ? (
          <button class="btn sm" data-a="ratCobrar" data-v={rid}>
            {tx('caixa.cobrar')}
          </button>
        ) : null}
        {aberto ? (
          <button class="btn sm ghost" data-a="ratEditar" data-v={rid}>
            {tx('rateio.editarCurto')}
          </button>
        ) : null}
        <button class="btn sm ghost" data-a={aberto ? 'ratEncerrar' : 'ratReabrir'} data-v={rid}>
          {tx(aberto ? 'rateio.encerrar' : 'rateio.reabrir')}
        </button>
        {s.entrou === 0 && !s.gasto ? (
          <button class="btn sm ghost danger" data-a="ratApagar" data-v={rid}>
            {tx('rateio.apagar')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* Seção "Rateios" do Caixa: abertos primeiro (mais novo em cima); encerrados numa seção recolhível. */
export function SecaoRateios() {
  const lista = Object.entries(rateios()).filter((e): e is [string, Rateio] => !!e[1]);
  lista.sort((a, b) => (b[1].em || 0) - (a[1].em || 0));
  const abertos = lista.filter(([, r]) => !r.fim),
    fechados = lista.filter(([, r]) => r.fim);
  return (
    <section class="stack rateios" id="rateios" aria-labelledby="ratSecao">
      <div class="row between">
        <h3 id="ratSecao" style={{ margin: 0 }}>
          {tx('rateio.titulo')}
        </h3>
        <button class="btn sm" data-a="ratNovo">
          {tx('rateio.novoBotao')}
        </button>
      </div>
      {!abertos.length ? <p class="small muted">{tx('rateio.vazio')}</p> : null}
      {abertos.map(([rid, r]) => (
        <Cartao key={rid} rid={rid} r={r} />
      ))}
      {fechados.length ? (
        <details class="rat-fechados">
          <summary>{tx('rateio.encerrados', { n: fechados.length })}</summary>
          <div class="stack">
            {fechados.map(([rid, r]) => (
              <Cartao key={rid} rid={rid} r={r} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
