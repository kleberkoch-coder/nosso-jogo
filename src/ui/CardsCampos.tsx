/* Campos dos modelos do grupo na janela de cards (KAN-294): cor, fundo (com a imagem enviada, v127, e os fundos prontos,
   v128) e o acabamento do Clássico metálico (v127). Separados de ui/CardsJanela.tsx, que ficaria grande demais. */
import { useRef, useState } from 'preact/hooks';
import {
  FORMAS,
  FUNDOS_PRONTOS,
  METAIS,
  TIPOS_FUNDO,
  type Forma,
  type Fundo,
  type Metal,
  type Modelo,
} from '../dominio/cards';
import { tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { FUNDO_MAX_MB, FUNDO_TIPOS, arquivoFundo, subirFundo } from '../acoes/fundo-card';
import { FundoPronto } from './fundos-prontos';

const st = () => estado as Record<string, any>;

export function Cor({ id, rot, v, on }: { id: string; rot: string; v: string; on: (v: string) => void }) {
  return (
    <label class="card-cor" for={id}>
      <input id={id} type="color" value={v} onInput={e => on((e.currentTarget as HTMLInputElement).value)} />
      <span>{rot}</span>
    </label>
  );
}

/* Imagem de fundo enviada pelo grupo (v127): grava na hora no Storage; o modelo guarda o nome ao salvar. */
export function ImagemFundo({ k, f, on }: { k: string; f: Fundo; on: (f: Fundo) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const arq = useRef<HTMLInputElement>(null);
  const escolher = async (a: File | undefined) => {
    if (!a) return;
    setErro('');
    const ruim = arquivoFundo(a);
    if (ruim) {
      setErro(tx(ruim === 'tipo' ? 'card.imgTipo' : 'card.imgGrande', { mb: FUNDO_MAX_MB }));
      return;
    }
    setOcupado(true);
    try {
      const nome = await subirFundo(st().gid as string, a);
      if (!nome) setErro(tx('card.imgNaoAbriu'));
      else on({ ...f, t: 'imagem', img: nome });
    } catch (e) {
      console.warn('fundo do card', e);
      setErro(tx('card.imgNaoSalvou'));
    } finally {
      setOcupado(false);
      if (arq.current) arq.current.value = '';
    }
  };
  return (
    <div class="card-img">
      <button
        type="button"
        id={'cf' + k + 'Img'}
        class={ocupado ? 'btn sm busy' : 'btn sm'}
        aria-busy={ocupado}
        disabled={ocupado}
        onClick={() => arq.current?.click()}
      >
        {tx(f.img ? 'card.imgTrocar' : 'card.imgEscolher')}
      </button>
      <input
        ref={arq}
        id={'cf' + k + 'Arq'}
        type="file"
        accept={FUNDO_TIPOS.join(',')}
        hidden
        onChange={e => escolher((e.currentTarget as HTMLInputElement).files?.[0])}
      />
      <span class="small muted">{tx('card.imgLimites', { mb: FUNDO_MAX_MB })}</span>
      {erro ? (
        <p class="err small" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

/* KAN-303 (v128): galeria de fundos prontos, cada miniatura já nas cores do modelo. */
function GaleriaFundos({ k, f, on }: { k: string; f: Fundo; on: (f: Fundo) => void }) {
  return (
    <div class="card-prontos" id={'cf' + k + 'Prontos'} role="group" aria-label={tx('card.fundosProntos')}>
      {FUNDOS_PRONTOS.map(p => (
        <button
          key={p}
          type="button"
          class="card-pronto"
          data-p={p}
          aria-pressed={f.p === p}
          aria-label={tx('card.pronto.' + p)}
          title={tx('card.pronto.' + p)}
          onClick={() => on({ ...f, p })}
        >
          <svg viewBox="0 0 400 500" aria-hidden="true">
            <FundoPronto p={p} c1={f.c1} c2={f.c2} id={'mini-' + k + '-' + p} />
          </svg>
        </button>
      ))}
    </div>
  );
}

export function FundoCampos({ k, f, on }: { k: string; f: Fundo; on: (f: Fundo) => void }) {
  return (
    <fieldset class="card-fundo">
      <legend class="lbl">{tx('card.fundo.' + k)}</legend>
      <select
        class="sel"
        id={'cf' + k}
        aria-label={tx('card.fundo.' + k)}
        onChange={e => on({ ...f, t: (e.currentTarget as HTMLSelectElement).value as Fundo['t'] })}
      >
        {TIPOS_FUNDO.map(t => (
          <option key={t} value={t} selected={t === f.t}>
            {tx('card.tipoFundo.' + t)}
          </option>
        ))}
      </select>
      {f.t === 'imagem' ? <ImagemFundo k={k} f={f} on={on} /> : null}
      {f.t === 'pronto' ? <GaleriaFundos k={k} f={f} on={on} /> : null}
      <div class="card-cores">
        <Cor
          id={'cf' + k + '1'}
          rot={tx(f.t === 'cor' ? 'card.cor' : f.t === 'imagem' ? 'card.corAtras' : 'card.cor1')}
          v={f.c1}
          on={c1 => on({ ...f, c1 })}
        />
        {f.t !== 'cor' && f.t !== 'imagem' ? (
          <Cor id={'cf' + k + '2'} rot={tx('card.cor2')} v={f.c2} on={c2 => on({ ...f, c2 })} />
        ) : null}
      </div>
    </fieldset>
  );
}

export function MetalCampos({ m, on }: { m: Modelo; on: (p: Partial<Modelo>) => void }) {
  const mudarModelo = on;
  return (
    <div class="card-metal">
      <label class="lbl" for="cardMetal">
        {tx('card.metal')}
      </label>
      <select
        id="cardMetal"
        class="sel"
        onChange={e => mudarModelo({ metal: (e.currentTarget as HTMLSelectElement).value as Metal })}
      >
        {METAIS.map(x => (
          <option key={x} value={x} selected={x === (m.metal || 'ouro')}>
            {tx('card.metal.' + x)}
          </option>
        ))}
      </select>
      {m.metal === 'time' ? (
        <div class="card-cores">
          <Cor
            id="ccMetal"
            rot={tx('card.corMetal')}
            v={m.corMetal || '#3e72d0'}
            on={corMetal => mudarModelo({ corMetal })}
          />
        </div>
      ) : null}
      <label class="lbl" for="cardForma">
        {tx('card.forma')}
      </label>
      <select
        id="cardForma"
        class="sel"
        onChange={e => mudarModelo({ forma: (e.currentTarget as HTMLSelectElement).value as Forma })}
      >
        {FORMAS.map(x => (
          <option key={x} value={x} selected={x === (m.forma || 'coroa')}>
            {tx('card.forma.' + x)}
          </option>
        ))}
      </select>
    </div>
  );
}
