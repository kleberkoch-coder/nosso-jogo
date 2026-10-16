/* Como o app mostra datas, números e dinheiro de um grupo (KAN-162). Não usa a tabela de países (dominio/paises.ts):
   o grupo já guarda o formato junto com o país, então o link do jogador não precisa baixar a lista.
   Sem país (grupo antigo): Brasil, Real e o relógio do aparelho, como antes. Testada em testes/regras/paises.test.mjs. */
export type RegiaoCfg = { pais?: string; moeda?: string; fuso?: string; formato?: string } | null | undefined;

export function regiaoDe(cfg: RegiaoCfg) {
  const c = cfg || {},
    tem = !!c.pais;
  return {
    pais: c.pais || 'BR',
    formato: (tem && c.formato) || 'pt-BR',
    moeda: c.moeda || 'BRL',
    fuso: (tem && c.fuso) || '',
  };
}
