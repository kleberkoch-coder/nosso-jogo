/* Totais prontos por mês (decisão D11, KAN-87) — uma das 5 regras da D12 (ranking).
   Regra pura: não lê o estado do app nem o banco, por isso tem teste próprio em testes/regras/ranking.test.mjs.

   Ficha grupos/{gid}/resumos/{AAAA-MM}:
     mes                       'AAAA-MM'
     jog.{pid}.{j,v,e,d,g,mvp,bagre}   jogos, vitórias, empates, derrotas, gols/pontos, destaques e bagres
     jogos.{idPartida}         {rid, date, ca, cb, ga, gb}  (placar, para o histórico do ranking)
     cx.{ent,sai}              entradas e saídas do caixa no mês, em centavos (soma sem erro de arredondamento)

   Salvar ou apagar uma partida, um lançamento ou encerrar/reabrir uma votação gera "campos" (somar, gravar, apagar)
   que o app manda junto com a gravação. O mesmo cálculo refaz tudo do zero no botão Recalcular. */

export type Gol = { t: 'a' | 'b'; pid?: string | null; og?: boolean; pts?: number };
export type Partida = {
  id: string;
  /* 'art' = artilharia da rodada (KAN-178): só gols por jogador, sem placar nem resultado. */
  tipo?: 'art';
  gols?: Record<string, number>;
  ca: number;
  cb: number;
  /* Posição dos times na rodada (v60): o nome é "Time 1", "Time 2"; a cor é só o colete. */
  ta?: number;
  tb?: number;
  pa: string[];
  pb: string[];
  ga: number;
  gb: number;
  goals?: Gol[];
  at?: number;
};
export type PartidaComData = Partida & { rid: string; date: string };
export type Lancamento = { k: string; v: number | string; d?: string };
export type Votacao = {
  open?: boolean;
  cats?: { id: string; neg?: boolean }[];
  resultado?: Record<string, { winners?: string[] }> | null;
  rdate?: string;
  createdAt?: number;
};
export type Campos = { mes: string; somar: Record<string, number>; gravar: Record<string, unknown>; apagar: string[] };
export type JogStats = { j?: number; v?: number; e?: number; d?: number; g?: number; mvp?: number; bagre?: number };
export type Resumo = {
  mes: string;
  jog: Record<string, JogStats>;
  jogos: Record<
    string,
    { rid: string; date: string; ca: number; cb: number; ta?: number; tb?: number; ga: number; gb: number; at?: number }
  >;
  cx: { ent?: number; sai?: number };
};

export const mesDe = (data?: string | null): string => String(data || '').slice(0, 7);

function novo(mes: string): Campos {
  return { mes, somar: {}, gravar: {}, apagar: [] };
}
function soma(c: Campos, chave: string, n: number) {
  if (n) c.somar[chave] = (c.somar[chave] || 0) + n;
}

/* Partida salva (sinal 1) ou apagada (sinal -1). */
export function camposPartida(m: Partida, rid: string, date: string, sinal: 1 | -1): Campos {
  if (m.tipo === 'art') return camposArtilharia(m, date, sinal);
  const c = novo(mesDe(date)),
    res = m.ga > m.gb ? 'a' : m.ga < m.gb ? 'b' : 'e';
  const lado = (ids: string[], meu: 'a' | 'b') =>
    ids.forEach(id => {
      soma(c, `jog.${id}.j`, sinal);
      soma(c, `jog.${id}.${res === 'e' ? 'e' : res === meu ? 'v' : 'd'}`, sinal);
    });
  lado(m.pa || [], 'a');
  lado(m.pb || [], 'b');
  (m.goals || []).forEach(g => {
    if (g.pid && !g.og) soma(c, `jog.${g.pid}.g`, (g.pts || 1) * sinal);
  });
  if (sinal > 0)
    c.gravar[`jogos.${m.id}`] = Object.assign(
      { rid, date, ca: m.ca, cb: m.cb, ga: m.ga, gb: m.gb, at: m.at || 0 },
      m.ta != null ? { ta: m.ta, tb: m.tb } : {}
    );
  else c.apagar.push(`jogos.${m.id}`);
  return c;
}

