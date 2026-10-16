/* Regras do caixa (KAN-135): pendências do mês e totais. TypeScript puro, sem ler o estado do app,
   para ter teste próprio (testes/regras/caixa.test.mjs). A tela (src/telas/Caixa.tsx) só junta os dados e desenha. */

export type Lancamento = {
  k: string;
  pid?: string | null;
  v: number | string;
  d?: string;
  ref?: string;
  note?: string;
};
export type Tipo = 'mensalista' | 'diarista' | 'avulso';
export type RodadaDoMes = { id: string; date: string; times?: { players: string[] }[] | null };
export type Pendencia = { pid: string; k: 'mensal' | 'diaria'; ref: string; v: number; data?: string };

const num = (v: unknown) => +(v as number) || 0;

/* Quem deve no mês:
   - mensalidade: todo jogador do elenco que não é diarista e ainda não tem lançamento de mensalidade com referência no mês;
   - diária: em cada rodada do mês com times sorteados, quem jogou e não é mensalista (diarista ou avulso)
     e ainda não tem lançamento de diária daquela rodada. */
export function pendenciasDoMes(p: {
  mes: string;
  lancamentos: Lancamento[];
  elenco: string[];
  tipo: (id: string) => Tipo;
  rodadas: RodadaDoMes[];
  valores: { mensal: number; diaria: number };
}): Pendencia[] {
  const { mes, lancamentos: lan, elenco, tipo, rodadas, valores } = p;
  const pago = (k: string, pid: string, ref: string) => lan.some(l => l.k === k && l.pid === pid && l.ref === ref);
  const mens: Pendencia[] = elenco
    .filter(id => tipo(id) !== 'diarista' && !pago('mensal', id, mes))
    .map(pid => ({ pid, k: 'mensal', ref: mes, v: valores.mensal }));
  const dia: Pendencia[] = [];
  rodadas
    .filter(r => r.times)
    .forEach(r =>
      r.times!.forEach(t =>
        t.players.forEach(pid => {
          if (tipo(pid) !== 'mensalista' && !pago('diaria', pid, r.id))
            dia.push({ pid, k: 'diaria', ref: r.id, v: valores.diaria, data: r.date });
        })
      )
    );
  return mens.concat(dia);
}

/* Saldo de todos os lançamentos; entradas e saídas só do mês; lançamentos do mês do mais novo para o mais antigo. */
export function resumoDoCaixa<L extends Lancamento>(lancamentos: L[], mes: string) {
  const doMes = lancamentos
    .filter(l => (l.d || '').slice(0, 7) === mes)
    .sort((a, b) => (b.d || '').localeCompare(a.d || ''));
  const sinal = (l: Lancamento) => (l.k === 'despesa' ? -1 : 1) * num(l.v);
  return {
    saldo: lancamentos.reduce((s, l) => s + sinal(l), 0),
    entradas: doMes.filter(l => l.k !== 'despesa').reduce((s, l) => s + num(l.v), 0),
    saidas: doMes.filter(l => l.k === 'despesa').reduce((s, l) => s + num(l.v), 0),
    doMes,
  };
}

/* Meses do seletor: o mês atual, os meses com lançamento e os meses com rodada, do mais novo para o mais antigo. */
export function mesesDoCaixa(hoje: string, lancamentos: Lancamento[], datasRodadas: string[]): string[] {
  return [
    ...new Set(
      [
        hoje.slice(0, 7),
        ...lancamentos.map(l => (l.d || '').slice(0, 7)),
        ...datasRodadas.map(d => (d || '').slice(0, 7)),
      ].filter(Boolean)
    ),
  ]
    .sort()
    .reverse();
}
