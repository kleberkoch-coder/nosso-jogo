/* Janelas da gestão (KAN-149): sorteio, mover e escolher time, e as de jogador e avulso (KAN-274: estas em
   ui/JanelasJogador.tsx, sob demanda). Vão na parte de gestão, que o
   link público não baixa. Componentes desde a v84 (KAN-218); antes eram montadas como texto (ui/dialogos-gestao.js).
   Por fora, os mesmos ids, classes e data-a, que as ações (acoes/rodada.js, acoes/jogadores.js) e os testes leem. */
import { col, hasPos, porTime, posKeys, posLabel, siglaTela, sport, tn } from '../dominio/esportes.js';
import { resumo } from '../dominio/times.ts';
import { juntarTextos, tp, tx } from '../i18n/index.js';
import { pname, ppos } from '../dominio/grupo.js';
import { $, toast } from '../nucleo/util.js';
import { openDlg } from './dialogos.js';
import { CampoPosicao, Pos } from './componentes';

/* KAN-261 (pelada-v104): janelas de times e pares que baixam só quando abertas (ui/JanelasTimes.tsx). Elas recebem
   daqui o que usam do app, em vez de importar (ver D52). */
const utilJanelas = () => ({
  tx,
  tp,
  pname,
  tn,
  col,
  Pos,
  openDlg,
  sport,
  hasPos,
  posKeys,
  posLabel,
  siglaTela,
  ppos,
  porTime,
  resumo,
  $,
});
export type UtilJanelas = ReturnType<typeof utilJanelas>;
let JT: any = null;
export function comJanelasTimes(f: (m: any, u: UtilJanelas) => void) {
  return (JT ? Promise.resolve(JT) : import('./JanelasTimes').then(m => (JT = m))).then(
    m => {
      juntarTextos(m.textos);
      f(m, utilJanelas());
    },
    () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
  );
}
/* KAN-262 (pelada-v106): a janela do sorteio também baixa só quando aberta (ui/JanelasTimes.tsx). */
export const drawPreview = () => comJanelasTimes((m, u) => m.drawPreview(u));
/* KAN-274 (pelada-v119): as janelas de jogador e de avulso baixam só quando abertas (ui/JanelasJogador.tsx). */
type JJ = typeof import('./JanelasJogador');
let jj: Promise<JJ> | null = null;
export const janelasJogador = () =>
  (jj =
    jj ||
    import('./JanelasJogador').catch(e => {
      jj = null;
      throw e;
    }));
const naoCarregou = () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'));
export const playerDlg = (id: string | null, prefill?: any) =>
  janelasJogador().then(m => m.playerDlg(id, prefill), naoCarregou);
export const janelaAvulso = (regs: [string, { nome: string }][]) =>
  janelasJogador().then(m => m.janelaAvulso(regs), naoCarregou);
export const janelaEditarAvulso = (id: string, a: { nome: string; pos?: string; criado?: number }, tel: string) =>
  janelasJogador().then(m => m.janelaEditarAvulso(id, a, tel), naoCarregou);
