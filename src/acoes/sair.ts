/* Sair da conta (KAN-80): confere se ficou algo sem enviar, desconecta, apaga os dados do grupo guardados neste aparelho e
   recarrega. Baixa só quando tocado (KAN-274, pelada-v119), com os textos (i18n/pt-BR-conta.ts). */
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-conta';
import * as banco from '../nucleo/backend.js';
import { avisar, confirmou } from '../ui/dialogos.js';

juntarTextos(textos);
const B = (): any => (banco as any).B;
type El = (HTMLElement & { _conf?: string }) | null | undefined;

const avisosLigados = () => {
  try {
    return !!localStorage.getItem('nj-avisos');
  } catch (e) {
    return false;
  }
};
export async function sairDaConta(destino: string, el: El) {
  if (!(el && el._conf === 'sim') && !(await B().semPendencias(3000))) {
    confirmou(el as HTMLElement, {
      titulo: tx('sair.pendentesTitulo'),
      texto: tx('sair.pendentes'),
      acao: tx('sair.mesmoAssim'),
      perigo: true,
    });
    return;
  }
  if (el) delete el._conf;
  /* KAN-242: com os avisos ligados neste celular, desliga antes de sair (o celular para de receber). */
  if (avisosLigados()) await import('../nucleo/avisos-aparelho').then(m => m.desligar()).catch(() => {});
  const limpou = await B().logout();
  if (limpou === false) await avisar(tx('sair.outrasAbasTitulo'), tx('sair.outrasAbas'));
  try {
    sessionStorage.clear();
  } catch (e) {}
  location.replace(location.pathname + location.search + destino);
  location.reload();
}
