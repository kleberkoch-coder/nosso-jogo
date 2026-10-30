/* Aba Histórico sob demanda (KAN-180): baixa na primeira vez que a aba é aberta. As ações do histórico (KAN-85)
   vieram de acoes/rodada.js para cá, porque só existem dentro desta aba. */
import { abrirHist, buscarHist, estadoHist, montarHistorico, vHistorico } from '../telas/Historico';
import { render } from '../ui/render.js';

export { buscarHist, estadoHist, vHistorico as ver, montarHistorico as montar };
export const ACOES = {
  histModo: (el: HTMLElement) => {
    estadoHist().modo = el.dataset.v === 'periodo' ? 'periodo' : 'mes';
    render();
  },
  histBuscar: () => buscarHist(false),
  histMais: () => buscarHist(true),
  histAbrir: (el: HTMLElement) => abrirHist(el.dataset.v || ''),
  histVoltar: () => {
    estadoHist().sel = null;
    render();
  },
};
