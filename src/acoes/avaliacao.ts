/* Ações da avaliação por link (KAN-214). O código delas e a janela baixam na primeira vez que uma é usada
   (acoes/avaliacao-lote.ts e ui/AvaliacaoJanela.tsx), para a gestão abrir leve. Fazem parte de ACT (src/admin.js). */
import { tx } from '../i18n/index.js';
import { toast } from '../nucleo/util.js';

type El = HTMLElement & { dataset: DOMStringMap };
const parte = () => import('./avaliacao-lote');
const adiar = (k: string) => (el: El) =>
  parte().then(
    m => (m.acoes as Record<string, (el: El) => unknown>)[k]!(el),
    () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
  );

export const acoes = Object.fromEntries(
  [
    'avAbrir',
    'avVoltar',
    'avNova',
    'avCriar',
    'avLink',
    'avMinhas',
    'avEnviar',
    'avResultado',
    'avAplicar',
    'avEncerrar',
    'avApagar',
  ].map(k => [k, adiar(k)])
);
