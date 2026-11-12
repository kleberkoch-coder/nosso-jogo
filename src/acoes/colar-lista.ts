/* Ações de "Colar lista do WhatsApp" (KAN-244). O código baixa na primeira vez que uma é usada (ui/ColarLista.tsx), para a
   gestão abrir leve. Fazem parte de ACT (src/admin.js). */
import { tx } from '../i18n/index.js';
import { toast } from '../nucleo/util.js';

type El = HTMLElement & { dataset: DOMStringMap };
type Acoes = Record<string, (el: El) => unknown>;
let pronto: Acoes | null = null;
const parte = () => import('../ui/ColarLista').then(m => ((pronto = m.acoes as Acoes), m));
const adiar = (k: string) => (el: El) =>
  pronto
    ? pronto[k]!(el)
    : parte().then(
        () => pronto![k]!(el),
        () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
      );

export const acoes = Object.fromEntries(
  ['colarLista', 'colarLer', 'colarVoltar', 'colarTodosElenco', 'colarGravar'].map(k => [k, adiar(k)])
);
