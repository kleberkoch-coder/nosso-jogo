/* Lista para dar nota na avaliação por link (KAN-214): nome e posição de cada avaliado, e a nota de 1 a 10.
   Usada no link (telas/PublicoAvaliacao.tsx) e pelo administrador no app. Nunca mostra a nota atual nem a dos outros.
   O que está marcado fica em rascunhoNotas(), que a ação de enviar lê (acoes/avaliacao-envio.ts). */
import { useState } from 'preact/hooks';
import { NOTAS } from '../dominio/avaliacao';
import { fmtL, pname, ppos } from '../dominio/grupo.js';
import { sport } from '../dominio/esportes.js';
import { LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { Pos } from './componentes';

let atual: Record<string, number> = {};
export const rascunhoNotas = () => atual;

/* Ordem: pela posição do esporte, depois pelo nome. */
export function ordenar(jogs: string[]): string[] {
  const ks = (sport().pos as string[][]).map(x => x[0]);
  const ordem = (id: string) => {
    const i = ks.indexOf(ppos(id));
    return i < 0 ? 99 : i;
  };
  return jogs.slice().sort((a, b) => ordem(a) - ordem(b) || pname(a).localeCompare(pname(b), LOCAL));
}

/* Quem usa passa key: trocar o nome (ou a avaliação) recomeça do que já foi enviado com ele. */
export function NotasAvaliacao({ jogs, inicial }: { jogs: string[]; inicial: Record<string, number> }) {
  const [notas, setN] = useState<Record<string, number>>(() => ({ ...inicial }));
  atual = notas;
  const dadas = jogs.filter(id => id in notas).length;
  return (
    <div class="aval-notas">
      <p class="small muted aval-escala">{tx('aval.escala')}</p>
      <ul class="plist aval-lista" id="avLista">
        {ordenar(jogs).map(id => (
          <li key={id} class="aval-linha">
            <span class="pn">
              <Pos id={id} /> {pname(id)}
            </span>
            <select
              class="sel aval-nota"
              data-p={id}
              aria-label={tx('aval.notaDe', { nome: pname(id) })}
              value={id in notas ? String(notas[id]) : ''}
              onChange={e => {
                const v = (e.currentTarget as HTMLSelectElement).value,
                  o = { ...notas };
                if (v === '') delete o[id];
                else o[id] = +v;
                setN(o);
              }}
            >
              <option value="">—</option>
              {NOTAS.map(v => (
                <option key={v} value={String(v)}>
                  {fmtL(v)}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <p class="small muted" id="avConta" aria-live="polite">
        {tx('aval.dadas', { n: dadas, total: jogs.length })}
      </p>
    </div>
  );
}
