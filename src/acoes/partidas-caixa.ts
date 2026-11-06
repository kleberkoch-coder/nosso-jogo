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
import { lerMarcados } from '../ui/QuemParticipa';
import { lerParticipa } from '../dominio/votacao-participa';

const st = () => estado;

export const acoes = {
  settings: () => {
    openDlg('pcRaiz');
    dlg.setAttribute('aria-labelledby', 'pcTitulo');
    montarPartidasCaixa();
  },
  saveSettings: () => {
    const S = st(),
      ps: Promise<unknown>[] = [];
    /* KAN-210: mensalidade e diária não podem ser negativas; nada é gravado e o cursor vai para o campo. */
    const neg = ['cm', 'cd'].find(id => $('#' + id) && +val(id) < 0);
    if (neg) {
      const c = $('#' + neg) as HTMLInputElement;
      c.setAttribute('aria-invalid', 'true');
      c.focus();
      toast(tx('pc.negativo'));
      return;
    }
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
    const mn = $('#cmin') ? +val('cmin') || 10 : (cfg() as { minutes: number }).minutes,
      /* KAN-230: padrão de quem participa da votação (só com a permissão de configurações, como os minutos). */
      vp = $('#gvpart') ? lerMarcados('gvpart') : null,
      cfgAtual = ((S.app || {}).cfg || {}) as Record<string, unknown>,
      vpMudou = !!vp && JSON.stringify(lerParticipa(cfgAtual.votPart)) !== JSON.stringify(vp);
    if (
      $('#cmin') &&
      ((cfg() as { minutes: number }).minutes !== mn || CAIXA_K.some((k: string) => k in cfgAtual) || vpMudou)
    )
      ps.push(
        editApp((a: { cfg: Record<string, unknown> }) => {
          a.cfg.minutes = mn;
          if (vp) a.cfg.votPart = vp;
          CAIXA_K.forEach((k: string) => delete a.cfg[k]);
        })
      );
    closeDlg();
    toast(tx('pc.salvo'));
    return Promise.all(ps);
  },
};
