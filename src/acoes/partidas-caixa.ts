/* Ações da janela "Partidas e caixa" (aba Grupo; KAN-209). Vêm com a aba Grupo (abas/grupo.ts). */
import { CAIXA_K, cfg, editPc } from '../dominio/caixa.js';
import { compComDia, diaValido, mudarDia } from '../dominio/ciclo';
import { tx } from '../i18n/index.js';
import { ciclo, mesHoje } from '../nucleo/afast';
import { editApp } from '../nucleo/edicoes.js';
import { S as estado } from '../nucleo/estado.js';
import { $, toast, today } from '../nucleo/util.js';
import { montarPartidasCaixa } from '../telas/PartidasCaixa';
import { closeDlg, dlg, openDlg, val } from '../ui/dialogos.js';

const st = (): any => estado;

export const acoes = {
  settings: () => {
    openDlg('<div id="pcRaiz"></div>');
    dlg.setAttribute('aria-labelledby', 'pcTitulo');
    montarPartidasCaixa();
  },
  saveSettings: () => {
    const S = st(),
      ps: Promise<unknown>[] = [];
    if ($('#cm')) {
      const dia = +val('cdia'),
        ja = (document.querySelector('input[name=cdiaQuando]:checked') as HTMLInputElement | null)?.value === 'atual';
      ps.push(
        editPc((a: Record<string, unknown>) => {
          Object.assign(a, { mensal: +val('cm') || 0, diaria: +val('cd') || 0, pix: val('cpx') });
          /* KAN-209: o dia em que começa o mês da mensalidade, já na atual ou a partir da próxima. */
          if (diaValido(dia)) a.ciclo = mudarDia(ciclo(), dia, ja ? compComDia(dia, today()) : mesHoje(), ja);
        })
      );
    }
    const mn = $('#cmin') ? +val('cmin') || 10 : (cfg() as { minutes: number }).minutes;
    if (
      $('#cmin') &&
      ((cfg() as { minutes: number }).minutes !== mn || CAIXA_K.some((k: string) => k in ((S.app || {}).cfg || {})))
    )
      ps.push(
        editApp((a: { cfg: Record<string, unknown> }) => {
          a.cfg.minutes = mn;
          CAIXA_K.forEach((k: string) => delete a.cfg[k]);
        })
      );
    closeDlg();
    toast(tx('pc.salvo'));
    return Promise.all(ps);
  },
};
