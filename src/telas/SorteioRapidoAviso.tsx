/* Aviso do passo 2 do sorteio sem conta (KAN-282, pelada-v122): o motivo de não sortear, o tamanho do time e o atalho.
   As ações (srJogarCom e a troca do combo #srPorTimeAviso) ficam em SorteioRapido.tsx. */
import { faltamPara } from '../dominio/sorteio-rapido';
import { tx } from '../i18n/index.js';

/* KAN-282: faltando gente no passo 2, o motivo fica à vista, acima da barra ("Para dois times de 11, faltam 8. Vocês
   são 14."), com o tamanho do time para trocar ali mesmo e, quando der, o atalho "Jogar com 7 por time". Em duplas, a
   dupla é fixa: só o motivo. */
export function AvisoFalta({ total, porTime, duplas }: { total: number; porTime: number; duplas: boolean }) {
  const falta = faltamPara(total, porTime, duplas);
  if (!falta) return null;
  if (duplas)
    return (
      <p class="warn-alt sr-falta" id="srFalta">
        {tx(falta === 1 ? 'sr.motivoDuplas1' : 'sr.motivoDuplas', { n: falta })}
      </p>
    );
  const sugestao = Math.min(30, Math.floor(total / 2));
  return (
    <div class="warn-alt sr-falta" id="srFalta">
      <p>{tx(falta === 1 ? 'sr.motivo1' : 'sr.motivo', { n: falta, t: porTime, total })}</p>
      <div class="sr-falta-acoes">
        <label class="f">
          <span>{tx('sr.porTime')}</span>
          <select class="sel" id="srPorTimeAviso">
            {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n} selected={n === porTime}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {sugestao >= 3 ? (
          <button class="btn sm" data-a="srJogarCom" data-v={sugestao}>
            {tx('sr.jogarCom', { n: sugestao })}
          </button>
        ) : null}
      </div>
    </div>
  );
}
