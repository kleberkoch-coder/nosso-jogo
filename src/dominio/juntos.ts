/* Quem mais joga junto (KAN-200): quantas vezes cada par ficou no mesmo time nas rodadas com times sorteados.
   Rodadas da mais nova para a mais antiga; no empate, vem primeiro o par que jogou junto mais recentemente.
   Regra pura, testada em testes/regras/juntos.test.mjs. (O sorteio continua usando o histórico com peso, em sorteio.js.) */
export type RodadaComTimes = { times?: { players: string[] }[] | null };
export type Par = { a: string; b: string; n: number };

export function vezesJuntos(rodadas: RodadaComTimes[]): Par[] {
  const pares = new Map<string, Par & { ult: number }>();
  rodadas.forEach((r, i) =>
    (r.times || []).forEach(t => {
      const p = [...new Set(t.players)].sort();
      for (let x = 0; x < p.length; x++)
        for (let y = x + 1; y < p.length; y++) {
          const k = p[x] + '|' + p[y],
            atual = pares.get(k);
          if (atual) atual.n++;
          else pares.set(k, { a: p[x], b: p[y], n: 1, ult: i });
        }
    })
  );
  return [...pares.values()].sort((x, y) => y.n - x.n || x.ult - y.ult).map(({ a, b, n }) => ({ a, b, n }));
}

/* Quantas rodadas entraram na conta (as que têm times). */
export const rodadasComTimes = (rodadas: RodadaComTimes[]) => rodadas.filter(r => (r.times || []).length).length;
