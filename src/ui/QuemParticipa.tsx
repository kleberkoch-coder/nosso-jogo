/* "Quem participa da votação" (KAN-230): caixas de marcar dos tipos de jogador e dos confirmados fora do sorteio.
   Usada no padrão do grupo (janela Partidas e caixa) e na janela Nova votação. Os valores saem por lerMarcados. */
import { posLabel, sport } from '../dominio/esportes.js';
import { type Participa } from '../dominio/votacao-participa';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-votpart';

juntarTextos(textos);

const CHAVES: (keyof Participa)[] = ['mensalista', 'diarista', 'avulso', 'fora'];
/* O exemplo dos fora do sorteio vem do esporte (goleiro no futebol; sem posição-chave, sem exemplo). */
const rotulo = (k: keyof Participa) => {
  const chave = (sport() as { key?: string }).key;
  return k === 'fora' && chave ? tx('votpart.foraEx', { pos: posLabel(chave).toLowerCase() }) : tx('votpart.' + k);
};

export function QuemParticipa({ p, id, ajuda }: { p: Participa; id: string; ajuda?: string }) {
  return (
    <fieldset class="f chk-lista" id={id}>
      <legend class="lbl">{tx('votpart.titulo')}</legend>
      {CHAVES.map(k => (
        <label class="chk-linha" key={k}>
          <input type="checkbox" class="vpart" value={k} defaultChecked={p[k]} />
          <span>{rotulo(k)}</span>
        </label>
      ))}
      {ajuda ? <p class="small muted">{ajuda}</p> : null}
    </fieldset>
  );
}

/* O que está marcado no fieldset id (todas as chaves, marcadas ou não). */
export function lerMarcados(id: string): Participa {
  const o = {} as Participa;
  CHAVES.forEach(k => {
    const el = document.querySelector('#' + id + ' .vpart[value="' + k + '"]') as HTMLInputElement | null;
    o[k] = !!(el && el.checked);
  });
  return o;
}
