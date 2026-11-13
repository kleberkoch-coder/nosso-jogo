/* Ações da janela "Avisos no celular" (KAN-242). O código baixa na primeira vez que uma é usada (ui/AvisosJanela.tsx),
   para a gestão abrir leve. Fazem parte de ACT (src/admin.js). */
import { tx } from '../i18n/index.js';
import { toast } from '../nucleo/util.js';

type El = HTMLElement & { dataset: DOMStringMap };
type Acoes = Record<string, (el: El) => unknown>;
let pronto: Acoes | null = null;
const parte = () => import('../ui/AvisosJanela').then(m => ((pronto = m.acoes as Acoes), m));
const adiar = (k: string) => (el: El) =>
  pronto
    ? pronto[k]!(el)
    : parte().then(
        () => pronto![k]!(el),
        () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
      );

export const ACOES_AVISOS = [
  'avisosDlg',
  'avisosInstalar',
  'avisosLigar',
  'avisosDesligar',
  'avisosGrupo',
  'avisosMinimo',
];
export const acoes = Object.fromEntries(ACOES_AVISOS.map(k => [k, adiar(k)]));

/* Quem já ligou os avisos neste celular: confere o token depois que o app abre (sem pressa, para não pesar). */
export function renovarDepois() {
  try {
    if (!localStorage.getItem('nj-avisos')) return;
  } catch (e) {
    return;
  }
  setTimeout(() => import('../nucleo/avisos-aparelho').then(m => m.renovar()).catch(() => {}), 15000);
}