/* Artilharia da rodada (KAN-178): soma só os gols de cada jogador. Não conta jogo nem resultado (decisão do Kleber). */
export function camposArtilharia(m: Partida, date: string, sinal: 1 | -1): Campos {
  const c = novo(mesDe(date));
  Object.entries(m.gols || {}).forEach(([pid, n]) => soma(c, `jog.${pid}.g`, (+n || 0) * sinal));
  return c;
}

/* Partida editada depois de salva (KAN-176): desconta a versão antiga e soma a nova numa gravação só.
   O placar da lista (jogos.{id}) é regravado com o placar novo. Se a data mudar de mês (não acontece hoje), vira dois ajustes. */
export function camposEdicao(antes: Partida, depois: Partida, rid: string, date: string): Campos[] {
  const a = camposPartida(antes, rid, date, -1),
    d = camposPartida(depois, rid, date, 1);
  if (a.mes !== d.mes) return [a, d];
  Object.entries(d.somar).forEach(([k, n]) => soma(a, k, n));
  Object.keys(a.somar).forEach(k => {
    if (!a.somar[k]) delete a.somar[k];
  });
  a.apagar = a.apagar.filter(k => !(k in d.gravar));
  Object.assign(a.gravar, d.gravar);
  return [a];
}

/* Lançamento do caixa criado (1) ou apagado (-1). Despesa é saída; o resto é entrada. */
export function camposLancamento(l: Lancamento, sinal: 1 | -1): Campos {
  const c = novo(mesDe(l.d));
  soma(c, l.k === 'despesa' ? 'cx.sai' : 'cx.ent', Math.round((+l.v || 0) * 100) * sinal);
  return c;
}

