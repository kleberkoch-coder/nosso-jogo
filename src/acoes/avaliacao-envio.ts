/* Enviar as notas da avaliação (KAN-214): pelo link (data-p = nome escolhido) ou pelo administrador no app (data-p vazio).
   Cada aparelho grava só o próprio documento (avaliacoes/{id}/notas/{uid}); as regras do Firebase conferem tudo. */
import { notaValida } from '../dominio/avaliacao';
import { tx } from '../i18n/index.js';
import { GB, S, w } from '../nucleo/estado.js';
import { toast } from '../nucleo/util.js';
import { changed } from '../ui/render.js';
import { rascunhoNotas } from '../ui/NotasAvaliacao';

type El = HTMLElement & { dataset: DOMStringMap };
const st = S as any;

export const acoes: Record<string, (el: El) => unknown> = {
  avEnviar: el => {
    const aid = el.dataset.v || '',
      pid = el.dataset.p || '',
      admin = el.dataset.adm === '1';
    if (!aid || !st.user || (!pid && !admin)) return;
    const n: Record<string, number> = {};
    for (const [k, v] of Object.entries(rascunhoNotas())) if (notaValida(v)) n[k] = v;
    if (!Object.keys(n).length) {
      toast(tx('aval.nenhumaNota'));
      return;
    }
    const d = { pid, n, t: Date.now() };
    if (admin) st.minhaAvAdm = Object.assign({}, st.minhaAvAdm, { [aid]: d });
    else st.minhaAv = d;
    changed();
    toast(tx('aval.notasEnviadas', { n: Object.keys(n).length }));
    return w(GB.set('avaliacoes/' + aid + '/notas/' + st.user.uid, d));
  },
};
