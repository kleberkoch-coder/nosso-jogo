/* Afastamento e competência da mensalidade no app (KAN-208, KAN-209): lê o estado (privado/afast, a isenção e o ciclo
   em privado/caixa) e usa as regras puras de dominio/afastamento.ts e dominio/ciclo.ts. Parte da gestão: o link do jogador não baixa e não sabe de afastamento. */
import {
  afastamentoNoMes,
  afastadosQueConfirmaram,
  semMensalidade,
  type Afastamento,
  type Afastamentos,
  type Isencoes,
} from '../dominio/afastamento';
import { competenciaDe, periodo, type Ciclo } from '../dominio/ciclo';
import { FORMATO, LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { S as estado } from './estado.js';
import { today } from './util.js';

const st = () => estado;
export const afs = (): Afastamentos => st().af || {};
export const isencoes = (): Isencoes => (st().pc || {}).afIsen || {};
/* KAN-209: ciclo da mensalidade (privado/caixa.ciclo). Sem ele (ou sem a permissão de Caixa), o mês do calendário. */
export const ciclo = (): Ciclo => (st().pc || {}).ciclo;
export const compDe = (data: string) => competenciaDe(ciclo(), data);
export const periodoDe = (comp: string) => periodo(ciclo(), comp);
/* Dia e mês na ordem do país do grupo ("21/10"), para o período da mensalidade. */
export const fdm = (data: string) =>
  new Date(data + 'T12:00').toLocaleDateString(FORMATO, { day: '2-digit', month: '2-digit' });
/* Competência de hoje (a mensalidade "atual"). */
export const mesHoje = () => compDe(today());

/* Afastado no mês (padrão: o mês de hoje). */
export const afastadoEm = (pid: string, mes = mesHoje()) => !!afastamentoNoMes(afs(), pid, mes);
export const afastamentoDe = (pid: string, mes = mesHoje()) => afastamentoNoMes(afs(), pid, mes);
export const semMensalNoMes = (mes: string) => (pid: string) => semMensalidade(afs(), isencoes(), pid, mes);
export const semMensalidadeEm = (pid: string, mes: string) => semMensalidade(afs(), isencoes(), pid, mes);
export const confirmaramAfastados = (pres: Record<string, { s?: string }>, mes: string, rid: string) =>
  afastadosQueConfirmaram(afs(), pres, mes, rid);

/* "set." no ano atual; "jan. 2027" em outro ano. */
export function mesCurto(m: string): string {
  const d = new Date(m + '-15T12:00'),
    t = d.toLocaleDateString(LOCAL, { month: 'short' });
  return m.slice(0, 4) === mesHoje().slice(0, 4) ? t : t + ' ' + m.slice(0, 4);
}
/* Etiqueta na lista: "afastado até set." ou "afastado". */
export const etiqueta = (a: Afastamento) => (a.ate ? tx('afast.ateMes', { mes: mesCurto(a.ate) }) : tx('afast.semFim'));
