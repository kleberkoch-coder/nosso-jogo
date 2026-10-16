/* Ordem da lista da aba Jogadores (KAN-168): nome, posição, nota, tipo ou mais recentes.
   Vale só para a aba Jogadores; a lista de presença da Rodada segue a ordem de confirmação (KAN-78).
   Empate fica em ordem alfabética. Regra pura: testada em testes/regras/ordem-jogadores.test.mjs. */
export type Ordem = 'nome' | 'posicao' | 'nota' | 'tipo' | 'recentes';
export const ORDENS: Ordem[] = ['nome', 'posicao', 'nota', 'tipo', 'recentes'];

export type ItemOrdem = { id: string; nome: string; pos?: string; nota: number; tipo: string; criado?: number };
export type ContextoOrdem = { posicoes: string[]; local: string }; // posicoes: siglas na ordem do esporte

export function ordenarJogadores<T extends ItemOrdem>(lista: T[], ordem: Ordem, ctx: ContextoOrdem): T[] {
  const porNome = (a: T, b: T) => a.nome.localeCompare(b.nome, ctx.local);
  const idx = (p?: string) => {
    const i = p ? ctx.posicoes.indexOf(p) : -1;
    return i < 0 ? 999 : i;
  };
  const criterio: Record<Ordem, (a: T, b: T) => number> = {
    nome: () => 0,
    posicao: (a, b) => idx(a.pos) - idx(b.pos),
    nota: (a, b) => b.nota - a.nota,
    tipo: (a, b) => (a.tipo === 'diarista' ? 1 : 0) - (b.tipo === 'diarista' ? 1 : 0),
    recentes: (a, b) => (b.criado || 0) - (a.criado || 0),
  };
  const c = criterio[ordem] || criterio.nome;
  return lista.slice().sort((a, b) => c(a, b) || porNome(a, b));
}

/* Ordem guardada: sem posição no esporte, "posicao" volta para "nome". */
export function ordemValida(v: string | null | undefined, temPosicao: boolean): Ordem {
  const o = (ORDENS as string[]).includes(v || '') ? (v as Ordem) : 'nome';
  return o === 'posicao' && !temPosicao ? 'nome' : o;
}
