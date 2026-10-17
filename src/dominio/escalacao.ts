/* Escalação de uma partida (KAN-177): empréstimo de outro time, troca no meio do jogo e alguém da lista de presença.
   Decisão do Kleber (17/10): conta para quem esteve em quadra. Quem entrou e quem saiu contam o jogo e o resultado.
   A escalação vale só para a partida; o sorteio da rodada não muda. */
export type Esc = { entrou: string[]; saiu: string[] };
export const escVazia = (): Esc => ({ entrou: [], saiu: [] });

/* Quem jogou (conta no ranking) e quem está em quadra agora (pode marcar gol). */
export function emQuadra(base: string[], e?: Esc | null): { jogaram: string[]; atuais: string[] } {
  const jogaram = [...new Set([...base, ...((e && e.entrou) || [])])],
    sairam = new Set((e && e.saiu) || []);
  return { jogaram, atuais: jogaram.filter(id => !sairam.has(id)) };
}

/* Quem pode entrar num lado: jogadores dos outros times e presentes sem time, sem quem já está nesta partida (dos dois lados). */
export function podemEntrar(
  times: string[][],
  jaNaPartida: string[],
  presentes: string[]
): { deTimes: string[][]; semTime: string[] } {
  const ja = new Set(jaNaPartida),
    emTime = new Set(times.flat());
  return {
    deTimes: times.map(t => t.filter(id => !ja.has(id))),
    semTime: presentes.filter(id => !emTime.has(id) && !ja.has(id)),
  };
}

/* Entra um jogador; se "noLugar" for informado, esse sai (troca). Sem "noLugar", só completa o time. */
export function entrar(e: Esc, quem: string, noLugar?: string | null): Esc {
  return {
    entrou: e.entrou.includes(quem) ? e.entrou : e.entrou.concat(quem),
    saiu: (noLugar && !e.saiu.includes(noLugar) ? e.saiu.concat(noLugar) : e.saiu).filter(id => id !== quem),
  };
}

/* Desfaz: quem entrou por engano sai da escalação; quem saiu volta. */
export function desfazer(e: Esc, id: string): Esc {
  return { entrou: e.entrou.filter(x => x !== id), saiu: e.saiu.filter(x => x !== id) };
}
