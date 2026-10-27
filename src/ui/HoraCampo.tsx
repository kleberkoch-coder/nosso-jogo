/* Componente do campo de horário (KAN-151; 12h com AM/PM no país que usa, KAN-163). Fica fora de ui/componentes.tsx
   porque é só da gestão: os textos dele (hora.*) não vão para o link do jogador. */
import { render } from 'preact';
import { para12, partes } from '../dominio/relogio';
import { tx } from '../i18n/index.js';
import './hora';
/* Campo de horário do app (KAN-151; 12h com AM/PM no país que usa, KAN-163). O valor "HH:MM" (24h) fica no campo
   escondido, com o id ou a classe que o formulário lê. O comportamento (setas, digitação, AM/PM) está em ui/hora.ts. */
export function HoraCampo({
  id,
  cls,
  valor,
  opcional,
  rotulo,
  doze,
}: {
  id?: string;
  cls?: string;
  valor?: string;
  opcional?: boolean;
  rotulo: string;
  doze: boolean;
}) {
  const x = partes(valor || ''),
    t = x ? para12(x[0]) : { h: 0, pm: true },
    h = x ? (doze ? String(t.h) : String(x[0]).padStart(2, '0')) : '',
    m = x ? String(x[1]).padStart(2, '0') : '';
  const parte = (p: 'h' | 'm', v: string, max: number, nome: string) => (
    <span class="hc">
      <button
        type="button"
        class="hseta"
        data-hseta={'+' + p}
        tabIndex={-1}
        aria-label={tx('hora.mais', { campo: nome })}
      >
        ▲
      </button>
      <input
        class={'inp h' + p}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        defaultValue={v}
        placeholder="--"
        enterkeyhint="done"
        data-max={max}
        aria-label={rotulo + ' — ' + nome}
      />
      <button
        type="button"
        class="hseta"
        data-hseta={'-' + p}
        tabIndex={-1}
        aria-label={tx('hora.menos', { campo: nome })}
      >
        ▼
      </button>
    </span>
  );
  const per = tx(t.pm ? 'relogio.pm' : 'relogio.am');
  return (
    <span
      class="hora"
      data-hora
      data-opcional={opcional ? '' : undefined}
      data-doze={doze ? '' : undefined}
      data-pm={doze && t.pm ? '1' : ''}
    >
      <input type="hidden" id={id || undefined} class={cls || undefined} defaultValue={x ? valor : ''} />
      {parte('h', h, doze ? 12 : 23, tx('hora.hora'))}
      <span class="hdois">:</span>
      {parte('m', m, 59, tx('hora.minutos'))}
      {doze && (
        <button type="button" class="hap" data-hap aria-label={tx('hora.periodo', { atual: per })}>
          {per}
        </button>
      )}
    </span>
  );
}

/* Campos de horário dentro de um formulário montado como texto (ex.: Nova rodada): cada <span data-hora-raiz>
   vira um HoraCampo, com id, valor, opcional e rótulo vindos dos atributos. */
export function montarHoras(raiz: ParentNode, doze: boolean) {
  raiz.querySelectorAll<HTMLElement>('[data-hora-raiz]').forEach(el => {
    const d = el.dataset;
    render(
      <HoraCampo id={d.horaRaiz} valor={d.v} opcional={'opcional' in d} rotulo={d.rotulo || ''} doze={doze} />,
      el
    );
  });
}
