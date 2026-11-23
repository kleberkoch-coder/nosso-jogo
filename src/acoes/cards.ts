/* Ações da janela "Cards do grupo" (KAN-294, pelada-v126). O código da janela (ui/CardsJanela.tsx, com o desenho,
   o estilo e os textos) baixa na primeira vez que uma é usada, para a aba Grupo abrir leve. Vêm com a aba Grupo. */
import { tx } from '../i18n/index.js';
import { toast } from '../nucleo/util.js';

type El = HTMLElement & { dataset: DOMStringMap };
type Acoes = Record<string, (el: El) => unknown>;
let pronto: Acoes | null = null;
const parte = () => import('../ui/CardsJanela').then(m => ((pronto = m.acoes as Acoes), m));
const adiar = (k: string) => (el: El) =>
  pronto
    ? pronto[k]!(el)
    : parte().then(
        () => pronto![k]!(el),
        () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
      );

export const acoes = Object.fromEntries(['cardsAbrir', 'cardsSalvar'].map(k => [k, adiar(k)]));
