/* Permissões dos administradores convidados (KAN-201, decisões do Kleber em 27/10/2026).
   O organizador (dono do grupo) sempre pode tudo. Para cada convidado, ele liga ou desliga:
   - caixa:  ver e lançar no caixa (mensalidade, diária, Pix, tipos, saldo);
   - notas:  ver e mudar as notas e os pares separados. O sorteio continua para todos: as notas chegam ao aparelho
             para equilibrar os times, só não aparecem na tela (decisão do Kleber: "sorteia com notas escondidas");
   - elenco: cadastrar, editar e importar jogadores, ver telefone e e-mail;
   - config: editar o grupo, posições, mínimo e controle de vagas, convidar administradores (remover continua só com o organizador).
   O dia a dia (rodada, presença, sorteio, placar, votação, histórico e ranking) vale para todo administrador.
   Convidado novo começa só com o dia a dia. Quem já era administrador antes (sem permissões gravadas) continua com tudo.
   As regras do Firebase garantem o mesmo (firestore.rules, função pode). Regra pura, testada em testes/regras/permissoes.test.mjs. */
export const PERMISSOES = ['caixa', 'notas', 'elenco', 'config'] as const;
export type Permissao = (typeof PERMISSOES)[number];
export type Perm = Partial<Record<Permissao, boolean>>;
export type Membro = { role?: string; perm?: Perm | null } | null | undefined;

/* Convidado novo: tudo desligado (só o dia a dia). */
export const PERM_CONVIDADO: Record<Permissao, boolean> = { caixa: false, notas: false, elenco: false, config: false };

export function pode(membro: Membro, k: Permissao): boolean {
  if (!membro) return false;
  if (membro.role === 'owner') return true;
  const p = membro.perm;
  if (p === undefined || p === null) return true; // administrador de antes das permissões: continua com tudo
  return p[k] === true;
}

/* Permissões que vão para o banco: só as quatro chaves, sempre sim ou não. */
export function permLimpa(p: Perm | null | undefined): Record<Permissao, boolean> {
  const o = { ...PERM_CONVIDADO };
  PERMISSOES.forEach(k => {
    o[k] = !!(p && p[k]);
  });
  return o;
}
