/* Janela "Avaliação por link" do administrador (KAN-214): lista, nova avaliação, as minhas notas e o resultado.
   Baixa só quando aberta (acoes/avaliacao-lote.ts). Só aparece para quem tem a permissão de Notas.
   Os botões usam data-a; o estado da janela fica em acoes/avaliacao-lote.ts e chega aqui por props. */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { aberta, meioPonto, responderam, resultado, type Avaliacao, type Resposta } from '../dominio/avaliacao';
import { ptipo } from '../dominio/caixa.js';
import { fmtL, lvl, players, pname } from '../dominio/grupo.js';
import { LOCAL } from '../i18n/formatos.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-aval';
import { today } from '../nucleo/util.js';
import { NotasAvaliacao, ordenar } from './NotasAvaliacao';

juntarTextos(textos);

export type Tela =
  | { v: 'lista'; avs: Record<string, Avaliacao> }
  | { v: 'nova' }
  | { v: 'minhas'; aid: string; a: Avaliacao; minha: Resposta | null }
  | { v: 'res'; aid: string; a: Avaliacao; rs: Record<string, Resposta> };

const dataCurta = (ms: number) => new Date(ms).toLocaleDateString(LOCAL, { day: '2-digit', month: '2-digit' });
const fmt = (v: number | null) =>
  v == null ? '—' : v.toLocaleString(LOCAL, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
function maisDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* O que a nova avaliação tem agora (a ação "Criar" lê daqui). */
let novaAtual: { t: string; data: string; jogs: string[] } = { t: '', data: '', jogs: [] };
export const rascunhoNova = () => novaAtual;
/* Notas novas marcadas no resultado (a ação "Atualizar" lê daqui). */
let aplicarAtual: Record<string, number> = {};
export const rascunhoAplicar = () => aplicarAtual;

function Lista({ avs }: { avs: Record<string, Avaliacao> }) {
  const l = Object.entries(avs).sort((a, b) => (b[1].em || 0) - (a[1].em || 0)),
    agora = Date.now();
  return (
    <>
      <h3 id="avTitulo">{tx('aval.janela')}</h3>
      <p class="small muted">{tx('aval.ajuda')}</p>
      <div class="row">
        <button class="btn primary" data-a="avNova">
          {tx('aval.nova')}
        </button>
      </div>
      {!l.length ? <p class="small muted">{tx('aval.nenhuma')}</p> : null}
      <ul class="plist aval-avs" id="avAvs">
        {l.map(([aid, a]) => {
          const ab = aberta(a, agora);
          return (
            <li key={aid} class="aval-item" data-aid={aid}>
              <span class="pn">
                <b>{a.t}</b>
                <br />
                <span class={'tag' + (ab ? '' : ' alt')}>
                  {tx(ab ? 'aval.ate' : 'aval.encerradaTag', { data: dataCurta(a.ate) })}
                </span>{' '}
                <span class="small muted">{tx('aval.avaliados', { n: a.jogs.length })}</span>
              </span>
              <div class="row rat-acoes">
                {ab ? (
                  <button class="btn sm" data-a="avLink" data-v={aid}>
                    {tx('aval.compartilhar')}
                  </button>
                ) : null}
                {ab ? (
                  <button class="btn sm" data-a="avMinhas" data-v={aid}>
                    {tx('aval.minhas')}
                  </button>
                ) : null}
                <button class="btn sm" data-a="avResultado" data-v={aid}>
                  {tx('aval.resultado')}
                </button>
                {ab ? (
                  <button class="btn sm ghost" data-a="avEncerrar" data-v={aid}>
                    {tx('aval.encerrar')}
                  </button>
                ) : (
                  <button class="btn sm ghost danger" data-a="avApagar" data-v={aid}>
                    {tx('aval.apagar')}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('aval.fechar')}
        </button>
      </div>
    </>
  );
}

function Nova() {
  const elenco = players() as { id: string; name: string }[];
  const [t, setT] = useState(() =>
    tx('aval.tituloPadrao', { mes: new Date().toLocaleDateString(LOCAL, { month: 'long' }) })
  );
  const [data, setData] = useState(maisDias(7));
  const [sel, setSel] = useState<string[]>(() => elenco.filter(p => ptipo(p.id) === 'mensalista').map(p => p.id));
  novaAtual = { t: t.trim(), data, jogs: elenco.map(p => p.id).filter(id => sel.includes(id)) };
  return (
    <>
      <h3 id="avTitulo">{tx('aval.nova')}</h3>
      <label class="f">
        <span>{tx('aval.titulo')}</span>
        <input
          class="inp"
          id="avT"
          maxLength={60}
          value={t}
          onInput={e => setT((e.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <label class="f">
        <span>{tx('aval.fecha')}</span>
        <input
          class="inp"
          type="date"
          id="avData"
          min={today()}
          value={data}
          onInput={e => setData((e.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <fieldset class="f chk-lista" id="avQuem">
        <legend class="lbl">{tx('aval.quem', { n: sel.length })}</legend>
        <p class="small muted">{tx('aval.quemAjuda')}</p>
        {elenco.map(p => (
          <label class="chk-linha" key={p.id}>
            <input
              type="checkbox"
              class="avj"
              value={p.id}
              checked={sel.includes(p.id)}
              onChange={e =>
                setSel((e.currentTarget as HTMLInputElement).checked ? sel.concat(p.id) : sel.filter(x => x !== p.id))
              }
            />
            <span>{p.name}</span>
          </label>
        ))}
      </fieldset>
      <div class="dlg-f">
        <button class="btn" data-a="avVoltar">
          {tx('aval.voltar')}
        </button>
        <button class="btn primary" data-a="avCriar">
          {tx('aval.criar')}
        </button>
      </div>
    </>
  );
}

function Minhas({ aid, a, minha }: { aid: string; a: Avaliacao; minha: Resposta | null }) {
  return (
    <>
      <h3 id="avTitulo">{tx('aval.minhasTitulo', { t: a.t })}</h3>
      <p class="small muted">{tx('aval.minhasAjuda')}</p>
      <NotasAvaliacao key={aid} jogs={a.jogs} inicial={(minha && minha.n) || {}} />
      <div class="dlg-f">
        <button class="btn" data-a="avVoltar">
          {tx('aval.voltar')}
        </button>
        <button class="btn primary" data-a="avEnviar" data-v={aid} data-p="" data-adm="1">
          {tx(minha ? 'aval.atualizar' : 'aval.enviar')}
        </button>
      </div>
    </>
  );
}

function Resultado({ a, rs }: { a: Avaliacao; rs: Record<string, Resposta> }) {
  const linhas = resultado(a, rs),
    quem = responderam(rs);
  const [nova, setNova] = useState<Record<string, string>>({});
  const [marc, setMarc] = useState<string[]>([]);
  const ordem = ordenar(a.jogs),
    porPid = Object.fromEntries(linhas.map(l => [l.pid, l]));
  aplicarAtual = {};
  marc.forEach(pid => {
    const v = +(nova[pid] || '');
    if (v >= 1 && v <= 10) aplicarAtual[pid] = meioPonto(v);
  });
  const preencher = (k: 'media' | 'mediana') => {
    const o: Record<string, string> = {},
      m: string[] = [];
    linhas.forEach(l => {
      const v = l[k];
      if (v != null) {
        o[l.pid] = String(meioPonto(v));
        m.push(l.pid);
      }
    });
    setNova(o);
    setMarc(m);
  };
  return (
    <>
      <h3 id="avTitulo">{tx('aval.resultadoTitulo', { t: a.t })}</h3>
      <p class="small muted" id="avQuemRespondeu">
        {tx('aval.responderam', { n: quem.nomes.length + quem.adm, adm: quem.adm })}
        {quem.nomes.length
          ? ': ' +
            quem.nomes
              .map(pname)
              .sort((x, y) => x.localeCompare(y, LOCAL))
              .join(', ')
          : ''}
      </p>
      <p class="small muted">{tx('aval.resultadoAjuda')}</p>
      <div class="row rat-acoes">
        <button type="button" class="btn sm" id="avUsarMediana" onClick={() => preencher('mediana')}>
          {tx('aval.usarMediana')}
        </button>
        <button type="button" class="btn sm" id="avUsarMedia" onClick={() => preencher('media')}>
          {tx('aval.usarMedia')}
        </button>
      </div>
      <div class="quadro-rolar" tabIndex={0} aria-label={tx('aval.tabela')}>
        <table class="quadro-tab" id="avRes">
          <thead>
            <tr>
              <th scope="col" class="q-nome">
                {tx('aval.jogador')}
              </th>
              <th scope="col">{tx('aval.atual')}</th>
              <th scope="col">{tx('aval.media')}</th>
              <th scope="col">{tx('aval.mediana')}</th>
              <th scope="col">{tx('aval.qtd')}</th>
              <th scope="col">{tx('aval.novaNota')}</th>
            </tr>
          </thead>
          <tbody>
            {ordem.map(pid => {
              const l = porPid[pid]!,
                on = marc.includes(pid);
              return (
                <tr key={pid} data-pid={pid}>
                  <th scope="row" class="q-nome">
                    {pname(pid)}
                  </th>
                  <td>{fmtL(lvl(pid))}</td>
                  <td class="aval-media">{fmt(l.media)}</td>
                  <td class="aval-mediana">{fmt(l.mediana)}</td>
                  <td class="aval-qtd">{l.qtd}</td>
                  <td>
                    <label class="aval-aplicar">
                      <input
                        type="checkbox"
                        class="avap"
                        checked={on}
                        aria-label={tx('aval.atualizarDe', { nome: pname(pid) })}
                        onChange={e =>
                          setMarc(
                            (e.currentTarget as HTMLInputElement).checked
                              ? marc.concat(pid)
                              : marc.filter(x => x !== pid)
                          )
                        }
                      />
                      <input
                        class="inp aval-nova"
                        type="number"
                        inputmode="decimal"
                        min="1"
                        max="10"
                        step="0.5"
                        data-p={pid}
                        aria-label={tx('aval.novaDe', { nome: pname(pid) })}
                        value={nova[pid] || ''}
                        onInput={e => {
                          const v = (e.currentTarget as HTMLInputElement).value;
                          setNova({ ...nova, [pid]: v });
                          if (v && !marc.includes(pid)) setMarc(marc.concat(pid));
                        }}
                      />
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div class="dlg-f">
        <button class="btn" data-a="avVoltar">
          {tx('aval.voltar')}
        </button>
        <button class="btn primary" data-a="avAplicar">
          {tx('aval.aplicar', { n: Object.keys(aplicarAtual).length })}
        </button>
      </div>
    </>
  );
}

function Janela({ tela }: { tela: Tela }) {
  if (tela.v === 'nova') return <Nova />;
  if (tela.v === 'minhas') return <Minhas aid={tela.aid} a={tela.a} minha={tela.minha} />;
  if (tela.v === 'res') return <Resultado key={tela.aid} a={tela.a} rs={tela.rs} />;
  return <Lista avs={tela.avs} />;
}

export function montarAvaliacao(el: HTMLElement, tela: Tela) {
  render(<Janela tela={tela} />, el);
}
