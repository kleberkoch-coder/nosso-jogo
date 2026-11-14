/* Afastado no link (KAN-271, pelada-v117). Regra pura, testada em testes/regras/afast-link.test.mjs.
   O link do jogador não lê os afastamentos (privado/afast, com o motivo). Para ele mostrar o afastado como "Não vou",
   a gestão grava no jogador uma marca pública "af": só as datas de início e fim de cada afastamento atual ou futuro,
   já convertidas pelo ciclo da mensalidade (o link não conhece o ciclo). Sem motivo, sem observação. */
import type { Afastamentos } from './afastamento.ts';
import { competenciaDe, periodo, type Ciclo } from './ciclo.ts';

export type { Periodo } from './afast-data.ts';
import type { Periodo } from './afast-data.ts';

/* Até 6 períodos por jogador (o link só precisa dos atuais e futuros). */
const MAX = 6;

/* Os períodos públicos de um jogador: afastamentos que ainda valem na competência atual ou depois, em datas. */
export function periodosDe(afs: Afastamentos, ciclo: Ciclo, pid: string, compAtual: string): Periodo[] {
  return Object.values(afs || {})
    .filter(a => !!a && a.pid === pid && (!a.ate || a.ate >= compAtual))
    .map(a => ({ de: periodo(ciclo, a!.de).ini, ate: a!.ate ? periodo(ciclo, a!.ate).fim : '' }))
    .sort((x, y) => (x.de < y.de ? -1 : x.de > y.de ? 1 : 0))
    .slice(0, MAX);
}

const igual = (a: unknown, b: Periodo[]) => JSON.stringify(Array.isArray(a) ? a : []) === JSON.stringify(b);

/* Quem precisa ter a marca mudada: [id, períodos] (lista vazia = tirar a marca). Só jogadores do elenco.
   "hoje" é a data de hoje no fuso do grupo; a competência sai dela pelo ciclo. */
export function marcasAfastParaAjustar(
  jog: Record<string, { af?: unknown } | null | undefined>,
  afs: Afastamentos,
  ciclo: Ciclo,
  hoje: string
): [string, Periodo[]][] {
  const compAtual = competenciaDe(ciclo, hoje);
  return Object.entries(jog || {})
    .filter(([, j]) => !!j)
    .map(([id, j]) => [id, j!.af, periodosDe(afs, ciclo, id, compAtual)] as const)
    .filter(([, atual, novo]) => !igual(atual, novo) && !(atual == null && !novo.length))
    .map(([id, , novo]) => [id, novo] as [string, Periodo[]]);
}
