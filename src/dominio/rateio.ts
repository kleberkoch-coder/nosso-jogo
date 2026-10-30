/* Rateio (vaquinha) do caixa (KAN-213, decisões do Kleber em 29/10/2026).
   - Um rateio tem nome, participantes e o valor de cada um (em centavos). "Valor total" divide entre os marcados
     (centavos que sobram no primeiro); "Valor por pessoa" repete o valor. O valor de cada um pode ser ajustado.
   - "Recebi" lança uma entrada no Caixa com o jogador e o rateio (rat), no fluxo do mês do pagamento, e soma em pg.
   - Despesa ligada ao rateio (fornecedor, devolução para quem pagou a mais) soma em gasto.
   - Cada rateio escolhe se aparece nas pendências do Caixa (pend). Encerrar guarda a data (fim); quem não pagou fica registrado.
   - KAN-216: pessoa de fora do elenco (convidado do churrasco, quem quer só a camisa) entra só no rateio, com o nome
     (fora: {id: nome}, id começando com "f_"). O pagamento dela é uma entrada sem jogador, com o id em "fora".
   Fica em privado/caixa.rat (só com a permissão de Caixa). Regra pura, testada em testes/regras/rateio.test.mjs. */
export type Rateio = {
  n: string;
  modo: 'total' | 'fixo';
  base: number; // centavos: o total (modo total) ou o valor por pessoa (modo fixo)
  part: Record<string, number>; // pid -> centavos devidos
  pg?: Record<string, number>; // pid -> centavos pagos
  gasto?: number; // centavos de despesas ligadas
  pend?: boolean;
  em?: number;
  fim?: number;
  fora?: Record<string, string>; // id ("f_…") -> nome de quem é de fora do elenco
};
export const eDeFora = (id: string) => id.startsWith('f_');
/* Nome de quem participa: de fora, o do rateio; do elenco, o do jogador (nomeDoElenco). */
export const nomeNoRateio = (r: Pick<Rateio, 'fora'>, id: string, nomeDoElenco: (id: string) => string) =>
  eDeFora(id) ? (r.fora || {})[id] || '?' : nomeDoElenco(id);
/* Nome de quem é de fora: sem espaços sobrando, até 40 letras. Devolve '' se vazio. */
export const limparNome = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 40);
export type Rateios = Record<string, Rateio | null | undefined>;

export function centavos(v: unknown): number {
  return Math.round((+(v as number) || 0) * 100);
}

/* Divide o total entre os participantes; quem tem valor ajustado fica com ele, e o resto se divide entre os outros.
   Centavos que sobram vão para o primeiro dos que dividem. Nunca negativo. */
export function dividirRateio(
  total: number,
  pids: string[],
  ajustados: Record<string, number> = {}
): Record<string, number> {
  const out: Record<string, number> = {},
    livres = pids.filter(p => !(p in ajustados));
  let resto = total;
  for (const p of pids)
    if (p in ajustados) {
      out[p] = Math.max(0, Math.round(ajustados[p]!));
      resto -= out[p]!;
    }
  resto = Math.max(0, resto);
  const n = livres.length,
    cada = n ? Math.floor(resto / n) : 0;
  livres.forEach((p, i) => (out[p] = cada + (i === 0 ? resto - cada * n : 0)));
  return out;
}

/* Valor por pessoa: todos com o mesmo valor, menos os ajustados. */
export function valorFixo(cada: number, pids: string[], ajustados: Record<string, number> = {}) {
  const out: Record<string, number> = {};
  pids.forEach(p => (out[p] = p in ajustados ? Math.max(0, Math.round(ajustados[p]!)) : cada));
  return out;
}

export function soma(o: Record<string, number> | undefined): number {
  let t = 0;
  for (const v of Object.values(o || {})) t += +v || 0;
  return t;
}

/* Situação do rateio: total, quanto entrou, quanto falta, quem pagou e quem falta (com o valor que falta). */
export function situacao(r: Rateio) {
  const pg = r.pg || {},
    total = soma(r.part),
    pagaram: [string, number][] = [],
    faltam: [string, number][] = [];
  Object.entries(r.part || {}).forEach(([pid, dev]) => {
    const pago = pg[pid] || 0;
    if (pago >= dev) pagaram.push([pid, pago]);
    else faltam.push([pid, dev - pago]);
  });
  /* Quem pagou sem estar na lista (saiu do rateio depois) continua contando no que entrou. */
  const entrou = soma(pg),
    falta = faltam.reduce((s, [, v]) => s + v, 0);
  return { total, entrou, falta, gasto: r.gasto || 0, pagaram, faltam };
}

/* Abertos que aparecem nas pendências do Caixa. */
export function pendenciasDeRateio(rs: Rateios): { rid: string; n: string; pid: string; v: number }[] {
  const out: { rid: string; n: string; pid: string; v: number }[] = [];
  for (const [rid, r] of Object.entries(rs || {})) {
    if (!r || r.fim || !r.pend) continue;
    for (const [pid, v] of situacao(r).faltam) out.push({ rid, n: r.n, pid, v });
  }
  return out;
}

/* Confere o que vem da janela. Devolve a chave do erro ou ''. */
export function erroRateio(r: { n?: string; part?: Record<string, number> }): string {
  if (!(r.n || '').trim()) return 'rateio.erroNome';
  if (!Object.keys(r.part || {}).length) return 'rateio.erroParticipantes';
  if (!(soma(r.part) > 0)) return 'rateio.erroValor';
  return '';
}

/* Campos que um lançamento ligado ao rateio muda no rateio (sinal 1 ao lançar, -1 ao apagar). */
export function camposDoRateio(
  l: { k: string; v: number | string; pid?: string | null; rat?: string; fora?: string },
  sinal: 1 | -1
): Record<string, number> | null {
  if (!l.rat) return null;
  const c = centavos(l.v) * sinal;
  if (l.k === 'despesa') return { [`rat.${l.rat}.gasto`]: c };
  const quem = l.pid || (l.fora && eDeFora(l.fora) ? l.fora : '');
  if (quem) return { [`rat.${l.rat}.pg.${quem}`]: c };
  return null;
}
