/* Quem participa da votação (KAN-230): vota e pode ser votado. O padrão do grupo fica em cfg.votPart e cada votação
   pode mudar só para ela. A lista de quem participa é calculada na gestão (que conhece o tipo de cada jogador, que é
   privado) e gravada na votação (quem); o link do jogador só lê a lista. Regra pura, com teste. */
export type Participa = { mensalista: boolean; diarista: boolean; avulso: boolean; fora: boolean };
export type Tipo = 'mensalista' | 'diarista' | 'avulso';

/* Sem configuração, como sempre foi: todos os tipos, só quem está nos times. */
export const PADRAO: Participa = { mensalista: true, diarista: true, avulso: true, fora: false };

export function lerParticipa(x: unknown): Participa {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>,
    p = { ...PADRAO };
  (Object.keys(PADRAO) as (keyof Participa)[]).forEach(k => {
    if (typeof o[k] === 'boolean') p[k] = o[k] as boolean;
  });
  return p;
}
export const ehPadrao = (p: Participa) => (Object.keys(PADRAO) as (keyof Participa)[]).every(k => p[k] === PADRAO[k]);

/* Quem participa: os jogadores dos times (titulares e reservas) e, com "fora", os confirmados que ficaram fora do
   sorteio (ex.: goleiros fixos); depois, só os tipos marcados. */
export function quemParticipa(
  times: { players: string[] }[] | null | undefined,
  confirmados: string[],
  tipoDe: (id: string) => Tipo,
  p: Participa
): string[] {
  const nos = [...new Set((times || []).flatMap(t => t.players))],
    fora = p.fora ? confirmados.filter(id => !nos.includes(id)) : [];
  return [...nos, ...[...new Set(fora)]].filter(id => p[tipoDe(id)]);
}
