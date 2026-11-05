/* Ações do extra da rodada na gestão (KAN-228). O código baixa na primeira vez que uma é usada
   (telas/ExtraRodada.tsx), para a gestão abrir leve. Fazem parte de ACT (src/admin.js). */
import { tx } from '../i18n/index.js';
import { toast } from '../nucleo/util.js';

type El = HTMLElement & { dataset: DOMStringMap };
type Acoes = Record<string, (el: El) => unknown>;
let pronto: Acoes | null = null;
export const parteExtra = () => import('../telas/ExtraRodada').then(m => ((pronto = m.acoes as Acoes), m));
const adiar = (k: string) => (el: El) =>
  pronto
    ? pronto[k]!(el)
    : parteExtra().then(
        () => pronto![k]!(el),
        () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
      );

export const acoes = Object.fromEntries(
  ['abrirExtra', 'salvarExtra', 'desligarExtra', 'extraAdd', 'extraAddFora', 'extraTirar', 'extraRateio'].map(k => [
    k,
    adiar(k),
  ])
);
