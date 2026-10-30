/* Campos das janelas da gestão (KAN-218, v84): nota, telefone, tipo do jogador, afastamento e as opções de um combo.
   Antes eram montados como texto (lvlIn, campoTelefone, campoTipo, linhaAfastamento); por fora, os mesmos ids e
   classes, que as ações (acoes/jogadores.js, acoes/rodada.js) e os testes leem. */
import { doJogador } from '../dominio/afastamento';
import { fmtL } from '../dominio/grupo.js';
import { separarTelefone } from '../dominio/paises.ts';
import { numeroParaCampo } from '../dominio/telefone.ts';
import { PAIS, simboloMoeda } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { afastamentoDe, afs, mesCurto } from '../nucleo/afast';
import { exemploTelefone } from './contato-form';
import { listaDdi } from './regiao.ts';

type Opcao = { v: string; t: string };
/* Opções de um combo, com a atual marcada. */
export function Opcoes({ lista, atual }: { lista: Opcao[]; atual: string }) {
  return (
    <>
      {lista.map(o => (
        <option key={o.v} value={o.v} selected={o.v === atual}>
          {o.t}
        </option>
      ))}
    </>
  );
}

/* Nota de 1 a 10 (barra de meio em meio ponto); o número ao lado acompanha (eventos.js, #plvo). */
export function CampoNota({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div class="f">
      <span class="lbl">{rotulo}</span>
      <div class="lvlin">
        <input type="range" id="plv" min="1" max="10" step="0.5" value={valor} aria-label={tx('nota.titulo')} />
        <output id="plvo">{fmtL(valor)}</output>
      </div>
      <div class="lvlscale">
        <span>{tx('nota.min')}</span>
        <span>{tx('nota.max')}</span>
      </div>
    </div>
  );
}

/* Telefone: combo do país (bandeira e código) e o número. */
export function CampoTelefone({ valor, rotulo }: { valor: string; rotulo: string }) {
  const { pais, numero } = separarTelefone(valor, PAIS);
  return (
    <div class="f campo-tel">
      <span class="lbl" id="ptelR">
        {rotulo}
      </span>
      <div class="tel-linha">
        <select class="sel" id="ppais" aria-label={tx('contato.telPais')}>
          <Opcoes lista={listaDdi()} atual={pais} />
        </select>
        <input
          class="inp"
          id="ptel"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          maxLength={22}
          value={numeroParaCampo(numero, pais)}
          placeholder={exemploTelefone(pais)}
          aria-labelledby="ptelR"
        />
      </div>
      <span class="small muted dica">{tx('contato.telDica')}</span>
    </div>
  );
}

/* Tipo do jogador e "Recebe por jogo" (KAN-172): só administradores veem; ficam em privado/caixa. */
const TIPOS = ['mensalista', 'diarista', 'isento'];
export function CampoTipo({ tipo, recebe }: { tipo?: string; recebe?: { v: number } | null }) {
  const t = tipo && TIPOS.includes(tipo) ? tipo : 'mensalista',
    on = !!(recebe && recebe.v > 0);
  return (
    <>
      <label class="f">
        <span>{tx('jogador.tipo')}</span>
        <select class="sel" id="ptp">
          {TIPOS.map(k => (
            <option key={k} value={k} selected={k === t}>
              {tx('tipo.' + k)}
            </option>
          ))}
        </select>
      </label>
      <div class="chk">
        <label>
          <input type="checkbox" id="prj" checked={on} />
          {tx('jogador.recebePorJogo')}
        </label>
      </div>
      <label class="f" id="prvBox" hidden={!on}>
        <span>{tx('jogador.valorPorJogo', { moeda: simboloMoeda() })}</span>
        <input class="inp" type="number" inputmode="decimal" min="0" step="0.01" id="prv" value={on ? recebe!.v : ''} />
      </label>
      <p class="small muted" style="margin-top:-4px">
        {tx('jogador.recebeDica')}
      </p>
    </>
  );
}

/* KAN-208: afastamento do jogador na ficha (situação de agora ou o último) e o botão que abre a janela. */
export function LinhaAfastamento({ id }: { id: string }) {
  const ag = afastamentoDe(id) as [string, { de: string; ate?: string; mot: string }] | null,
    ult = ag ? null : (doJogador(afs(), id)[0] as [string, { de: string; ate?: string }] | undefined),
    quando = (a: { de: string; ate?: string }) =>
      a.ate ? `${mesCurto(a.de)}–${mesCurto(a.ate)}` : mesCurto(a.de) + '–';
  const txt = ag
    ? tx('afast.fichaAtual', { quando: quando(ag[1]), motivo: tx('afast.mot.' + ag[1].mot) })
    : ult
      ? tx('afast.fichaUltimo', { quando: quando(ult[1]) })
      : '';
  return (
    <div class="row between afast-linha">
      <span class={'small' + (ag ? '' : ' muted')}>{txt || tx('afast.ficha')}</span>
      <button class="btn sm" data-a="afastarDlg" data-p={id} data-v={ag ? ag[0] : undefined}>
        {tx(ag ? 'afast.verAfastamento' : 'afast.afastar')}
      </button>
    </div>
  );
}
