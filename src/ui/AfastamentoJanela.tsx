/* Janela "Afastar" do jogador (KAN-208): motivo, período em meses inteiros e, para quem tem Caixa no Plano A,
   se a mensalidade é cobrada. Baixa só quando aberta (sob demanda). Os botões usam data-a (acoes/afastamento.ts). */
import { render } from 'preact';
import { MOTIVOS, doJogador, somaMes, type Afastamento } from '../dominio/afastamento';
import { pname } from '../dominio/grupo.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-afast';
import { afs, isencoes, mesCurto, mesHoje } from '../nucleo/afast';
import { fmonth } from '../nucleo/util.js';

juntarTextos(textos);

/* Meses da lista: de 12 meses atrás até 24 à frente (e os do afastamento, se estiverem fora). */
function meses(extra: (string | undefined)[]): string[] {
  const h = mesHoje(),
    l = Array.from({ length: 37 }, (_, i) => somaMes(h, i - 12));
  extra.forEach(m => {
    if (m && !l.includes(m)) l.push(m);
  });
  return l.sort();
}
export const periodo = (a: { de: string; ate?: string }) =>
  a.ate
    ? tx('afast.periodo', { de: mesCurto(a.de), ate: mesCurto(a.ate) })
    : tx('afast.periodoAberto', { de: mesCurto(a.de) });

function Janela({ pid, aid, comCaixa }: { pid: string; aid: string | null; comCaixa: boolean }) {
  const a: Partial<Afastamento> = (aid && afs()[aid]) || {},
    isento = aid ? !!isencoes()[aid] : true,
    de = a.de || mesHoje(),
    ms = meses([a.de, a.ate]),
    hist = doJogador(afs(), pid).filter(([id]) => id !== aid),
    ativo = !!aid && (!a.ate || a.ate >= mesHoje()) && (a.de || '') <= mesHoje();
  return (
    <>
      <h3 id="afTitulo">{tx(aid ? 'afast.tituloEditar' : 'afast.titulo', { nome: pname(pid) })}</h3>
      <p class="small muted">{tx('afast.ajuda')}</p>
      <label class="f">
        <span>{tx('afast.motivo')}</span>
        <select class="sel" id="afMot">
          {MOTIVOS.map(m => (
            <option key={m} value={m} selected={m === (a.mot || 'lesao')}>
              {tx('afast.mot.' + m)}
            </option>
          ))}
        </select>
      </label>
      <label class="f">
        <span>{tx('afast.obs')}</span>
        <input class="inp" id="afObs" maxLength={60} value={a.obs || ''} placeholder={tx('afast.obsExemplo')} />
      </label>
      <div class="af-meses">
        <label class="f">
          <span>{tx('afast.de')}</span>
          <select class="sel" id="afDe">
            {ms.map(m => (
              <option key={m} value={m} selected={m === de}>
                {fmonth(m)}
              </option>
            ))}
          </select>
        </label>
        <label class="f">
          <span>{tx('afast.ate')}</span>
          <select class="sel" id="afAte">
            <option value="" selected={!a.ate}>
              {tx('afast.ateVoltar')}
            </option>
            {ms.map(m => (
              <option key={m} value={m} selected={m === a.ate}>
                {fmonth(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {comCaixa ? (
        <fieldset class="f chk-lista" id="afCobra">
          <legend class="lbl">{tx('afast.mensalidade')}</legend>
          <label class="chk-linha">
            <input type="radio" name="afCobra" value="nao" defaultChecked={isento} />
            <span>{tx('afast.naoCobrar')}</span>
          </label>
          <label class="chk-linha">
            <input type="radio" name="afCobra" value="sim" defaultChecked={!isento} />
            <span>{tx('afast.cobrar')}</span>
          </label>
        </fieldset>
      ) : null}
      <p class="small muted">{tx('afast.soAdmins')}</p>
      {hist.length ? (
        <details class="small">
          <summary>{tx('afast.historico')}</summary>
          <ul class="plist">
            {hist.map(([id, h]) => (
              <li key={id}>
                <span class="pn">
                  {periodo(h)} · {tx('afast.mot.' + h.mot)}
                  {h.obs ? ' · ' + h.obs : ''}
                  {isencoes()[id] ? ' · ' + tx('afast.semCobranca') : ''}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div class="dlg-f">
        {aid ? (
          <button class="btn ghost danger" data-a="afApagar" data-v={aid}>
            {tx('afast.apagar')}
          </button>
        ) : null}
        {ativo ? (
          <button class="btn" data-a="afVoltou" data-v={aid}>
            {tx('afast.voltouAgora')}
          </button>
        ) : null}
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="afSalvar" data-p={pid} data-v={aid || ''}>
          {tx(aid ? 'afast.salvarEditar' : 'afast.salvar')}
        </button>
      </div>
    </>
  );
}

export function montarAfastamento(el: HTMLElement, pid: string, aid: string | null, comCaixa: boolean) {
  render(<Janela pid={pid} aid={aid} comCaixa={comCaixa} />, el);
}
export const textoErro = (k: string) => tx(k);
