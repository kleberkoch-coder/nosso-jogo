/* Votação rápida (KAN-254, pelada-v102; decisões do Kleber de 09/11): o celular (ou computador) do administrador
   passa de mão em mão. Cada pessoa escolhe o próprio nome, vota e confirma; a tela limpa para o próximo.
   Regra pura, testada em testes/regras/votacao-rapida.test.mjs.
   - O voto fica em votos/r_{jogador} (o link continua um voto por aparelho, em votos/{aparelho}).
   - Já votou (pelo link ou na votação rápida): aparece com ✓ e pode votar de novo; o voto novo substitui o antigo,
     e os votos dessa pessoa pelo link saem no mesmo lote. */
import { ehRoda } from './votacao-contagem.ts';

type Doc = { pid?: string; v?: Record<string, string>; t?: number; n?: number } | null | undefined;

export const chaveRoda = (pid: string) => 'r_' + pid;

/* Quem já votou: tem ao menos uma escolha gravada, pelo link ou na votação rápida. */
export function jaVotaram(votos: Record<string, Doc>): Set<string> {
  const s = new Set<string>();
  for (const d of Object.values(votos || {})) if (d && d.pid && Object.values(d.v || {}).some(Boolean)) s.add(d.pid);
  return s;
}

/* Quem vota: a lista da votação (KAN-230) ou quem jogou a rodada, sem repetir, em ordem alfabética. */
export function quemVota(
  quem: string[] | null | undefined,
  times: { players: string[] }[] | undefined,
  nome: (id: string) => string,
  local = 'pt-BR'
): string[] {
  const ids = quem || (times || []).flatMap(t => t.players);
  return [...new Set(ids)].sort((a, b) => nome(a).localeCompare(nome(b), local));
}

export type Op = { tipo: 'patch' | 'del'; p: string; o?: Record<string, unknown> };
/* O que gravar ao confirmar o voto de pid: o voto em r_{pid} (com a hora do servidor e quantas vezes votou) e a
   saída dos votos dessa pessoa pelo link. Grava campo a campo (a hora do servidor só vale assim): cada categoria da
   votação recebe a escolha ou é apagada, para o voto novo substituir o antigo por inteiro. Sem escolha, nada. */
export function loteVotoRapido(
  base: string,
  votos: Record<string, Doc>,
  pid: string,
  v: Record<string, string>,
  t: number,
  cats: string[],
  op: { agora: () => unknown; apagar: () => unknown }
): Op[] | null {
  const escolhas = Object.entries(v || {}).filter(([, p]) => !!p);
  if (!escolhas.length) return null;
  const k = chaveRoda(pid),
    antes = (votos || {})[k];
  const o: Record<string, unknown> = { pid, t, o: 'r', n: ((antes && antes.n) || 0) + 1, em: op.agora() };
  for (const c of new Set([...cats, ...Object.keys((antes && antes.v) || {})])) o['v.' + c] = op.apagar();
  for (const [c, p] of escolhas) o['v.' + c] = p;
  const ops: Op[] = [{ tipo: 'patch', p: base + k, o }];
  for (const [u, d] of Object.entries(votos || {}))
    if (!ehRoda(u) && d && d.pid === pid) ops.push({ tipo: 'del', p: base + u });
  return ops;
}
