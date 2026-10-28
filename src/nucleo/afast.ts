/* Afastamento no app (KAN-208): lê o estado (privado/afast e a isenção em privado/caixa) e usa as regras puras
   de dominio/afastamento.ts. Parte da gestão: o link do jogador não baixa e não sabe de afastamento. */
import {
  afastamentoNoMes,
  afastadosQueConfirmaram,
  semMensalidade,
  type Afastamento,
  type Afastamentos,
  type Isencoes,
} from '../dominio/afastamento';
import { LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { S as estado } from './estado.js';
import { today } from './util.js';

const st = (): any => estado;
export const afs = (): Afastamentos => st().af || {};
export const isencoes = (): Isencoes => (st().pc || {}).afIsen || {};
export const mesHoje = () => today().slice(0, 7);

/* Afastado no mês (padrão: o mês de hoje). */
export const afastadoEm = (pid: string, mes = mesHoje()) => !!afastamentoNoMes(afs(), pid, mes);
export const afastamentoDe = (pid: string, mes = mesHoje()) => afastamentoNoMes(afs(), pid, mes);
export const semMensalNoMes = (mes: string) => (pid: string) => semMensalidade(afs(), isencoes(), pid, mes);
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