/* Mês em que a votação conta: o da rodada; sem rodada, o de criação. */
export function mesDaVotacao(v: Votacao): string {
  if (v.rdate) return mesDe(v.rdate);
  const d = new Date(v.createdAt || Date.now());
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/* Votação encerrada (1) ou reaberta/apagada depois de encerrada (-1): destaques e bagres. */
export function camposVotacao(v: Votacao, sinal: 1 | -1): Campos {
  const c = novo(mesDaVotacao(v));
  if (!v.resultado) return c;
  (v.cats || []).forEach(cat =>
    ((v.resultado as Record<string, { winners?: string[] }>)[cat.id]?.winners || []).forEach(id =>
      soma(c, `jog.${id}.${cat.neg ? 'bagre' : 'mvp'}`, sinal)
    )
  );
  return c;
}

export function vazio(mes: string): Resumo {
  return { mes, jog: {}, jogos: {}, cx: {} };
}

/* Aplica os campos numa ficha em memória (Recalcular, modo demonstração e testes). */
export function aplicar(doc: Resumo, c: Campos): Resumo {
  const caminho = (k: string) => k.split('.');
  const pegar = (o: Record<string, unknown>, ps: string[]) => {
    let x = o;
    for (const p of ps) {
      if (typeof x[p] !== 'object' || x[p] === null) x[p] = {};
      x = x[p] as Record<string, unknown>;
    }
    return x;
  };
  Object.entries(c.somar).forEach(([k, n]) => {
    const ps = caminho(k),
      f = ps.pop() as string,
      o = pegar(doc as unknown as Record<string, unknown>, ps);
    o[f] = ((o[f] as number) || 0) + n;
  });
  Object.entries(c.gravar).forEach(([k, v]) => {
    const ps = caminho(k),
      f = ps.pop() as string;
    pegar(doc as unknown as Record<string, unknown>, ps)[f] = v;
  });
  c.apagar.forEach(k => {
    const ps = caminho(k),
      f = ps.pop() as string;
    delete pegar(doc as unknown as Record<string, unknown>, ps)[f];
  });
  return doc;
}

/* Refaz as fichas a partir de tudo (botão Recalcular e primeira abertura depois da atualização). */
export function resumirTudo(
  partidas: PartidaComData[],
  lancamentos: Lancamento[],
  votacoes: Votacao[],
  soMes?: string
): Record<string, Resumo> {
  const out: Record<string, Resumo> = {};
  const usar = (c: Campos) => {
    if (!c.mes || (soMes && c.mes !== soMes)) return;
    aplicar(out[c.mes] || (out[c.mes] = vazio(c.mes)), c);
  };
  partidas.forEach(p => usar(camposPartida(p, p.rid, p.date, 1)));
  lancamentos.forEach(l => usar(camposLancamento(l, 1)));
  votacoes.filter(v => !v.open && v.resultado).forEach(v => usar(camposVotacao(v, 1)));
  if (soMes && !out[soMes]) out[soMes] = vazio(soMes);
  return out;
}

export type Linha = {
  id: string;
  j: number;
  v: number;
  e: number;
  d: number;
  gols: number;
  mvp: number;
  bagre: number;
  pts: number;
  ap: number;
};

/* Ranking somando as fichas do período (ano: até 12; mês: 1). Vitória 3, empate 1. */
export function ranking(docs: Partial<Resumo>[]): Linha[] {
  const s: Record<string, Linha> = {};
  docs.forEach(d =>
    Object.entries(d.jog || {}).forEach(([id, x]) => {
      const l = s[id] || (s[id] = { id, j: 0, v: 0, e: 0, d: 0, gols: 0, mvp: 0, bagre: 0, pts: 0, ap: 0 });
      l.j += x.j || 0;
      l.v += x.v || 0;
      l.e += x.e || 0;
      l.d += x.d || 0;
      l.gols += x.g || 0;
      l.mvp += x.mvp || 0;
      l.bagre += x.bagre || 0;
    })
  );
  return Object.values(s)
    .filter(l => l.j || l.mvp || l.bagre || l.gols)
    .map(l => Object.assign(l, { pts: l.v * 3 + l.e, ap: l.j ? Math.round(((l.v * 3 + l.e) / (l.j * 3)) * 100) : 0 }));
}

/* Placar das partidas do período, rodada mais recente primeiro. */
export function placares(docs: Partial<Resumo>[]) {
  const por: Record<
    string,
    {
      rid: string;
      date: string;
      jogos: { ca: number; cb: number; ta?: number; tb?: number; ga: number; gb: number; id: string; at: number }[];
    }
  > = {};
  docs.forEach(d =>
    Object.entries(d.jogos || {}).forEach(([id, j]) => {
      const r = por[j.rid] || (por[j.rid] = { rid: j.rid, date: j.date, jogos: [] });
      r.jogos.push(
        Object.assign(
          { id, ca: j.ca, cb: j.cb, ga: j.ga, gb: j.gb, at: j.at || 0 },
          j.ta != null ? { ta: j.ta, tb: j.tb } : {}
        )
      );
    })
  );
  const rs = Object.values(por).sort((a, b) => b.date.localeCompare(a.date));
  rs.forEach(r => r.jogos.sort((a, b) => (a.at || 0) - (b.at || 0)));
  return rs;
}

/* Caixa em reais (a ficha guarda centavos). */
export function caixaDoMes(doc?: Partial<Resumo> | null) {
  const cx = (doc && doc.cx) || {};
  return { ent: (cx.ent || 0) / 100, sai: (cx.sai || 0) / 100 };
}
export function saldo(docs: Partial<Resumo>[]) {
  return docs.reduce((s, d) => s + ((d.cx && d.cx.ent) || 0) - ((d.cx && d.cx.sai) || 0), 0) / 100;
}
