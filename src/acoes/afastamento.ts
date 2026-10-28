/* Ações do afastamento (KAN-208). O código delas e a janela baixam na primeira vez que uma é usada
   (acoes/afastamento-lote.ts e ui/AfastamentoJanela.tsx), para a gestão abrir leve. Fazem parte de ACT (src/admin.js). */
import { tx } from '../i18n/index.js';
import { toast } from '../nucleo/util.js';

type El = HTMLElement & { dataset: DOMStringMap };
const parte = () => import('./afastamento-lote');
const adiar = (k: string) => (el: El) =>
  parte().then(
    m => (m.acoes as Record<string, (el: El) => unknown>)[k]!(el),
    () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
  );

export const acoes = Object.fromEntries(
  ['afastarDlg', 'afSalvar', 'afVoltou', 'afManter', 'afApagar'].map(k => [k, adiar(k)])
);
