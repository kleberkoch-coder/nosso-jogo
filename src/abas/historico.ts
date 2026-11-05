/* Aba Histórico sob demanda (KAN-180): baixa na primeira vez que a aba é aberta. As ações do histórico (KAN-85)
   vieram de acoes/rodada.js para cá, porque só existem dentro desta aba. */
import { abrirHist, buscarHist, estadoHist, montarHistorico, vHistorico } from '../telas/Historico';
import { comCores, pname } from '../dominio/grupo.js';
import { render } from '../ui/render.js';
import { mandarPartidas } from '../ui/zap-partidas';

export { buscarHist, estadoHist, vHistorico as ver, montarHistorico as montar };
export const ACOES = {
  histModo: (el: HTMLElement) => {
    estadoHist().modo = el.dataset.v === 'periodo' ? 'periodo' : 'mes';
    render();
  },
  histBuscar: () => buscarHist(false),
  histMais: () => buscarHist(true),
  histAbrir: (el: HTMLElement) => abrirHist(el.dataset.v || ''),
  /* KAN-232: as partidas da rodada aberta no WhatsApp, com a artilharia e a classificação. */
  histZap: () => {
    const h = estadoHist(),
      r = h.sel ? comCores(h.docs[h.sel]) : null;
    if (!r || !h.parts || !h.parts.length) return;
    const pres = h.pres || {};
    mandarPartidas(
      Object.assign({ id: h.sel }, r),
      h.parts as never,
      h.art,
      (pid: string) => (pres[pid] && pres[pid]!.nome) || pname(pid)
    );
  },
  histVoltar: () => {
    estadoHist().sel = null;
    render();
  },
};
