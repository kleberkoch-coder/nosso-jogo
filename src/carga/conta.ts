/* Conta de quem usa o app (KAN-225, saiu de rotas.js): região, último acesso, país da conta e a lista "Meus grupos". */
import { definirRegiao } from '../i18n/formatos.js';
import { regiaoDe } from '../dominio/regiao.ts';
import * as banco from '../nucleo/backend.js';
import { carregarAdmin } from '../nucleo/carga-admin.js';
import { S } from '../nucleo/estado';
import { cl } from '../nucleo/util.js';
// O banco é JavaScript sem tipos e é trocado ao iniciar (setB): lido na hora.
const bk = (): any => (banco as any).B;

/* Datas, números, moeda e relógio do grupo aberto; fora de um grupo, os da conta (KAN-162). */
export const aplicarRegiao = (c: Parameters<typeof regiaoDe>[0]) => definirRegiao(regiaoDe(c));

/* Último acesso da conta (KAN-116): no máximo uma vez por dia por aparelho, sem atrasar a abertura.
   Na primeira vez, grava também a data de registro e o e-mail (vistos na área administrativa do portal). */
export function registrarAcesso() {
  const u = S.user;
  if (!u || u.anon) return;
  const k = 'nj-acesso-' + u.uid,
    hoje = new Date().toDateString();
  try {
    if (localStorage.getItem(k) === hoje) return;
    localStorage.setItem(k, hoje);
  } catch (e) {}
  bk()
    .get('contas/' + u.uid)
    .catch(() => null)
    .then((c: { criada?: number } | null) => {
      const agora = Date.now(),
        o: Record<string, unknown> = { acesso: agora };
      if (u.email) o.email = u.email;
      if (!c || !c.criada) o.criada = agora;
      return bk().patch('contas/' + u.uid, o);
    })
    .catch((e: unknown) => console.warn('acesso', e));
}
/* País da conta (KAN-162): o escolhido ao criar a conta; quem ainda não tem (conta antiga, ou entrou pelo Google na aba
   Entrar) recebe o sugerido pelo aparelho. Grava uma vez só; depois a pessoa troca em "Meus grupos" → País. */
export function gravarPaisConta() {
  const u = S.user,
    n = S.route.n;
  if (!u || u.anon || !S.me || S.me.pais || S.paisGravando || n === 'r' || n === 'v' || n === 'a') return;
  S.paisGravando = true;
  // A tabela de países vem com a gestão (quem tem conta já baixa a gestão; o link do jogador não).
  carregarAdmin()
    .then((A: { contaRegiao: (p?: string) => Record<string, unknown> }) => {
      const o = A.contaRegiao(S.paisNovo);
      Object.assign(S.me as object, o);
      if (!S.gid) aplicarRegiao(o);
      return bk().patch('usuarios/' + u.uid, o);
    })
    .catch((e: unknown) => console.warn('pais', e))
    .finally(() => {
      S.paisGravando = false;
    });
}
export function upMyGroup(gid: string, patch: Record<string, unknown>) {
  const me = cl(S.me) || { grupos: {} };
  me.grupos = me.grupos || {};
  me.grupos[gid] = Object.assign({}, me.grupos[gid] || {}, patch);
  S.me = me;
  return bk().set('usuarios/' + (S.user as { uid: string }).uid, me);
}
/* O nome, o esporte e a situação do grupo em "Meus grupos" acompanham o grupo. */
export function syncName() {
  const g = S.me?.grupos?.[S.gid || ''] as Record<string, unknown> | undefined,
    a = S.app;
  if (S.route.n !== 'admin' || !a || !S.mem || !g) return;
  const want: Record<string, unknown> = {
    name: a.name,
    sport: a.sport || 'futebol',
    sportName: a.sportName || '',
    ativo: a.ativo !== false,
    criado: a.createdAt || null,
    logo: a.logo || null,
  };
  if (Object.keys(want).some(k => (g[k] ?? null) !== (want[k] ?? null)))
    upMyGroup(S.gid as string, want).catch(() => {});
}
