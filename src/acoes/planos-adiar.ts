/* Ações dos planos (KAN-119): o código delas e as janelas baixam no primeiro toque (acoes/plano.ts), para a gestão
   abrir leve (KAN-274, pelada-v119). Fazem parte de ACT (src/admin.js). */
import { tx } from '../i18n/index.js';
import { toast } from '../nucleo/util.js';

type El = HTMLElement & { dataset: DOMStringMap };
const parte = () => import('./plano');
const adiar = (k: string) => (el: El) =>
  parte().then(
    m => (m.acoes as Record<string, (el: El) => unknown>)[k]!(el),
    () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
  );

export const acoes = Object.fromEntries(
  ['planosDlg', 'testarPlano', 'lerAvisoPlano', 'escolherAtivos', 'salvarAtivos'].map(k => [k, adiar(k)])
);
