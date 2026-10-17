/* Ação "Recalcular" dos totais por mês (KAN-87), usada no Ranking. Fica fora da Partida, que baixa sob demanda (KAN-175). */
import { tx } from '../i18n/index.js';
import { recalcular } from '../nucleo/partidas.js';
import { toast } from '../nucleo/util.js';
import { confirmou } from '../ui/dialogos.js';

const acoes = {
  /* Recalcular os totais (KAN-87): ranking (ano, mês ou tudo) ou caixa (mês). */
  recalc: (el: HTMLElement & { dataset: DOMStringMap }) => {
    const p = el.dataset.v;
    if (
      confirmou(el, {
        titulo: tx('resumo.recalcularTitulo'),
        texto: tx('resumo.confirmaRecalcular'),
        acao: tx('resumo.recalcularAcao'),
      }) !== 'sim'
    )
      return;
    return recalcular(p).catch(e => {
      console.warn(e);
      toast(tx('resumo.erroRecalcular'));
    });
  },
};

export { acoes };
