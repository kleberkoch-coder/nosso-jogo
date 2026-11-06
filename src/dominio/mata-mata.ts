/* Mata-mata do campeonato da rodada (KAN-233, pelada-v97): a chave sai da classificação de todos contra todos,
   e cada jogo é achado nas partidas salvas pelo par de times (como na fase de todos contra todos). Regra pura.
   Decisões do Kleber (05/11/2026): empate no mata-mata é critério de quem organiza: o app pergunta "Quem passou?"
   e dá para anotar os pênaltis (opcional); jogo único, sem ida e volta. */
import { casar, classificacao, resultados, type Camp, type Dec, type Jogo, type Linha } from './campeonato.ts';

export type Fase = 'o' | 'q' | 's' | 'f' | 't3';
/* Quem joga: um time já definido, ou de onde ele vem (colocação na tabela, vencedor ou perdedor de outro jogo). */
export type Origem = { col: number } | { venc: string } | { perd: string };
export type Slot = {
  id: string; // "o0".."o7", "q0".."q3", "s0", "s1", "t3", "f"
  fase: Fase;
  a: number | null;
  b: number | null;
  oa: Origem;
  ob: Origem;
  res: Jogo | null;
  dec: Dec | null; // empate: quem passou
  venc: number | null;
  perd: number | null;
  falta: boolean; // empatou e ainda falta dizer quem passou
};
export type Chave = {
  grupoAcabou: boolean;
  tabela: Linha[];
  slots: Slot[]; // na ordem dos jogos (3º lugar antes da final)
  proximo: Slot | null;
  campeao: number | null;
  vice: number | null;
  terceiro: number | null;
};

const FASES: Record<number, Fase> = { 16: 'o', 8: 'q', 4: 's', 2: 'f' };

/* Ordem dos classificados na chave: 1º e 2º só se cruzam na final. Com 4: 1×4, 2×3; com 8: 1×8, 4×5, 2×7, 3×6. */
export function semeadura(k: number): number[] {
  let o = [1, 2];
  while (o.length < k) {
    const m = o.length * 2;
    o = o.flatMap(s => [s, m + 1 - s]);
  }
  return o;
}

export function chave(c: Camp, ms: Jogo[]): Chave {
  const usadas = new Set<number>(),
    grupo = resultados(c, ms, usadas),
    grupoAcabou = grupo.every(x => !!x),
    tabela = classificacao(c, ms),
    slots: Slot[] = [],
    porId: Record<string, Slot> = {};
  const time = (o: Origem): number | null => {
    if ('col' in o) return grupoAcabou && tabela[o.col - 1] ? tabela[o.col - 1].t : null;
    const s = porId['venc' in o ? o.venc : o.perd];
    return s ? ('venc' in o ? s.venc : s.perd) : null;
  };
  const jogo = (id: string, fase: Fase, oa: Origem, ob: Origem) => {
    const a = time(oa),
      b = time(ob),
      res = a != null && b != null ? casar(c, ms, usadas, a, b) : null,
      d = c.dec[id],
      dec = d && (d.p === a || d.p === b) ? d : null;
    let venc: number | null = null;
    if (res && a != null && b != null) venc = res.ga > res.gb ? a : res.gb > res.ga ? b : dec ? dec.p : null;
    const s: Slot = {
      id,
      fase,
      a,
      b,
      oa,
      ob,
      res,
      dec: res && res.ga === res.gb ? dec : null,
      venc,
      perd: venc == null ? null : venc === a ? b : a,
      falta: !!res && res.ga === res.gb && !dec,
    };
    porId[id] = s;
    slots.push(s);
    return s;
  };
  const { k, t3 } = c.mm;
  if (k >= 2) {
    /* Primeira fase da chave pela semeadura; as seguintes, vencedor contra vencedor. */
    const sem = semeadura(k);
    let ids: string[] = [];
    for (let i = 0; i < k / 2; i++) {
      const f = FASES[k],
        id = f === 'f' ? 'f' : f + i;
      if (f !== 'f') jogo(id, f, { col: sem[2 * i] }, { col: sem[2 * i + 1] });
      ids.push(id);
    }
    for (let n = k / 2; n > 1; n /= 2) {
      const f = FASES[n],
        prox: string[] = [];
      for (let i = 0; i < n / 2; i++) {
        const id = f === 'f' ? 'f' : f + i;
        /* Antes da final, a disputa de 3º lugar entre os perdedores das semifinais. */
        if (f === 'f' && t3) jogo('t3', 't3', { perd: ids[0] }, { perd: ids[1] });
        jogo(id, f, { venc: ids[2 * i] }, { venc: ids[2 * i + 1] });
        prox.push(id);
      }
      ids = prox;
    }
    if (k === 2) {
      /* Final direta: 1º × 2º; o 3º lugar, se houver, é 3º × 4º da tabela. */
      if (t3) jogo('t3', 't3', { col: 3 }, { col: 4 });
      jogo('f', 'f', { col: 1 }, { col: 2 });
    }
  }
  const f = porId.f,
    t = porId.t3;
  const semMata = k < 2 && grupoAcabou;
  return {
    grupoAcabou,
    tabela,
    slots,
    proximo: grupoAcabou ? slots.find(s => s.a != null && s.b != null && !s.res) || null : null,
    campeao: semMata ? tabela[0].t : f ? f.venc : null,
    vice: semMata ? (tabela[1] ? tabela[1].t : null) : f ? f.perd : null,
    terceiro: semMata ? (tabela[2] ? tabela[2].t : null) : t ? t.venc : null,
  };
}
