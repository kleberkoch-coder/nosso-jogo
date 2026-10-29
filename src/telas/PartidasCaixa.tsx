/* Janela "Partidas e caixa" da aba Grupo (KAN-209: virou componente; antes, HTML em acoes/jogadores.js).
   Minutos por partida (permissão de configurações); mensalidade, diária, Pix e o dia em que começa o mês da
   mensalidade (permissão de Caixa, no Plano A). Os botões usam data-a (acoes/partidas-caixa.ts). */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { cfg } from '../dominio/caixa.js';
import { somaMes } from '../dominio/afastamento';
import { compComDia, diaDe, mudarDia } from '../dominio/ciclo';
import { posso, recurso } from '../dominio/grupo.js';
import { simboloMoeda } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { ciclo, fdm, mesHoje } from '../nucleo/afast';
import { periodo } from '../dominio/ciclo';
import { fmonth, today } from '../nucleo/util.js';

const DIAS = Array.from({ length: 28 }, (_, i) => i + 1);
const nome = (m: string) => fmonth(m).toLowerCase();

function Janela() {
  const c = cfg() as { mensal: number; diaria: number; minutes: number; pix?: string },
    comCaixa = posso('caixa') && recurso('caixa'),
    comConfig = posso('config'),
    atual = mesHoje(),
    diaAtual = diaDe(ciclo(), atual);
  const [dia, setDia] = useState(diaAtual);
  /* Campos com estado: a janela redesenha ao trocar o dia, sem apagar o que foi digitado. */
  const [v, setV] = useState({
    cm: String(c.mensal),
    cd: String(c.diaria),
    cmin: String(c.minutes),
    cpx: c.pix || '',
  });
  const campo = (k: keyof typeof v) => ({
    id: k,
    value: v[k],
    onInput: (e: Event) => setV(Object.assign({}, v, { [k]: (e.currentTarget as HTMLInputElement).value })),
  });
  const prev = (ja: boolean) => {
    const comp = ja ? compComDia(dia, today()) : somaMes(atual, 1),
      p = periodo(mudarDia(ciclo(), dia, ja ? comp : atual, ja), comp);
    return ja
      ? tx('pc.jaNaAtual', { mes: nome(comp), de: fdm(p.ini), ate: fdm(p.fim) })
      : tx('pc.aPartirProxima', {
          mes: nome(comp),
          de: fdm(p.ini),
          ate: fdm(p.fim),
          atual: nome(atual),
          fimAtual: fdm(periodo(mudarDia(ciclo(), dia, atual, false), atual).fim),
        });
  };
  return (
    <>
      <h3 id="pcTitulo">{tx(comCaixa ? 'grupo.partidasCaixa' : 'grupo.partidas')}</h3>
      {comCaixa ? (
        <div class="row">
          <label class="f" style="flex:1">
            <span>{tx('caixa.mensalidadeMoeda', { moeda: simboloMoeda() })}</span>
            <input class="inp" type="number" min="0" {...campo('cm')} />
          </label>
          <label class="f" style="flex:1">
            <span>{tx('caixa.diariaMoeda', { moeda: simboloMoeda() })}</span>
            <input class="inp" type="number" min="0" {...campo('cd')} />
          </label>
        </div>
      ) : null}
      {comCaixa ? (
        <>
          <label class="f">
            <span>{tx('pc.diaInicio')}</span>
            <select
              class="sel"
              id="cdia"
              style="max-width:140px"
              value={String(dia)}
              onChange={e => setDia(+(e.currentTarget as HTMLSelectElement).value)}
            >
              {DIAS.map(d => (
                <option key={d} value={String(d)}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <p class="small muted" style="margin-top:-4px">
            {tx('pc.diaAjuda', {
              mes: nome(atual),
              de: fdm(periodo(ciclo(), atual).ini),
              ate: fdm(periodo(ciclo(), atual).fim),
            })}
          </p>
          {dia !== diaAtual ? (
            <fieldset class="f chk-lista" id="cdiaQuando">
              <legend class="lbl">{tx('pc.quando')}</legend>
              <label class="chk-linha">
                <input type="radio" name="cdiaQuando" value="proxima" defaultChecked />
                <span>{prev(false)}</span>
              </label>
              <label class="chk-linha">
                <input type="radio" name="cdiaQuando" value="atual" />
                <span>{prev(true)}</span>
              </label>
            </fieldset>
          ) : null}
        </>
      ) : null}
      <div class="row">
        {comConfig ? (
          <label class="f" style="flex:1">
            <span>{tx('pc.minutos')}</span>
            <input class="inp" type="number" min="1" {...campo('cmin')} />
          </label>
        ) : null}
        {comCaixa ? (
          <label class="f" style="flex:1">
            <span>{tx('pc.pix')}</span>
            <input class="inp" {...campo('cpx')} />
          </label>
        ) : null}
      </div>
      {comCaixa ? (
        <p class="small muted" style="margin-top:-4px">
          {tx('pc.soAdmins')}
        </p>
      ) : null}
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="saveSettings">
          {tx('comum.salvar')}
        </button>
      </div>
    </>
  );
}

export function montarPartidasCaixa() {
  const el = document.getElementById('pcRaiz');
  if (el) render(<Janela />, el);
}
