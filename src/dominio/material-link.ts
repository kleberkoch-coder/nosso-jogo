/* Material do grupo (KAN-190): o pedaço que o link do jogador usa (o lembrete de quem guarda material). O resto da
   regra fica em material.ts, que só a gestão baixa (KAN-274). */
export type Item = { id: string; nome: string; com: string | null };

/* Itens válidos (o que veio do banco pode estar faltando campo). */
export const itens = (mat: unknown): Item[] =>
  Array.isArray(mat)
    ? (mat as Item[]).filter(x => x && typeof x.id === 'string' && typeof x.nome === 'string' && x.nome.trim())
    : [];

/* O que está com uma pessoa: [["Bola", 1], ["Coletes", 1]]. */
export function comPessoa(mat: unknown, pid: string | null | undefined): [string, number][] {
  if (!pid) return [];
  const c = new Map<string, number>();
  itens(mat)
    .filter(x => x.com === pid)
    .forEach(x => c.set(x.nome.trim(), (c.get(x.nome.trim()) || 0) + 1));
  return [...c];
}
