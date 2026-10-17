/* Regras do caixa (KAN-135): pendências do mês e totais. TypeScript puro, sem ler o estado do app,
   para ter teste próprio (testes/regras/caixa.test.mjs). A tela (src/telas/Caixa.tsx) só junta os dados e desenha. */

export type Lancamento = {
  k: string;
  pid?: string | null;
  v: number | string;
  d?: string;
  ref?: string;
  refs?: string[];
  note?: string;
};
/* Isento de pagamento (KAN-172): fica no elenco, mas nunca deve mensalidade nem diária. */
export type Tipo = 'mensalista' | 'diarista' | 'isento' | 'avulso';
export type RodadaDoMes = { id: string; date: string; times?: { players: string[] }[] | null };
export type Pendencia = { pid: string; k: 'mensal' | 'diaria'; ref: string; v: number; data?: string };

const num = (v: unknown) => +(v as number) || 0;

/* Quem deve no mês:
   - mensalidade: todo jogador do elenco que não é diarista nem isento e ainda não tem lançamento de mensalidade com referência no mês;
   - diária: em cada rodada do mês com times sorteados, quem jogou e não é mensalista nem isento (diarista ou avulso)
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
    .filter(id => tipo(id) !== 'diarista' && tipo(id) !== 'isento' && !pago('mensal', id, mes))
    .map(pid => ({ pid, k: 'mensal', ref: mes, v: valores.mensal }));
  const dia: Pendencia[] = [];
  rodadas
    .filter(r => r.times)
    .forEach(r =>
      r.times!.forEach(t =>
        t.players.forEach(pid => {
          if (tipo(pid) !== 'mensalista' && tipo(pid) !== 'isento' && !pago('diaria', pid, r.id))
            dia.push({ pid, k: 'diaria', ref: r.id, v: valores.diaria, data: r.date });
        })
      )
    );
  return mens.concat(dia);
}

/* A pagar (KAN-172): quem recebe por jogo tem a receber cada rodada em que jogou (está num time sorteado),
   desde o dia em que passou a receber, até o pagamento. Um pagamento é uma despesa com o jogador (pid)
   e as rodadas pagas (refs). Valor por jogo é o atual; a tela deixa ajustar o total na hora de pagar. */
export type Recebe = { v: number; desde?: string };
export type JogoAPagar = { rid: string; date: string };
export type APagar = { pid: string; v: number; jogos: JogoAPagar[]; total: number };
export function rodadasPagas(lancamentos: Lancamento[], pid: string): Set<string> {
  const s = new Set<string>();
  lancamentos.forEach(l => {
    if (l.k === 'despesa' && l.pid === pid) (l.refs || []).forEach(r => s.add(r));
  });
  return s;
}
export function aPagar(p: {
  lancamentos: Lancamento[];
  recebe: Record<string, Recebe>;
  rodadas: RodadaDoMes[];
}): APagar[] {
  const { lancamentos, recebe, rodadas } = p;
  return Object.entries(recebe)
    .filter(([, r]) => num(r && r.v) > 0)
    .map(([pid, r]) => {
      const pagas = rodadasPagas(lancamentos, pid),
        v = num(r.v);
      const jogos = rodadas
        .filter(
          x =>
            x.times &&
            (!r.desde || (x.date || '') >= r.desde) &&
            !pagas.has(x.id) &&
            x.times.some(t => t.players.includes(pid))
        )
        .map(x => ({ rid: x.id, date: x.date }))
        .sort((a, b) => a.date.localeCompare(b.date));
      return { pid, v, jogos, total: v * jogos.length };
    })
    .filter(x => x.jogos.length > 0);
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
