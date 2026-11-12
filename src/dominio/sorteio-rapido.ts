/* Sorteio rápido, sem conta (KAN-245, pelada-v114). Regra pura: recebe os nomes (com posição e nota opcionais) e devolve
   os times, com o mesmo sorteio equilibrado do app (dominio/sorteio-regra.ts). Nada é gravado: tudo fica no aparelho.
   Teste em testes/regras/sorteio-rapido.test.mjs.
   - Quantos times: o que cabe com times completos (sugerirTimes), como na aba Rodada. Duplas: um time a cada 2.
   - Menos gente que 2 times completos: diz quantos faltam e não sorteia.
   - Excedente de um time vira reserva: quem está mais embaixo na lista (a ordem de chegada), menos o goleiro. */
import { sortear } from './sorteio-regra.ts';
import { sugerirTimes } from './times.ts';

export type JogadorRapido = { nome: string; pos?: string; nota?: number };
export type TimeRapido = { players: number[]; res: number[] };
export type Resultado = { faltam: number; times?: undefined } | { faltam: 0; times: TimeRapido[] };
export type OpcoesRapido = {
  porTime: number;
  duplas: boolean;
  posicoes: string[];
  chave?: string | null;
  aleatorio?: () => number;
};

/* Quantos faltam para dois times completos (duplas: 4 pessoas). */
export function faltamPara(total: number, porTime: number, duplas: boolean): number {
  const precisa = duplas ? 4 : 2 * Math.max(1, porTime);
  return Math.max(0, precisa - total);
}

export function sortearRapido(js: JogadorRapido[], o: OpcoesRapido): Resultado {
  const total = js.length,
    pt = o.duplas ? 2 : Math.max(1, o.porTime);
  const faltam = faltamPara(total, pt, o.duplas);
  if (faltam) return { faltam };
  const n = o.duplas ? Math.floor(total / 2) : sugerirTimes(total, pt);
  const ids = js.map((_, i) => String(i));
  const T = sortear(ids, n, {
    nota: id => {
      const v = js[+id]!.nota;
      return v != null && v >= 1 && v <= 10 ? v : 5;
    },
    pos: id => js[+id]!.pos || undefined,
    posicoes: o.posicoes,
    chave: o.chave || null,
    aleatorio: o.aleatorio,
  });
  /* Quem passa do tamanho do time fica de reserva: o mais embaixo na lista. O goleiro (a posição-chave) só fica de
     reserva se não houver outro, porque as listas costumam trazer os goleiros no fim. */
  const chave = (p: number) => (o.chave && js[p]!.pos === o.chave ? 1 : 0);
  const times = T.map(t => {
    const players = t.map(Number),
      extra = players.length - pt,
      res =
        extra > 0
          ? players
              .slice()
              .sort((a, b) => chave(a) - chave(b) || b - a)
              .slice(0, extra)
          : [];
    return { players, res };
  });
  return { faltam: 0, times };
}

/* Texto do WhatsApp: só nomes e times (nunca as notas). */
export function textoRapido(
  times: TimeRapido[],
  js: JogadorRapido[],
  t: { titulo: string; time: (i: number) => string; reserva: string; rodape: string }
): string {
  const linhas = [t.titulo, ''];
  times.forEach((tm, i) => {
    const res = new Set(tm.res);
    linhas.push('*' + t.time(i) + '*');
    tm.players.filter(p => !res.has(p)).forEach(p => linhas.push('• ' + js[p]!.nome));
    tm.res.forEach(p => linhas.push('• ' + js[p]!.nome + ' (' + t.reserva + ')'));
    linhas.push('');
  });
  linhas.push(t.rodape);
  return linhas.join('\n');
}
