/* Regra da votação (destaques da rodada; uma das 5 da D12): candidatos de cada categoria e o voto pelo link.
   A contagem e a auditoria ficam em dominio/votacao-contagem.ts (só a gestão usa; pelada-v102).
   Pura: não lê a memória do app (KAN-220). Testada em testes/regras/votacao.test.mjs.
   - Candidatos: quem jogou a rodada (titulares e reservas) ou, desde a v95, a lista da votação (KAN-230, quem participa);
     categoria com posição, só quem é dessa posição. */
export type Categoria = { id: string; name?: string; pos?: string | null };
export type Votacao = { rid: string; cats: Categoria[]; quem?: string[] | null };
export type Votos = Record<string, { v?: Record<string, string> } | null | undefined>;

/* Quem pode ser votado numa categoria, em ordem alfabética do nome. */
export function candidatos(
  times: { players: string[] }[] | undefined,
  c: Categoria,
  pos: (id: string) => string | undefined,
  nome: (id: string) => string,
  local = 'pt-BR',
  quem?: string[] | null
): string[] {
  /* KAN-230: a votação pode trazer a lista de quem participa (gravada pela gestão); sem ela, quem está nos times. */
  if (!times && !quem) return [];
  let ids = quem || (times || []).flatMap(t => t.players);
  if (c.pos) ids = ids.filter(id => pos(id) === c.pos);
  return ids.sort((a, b) => nome(a).localeCompare(nome(b), local));
}

/* KAN-222: auditoria ("Quem votou"). Uma linha por aparelho que votou, com o nome que a pessoa escolheu, o voto
   final, a hora e as trocas. A hora é a do servidor (última troca gravada); em votação antiga, sem trocas, vale a
   hora do aparelho (t), marcada. O mesmo nome em mais de um aparelho fica marcado (repetido). */
/* KAN-224: no máximo 50 trocas gravadas por aparelho em cada votação (o Firebase recusa a 51ª). */
export const LIMITE_TROCAS = 50;
export type MeuVoto = { pid?: string; v?: Record<string, string>; t?: number; nt?: number };
/* KAN-223/224: o que gravar quando o aparelho toca no nome p da categoria c. Tocar de novo no nome já escolhido
   não grava nada; a primeira escolha ou a troca de nome sobe o contador e gera o registro {aparelho}_{nt}.
   Depois do limite, o voto continua valendo, só sem registro novo na auditoria. */
export function proximoVoto(
  antes: MeuVoto | null | undefined,
  pid: string,
  c: string,
  p: string,
  t: number
): { voto: MeuVoto; troca: number } | null {
  const a = antes || {};
  if ((a.v || {})[c] === p) return null;
  const nt = a.nt || 0,
    troca = nt < LIMITE_TROCAS ? nt + 1 : 0;
  const voto: MeuVoto = { pid, v: Object.assign({}, a.v, { [c]: p }), t };
  if (troca) voto.nt = troca;
  else if (nt) voto.nt = nt;
  return { voto, troca };
}
