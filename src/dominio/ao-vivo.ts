/* KAN-236 (pelada-v103): a partida em andamento fica guardada no aparelho de quem marca. Recarregar a página, o
   celular fechar o app em segundo plano ou a aba recarregar sozinha não apaga mais o placar: os gols (com autores),
   os times em quadra, a escalação e o cronômetro voltam como estavam. Só neste aparelho; nada vai ao banco até
   "Encerrar e salvar partida". Regra pura (o que guardar e quando vale voltar), testada em
   testes/regras/ao-vivo.test.mjs; quem lê e grava o aparelho é telas/Partida.tsx. */
type Times = { players: string[] }[] | null | undefined;
export type AoVivoGuardado = {
  rid: string;
  a: number;
  b: number;
  goals: unknown[];
  el?: number;
  run?: boolean;
  [k: string]: unknown;
};

export const chaveAoVivo = (gid: string) => 'nj-ao-vivo:' + gid;
/* Os times da rodada: se o sorteio mudar, a partida guardada não vale mais. */
const assinatura = (times: Times) => JSON.stringify((times || []).map(t => t.players));

export const paraGuardar = (live: AoVivoGuardado | null, times: Times) =>
  live ? JSON.stringify(Object.assign({}, live, { sig: assinatura(times) })) : null;

/* Volta só a partida desta rodada, com os mesmos times, que já tinha começado (gol, tempo ou cronômetro andando). */
export function paraVoltar(texto: string | null, rid: string, times: Times): AoVivoGuardado | null {
  let o: (AoVivoGuardado & { sig?: string }) | null = null;
  try {
    o = texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
  const n = (times || []).length;
  if (!o || typeof o !== 'object' || o.rid !== rid || o.sig !== assinatura(times)) return null;
  if (!(o.a >= 0 && o.a < n && o.b >= 0 && o.b < n) || !Array.isArray(o.goals)) return null;
  if (!o.goals.length && !o.el && !o.run) return null;
  delete o.sig;
  return o;
}
