/* Quadro de mensalidades do ano (KAN-212, decisões do Kleber em 29/10/2026).
   - Só mensalistas, um por linha, com as 12 competências do ano (pela competência da mensalidade, não pela data do dinheiro).
   - Cada célula: pago, em aberto, sem cobrança (afastado com "Não cobrar"), antes de entrar no elenco, ou futuro.
   - Pago vem do resumo do caixa por competência (resumosCaixa/{mês}.mens) e dos lançamentos já carregados.
   - Rodapé: quantos pagaram e o total recebido de mensalidades em cada competência.
   Regra pura, testada em testes/regras/quadro.test.mjs. */
import { somaMes } from './afastamento.ts';

export type Estado = 'pago' | 'aberto' | 'isento' | 'antes' | 'futuro';
export type Celula = { comp: string; estado: Estado; v: number };
export type Linha = { pid: string; cel: Celula[]; aberto: number };
export type Quadro = { meses: string[]; linhas: Linha[]; recebido: number[]; pagaram: number[]; abertos: number[] };

export function mesesDoAno(ano: string): string[] {
  return Array.from({ length: 12 }, (_, i) => somaMes(ano + '-01', i));
}

export function quadroDoAno(p: {
  ano: string;
  hoje: string; // competência atual
  mensalistas: { pid: string; entrou?: string }[]; // entrou: competência em que passou a fazer parte
  pagos: Record<string, Record<string, number>>; // comp -> pid -> valor pago (em reais)
  semMensal?: (pid: string, comp: string) => boolean;
}): Quadro {
  const meses = mesesDoAno(p.ano),
    semMensal = p.semMensal || (() => false);
  const linhas: Linha[] = p.mensalistas.map(({ pid, entrou }) => {
    let aberto = 0;
    const cel = meses.map(comp => {
      const v = ((p.pagos[comp] || {})[pid] || 0) as number;
      let estado: Estado;
      if (v > 0) estado = 'pago';
      else if (comp > p.hoje) estado = 'futuro';
      else if (entrou && comp < entrou) estado = 'antes';
      else if (semMensal(pid, comp)) estado = 'isento';
      else estado = 'aberto';
      if (estado === 'aberto') aberto++;
      return { comp, estado, v };
    });
    return { pid, cel, aberto };
  });
  /* Recebido no rodapé: todas as mensalidades pagas na competência (inclusive de quem deixou de ser mensalista). */
  const recebido = meses.map(comp => {
    const t = Object.values(p.pagos[comp] || {}).reduce((s, v) => s + (+v || 0), 0);
    return Math.round(t * 100) / 100;
  });
  const pagaram = meses.map(comp => {
    const vs = Object.values(p.pagos[comp] || {});
    return vs.filter(v => v > 0).length;
  });
  const abertos = meses.map((_, i) => linhas.filter(l => l.cel[i]!.estado === 'aberto').length);
  return { meses, linhas, recebido, pagaram, abertos };
}

/* Pagos por competência: o resumo (centavos) e os lançamentos carregados (reais), o maior dos dois por jogador. */
export function pagosPorComp(
  resumos: { mes?: string; mens?: Record<string, number> }[],
  lancamentos: { k: string; v: number | string; pid?: string | null; ref?: string }[]
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  resumos.forEach(r => {
    if (!r || !r.mes || !r.mens) return;
    const o = (out[r.mes] = out[r.mes] || {});
    Object.entries(r.mens).forEach(([pid, c]) => {
      if (c > 0) o[pid] = c / 100;
    });
  });
  const doLanc: Record<string, Record<string, number>> = {};
  lancamentos.forEach(l => {
    if (l.k !== 'mensal' || !l.pid || !/^\d{4}-\d{2}$/.test(l.ref || '')) return;
    const o = (doLanc[l.ref as string] = doLanc[l.ref as string] || {});
    o[l.pid] = Math.round(((o[l.pid] || 0) + (+l.v || 0)) * 100) / 100;
  });
  for (const [comp, m] of Object.entries(doLanc)) {
    const o = (out[comp] = out[comp] || {});
    for (const [pid, v] of Object.entries(m)) if (v > (o[pid] || 0)) o[pid] = v;
  }
  return out;
}
