/* Ciclo da mensalidade (KAN-209, decisões do Kleber em 28/10/2026).
   - A mensalidade tem a competência ("AAAA-MM"): o mês em que o período começa. Com o ciclo no dia 20,
     20/01 a 19/02 é janeiro, e 20/12 a 19/01 é dezembro. O fluxo de caixa continua pela data em que o dinheiro entrou.
   - O ciclo é uma lista de regras { desde: competência, dia }: mudar o dia vale já na competência atual ou a partir
     da próxima. Sem regra, o dia é 1 (o mês do calendário, como antes).
   Regra pura, testada em testes/regras/ciclo.test.mjs. */
import { somaMes } from './afastamento.ts';

export type Regra = { desde: string; dia: number };
export type Ciclo = Regra[] | null | undefined;

const dd = (n: number) => String(n).padStart(2, '0');
export const diaValido = (d: unknown): d is number => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 28;

/* Dia em que começa a competência. */
export function diaDe(ciclo: Ciclo, comp: string): number {
  let dia = 1;
  (ciclo || [])
    .filter(r => r && diaValido(r.dia) && r.desde <= comp)
    .sort((a, b) => (a.desde < b.desde ? -1 : 1))
    .forEach(r => (dia = r.dia));
  return dia;
}
const inicio = (ciclo: Ciclo, comp: string) => comp + '-' + dd(diaDe(ciclo, comp));
function diaAntes(data: string): string {
  const d = new Date(data + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/* Período da competência: do dia de início até a véspera do início da seguinte. */
export function periodo(ciclo: Ciclo, comp: string): { ini: string; fim: string } {
  return { ini: inicio(ciclo, comp), fim: diaAntes(inicio(ciclo, somaMes(comp, 1))) };
}

/* Competência de uma data ("AAAA-MM-DD"): a do mês da data, ou a anterior se a data vem antes do início. */
export function competenciaDe(ciclo: Ciclo, data: string): string {
  const m = data.slice(0, 7);
  return data >= inicio(ciclo, m) ? m : somaMes(m, -1);
}

/* Competência que a data teria com o dia novo ("já na mensalidade atual": ela passa a seguir o dia novo). */
export const compComDia = (dia: number, data: string) => competenciaDe([{ desde: '0000-01', dia }], data);

/* Muda o dia: vale já na competência atual ou a partir da próxima. Regras de depois disso saem. */
export function mudarDia(ciclo: Ciclo, dia: number, compAtual: string, jaNaAtual: boolean): Regra[] {
  const desde = jaNaAtual ? compAtual : somaMes(compAtual, 1);
  const r = (ciclo || []).filter(x => x && x.desde < desde);
  return diaDe(r, desde) === dia ? r : r.concat({ desde, dia });
}

/* Competências anteriores à atual, da mais recente para a mais antiga (seção "Em atraso"). */
export const MESES_ATRASO = 6;
export const anteriores = (compAtual: string, n = MESES_ATRASO) =>
  Array.from({ length: n }, (_, i) => somaMes(compAtual, -(i + 1)));

/* Vários meses num lançamento só: um lançamento por competência, com o total dividido (centavos no primeiro). */
export function dividir(total: number, comps: string[]): [string, number][] {
  const c = Math.round(total * 100),
    n = comps.length,
    base = Math.floor(c / n);
  return comps.map((m, i) => [m, (base + (i === 0 ? c - base * n : 0)) / 100]);
}
