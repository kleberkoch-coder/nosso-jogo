/* Planos (KAN-115) e área administrativa do portal (KAN-116). Regras puras: não leem o estado do app.
   - O plano é por conta do organizador (decisão de 13/10/2026) e vale para todos os grupos dela.
   - O catálogo fica no Firebase (sistema/planos) e muda sem versão nova; sem ele, valem os planos padrão abaixo.
   - O app pergunta "a conta tem o recurso X?", nunca "é o plano A?". Os limites passam a valer na KAN-119. */

export type Plano = { nome: string; grupos: number | null; admins: number | null; recursos: string[] };
export type Catalogo = Record<string, Plano>;
export type Conta =
  | { plano?: string; planoAte?: number | null; acesso?: number; email?: string; criada?: number; ng?: number }
  | null
  | undefined;

const BASICO = ['presenca', 'sorteio', 'placar', 'rankingMes'];
const PLANO_A = BASICO.concat(['caixa', 'votacao', 'rankingAnual', 'historico', 'listaEspera', 'cobrarPendentes']);
export const PLANOS_PADRAO: Catalogo = {
  gratis: { nome: 'Grátis', grupos: 1, admins: 1, recursos: BASICO },
  A: { nome: 'Plano A', grupos: 3, admins: 2, recursos: PLANO_A },
  B: { nome: 'Plano B', grupos: null, admins: 5, recursos: PLANO_A.concat(['iaCards', 'iaRelatorios', 'painelCaixa']) },
};

/* Quem administra o portal: decidido só nas regras do Firebase (adminPortal(), lista de identificadores de contas Google).
   O portal fica num site separado (src/portal/) e não tem nenhum botão no app dos clientes. */

const limiteOk = (v: unknown) => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0);
function planoValido(p: any): p is Plano {
  return (
    !!p &&
    typeof p.nome === 'string' &&
    limiteOk(p.grupos) &&
    limiteOk(p.admins) &&
    Array.isArray(p.recursos) &&
    p.recursos.every((r: unknown) => typeof r === 'string')
  );
}
/* Catálogo vindo do Firebase ({planos: {id: Plano}}). Planos inválidos são ignorados; o Grátis sempre existe. */
export function catalogo(doc: { planos?: Record<string, unknown> } | null | undefined): Catalogo {
  const c: Catalogo = {};
  Object.entries((doc && doc.planos) || {}).forEach(([id, p]) => {
    if (planoValido(p)) c[id] = p;
  });
  if (!Object.keys(c).length) return PLANOS_PADRAO;
  if (!c.gratis) c.gratis = PLANOS_PADRAO.gratis;
  return c;
}

/* Plano em vigor de uma conta: sem plano gravado, plano que não existe no catálogo ou com validade vencida → Grátis. */
export function planoDaConta(conta: Conta, cat: Catalogo, agora: number) {
  const id = conta && conta.plano && cat[conta.plano] ? conta.plano : 'gratis';
  const ate = conta && typeof conta.planoAte === 'number' ? conta.planoAte : null;
  const vencido = id !== 'gratis' && ate !== null && ate < agora;
  const efetivo = vencido ? 'gratis' : id;
  return {
    id: efetivo,
    plano: cat[efetivo] || PLANOS_PADRAO.gratis,
    ate: vencido ? null : ate,
    vencido,
    contratado: id,
  };
}
export const temRecurso = (p: { plano: Plano }, r: string) => p.plano.recursos.includes(r);

/* ---------- Área administrativa (KAN-116) ---------- */
export type Grupo = { owner?: string; name?: string; ativo?: boolean; createdAt?: number };
export type Cliente = {
  uid: string;
  email: string;
  plano: string;
  planoNome: string;
  ate: number | null;
  vencido: boolean;
  gruposAtivos: number;
  gruposInativos: number;
  nomesGrupos: string[];
  acesso: number | null;
  criada: number | null;
  ultimaRodada: string | null;
};
const DIA = 864e5;

/* Junta as fichas de conta, os grupos (pelo dono) e a última rodada gravada de cada grupo numa lista de clientes. */
export function montarClientes(
  contas: Record<string, Conta>,
  grupos: Record<string, Grupo>,
  emails: Record<string, string>,
  ultimaRodada: Record<string, string | null>,
  cat: Catalogo,
  agora: number
): Cliente[] {
  const uids = new Set(Object.keys(contas));
  Object.values(grupos).forEach(g => {
    if (g && g.owner) uids.add(g.owner);
  });
  return [...uids]
    .map(uid => {
      const c = contas[uid] || null,
        p = planoDaConta(c, cat, agora);
      const meus = Object.entries(grupos).filter(([, g]) => g && g.owner === uid);
      const datas = meus
        .map(([gid]) => ultimaRodada[gid])
        .filter((d): d is string => !!d)
        .sort();
      return {
        uid,
        email: (c && c.email) || emails[uid] || '',
        plano: p.id,
        planoNome: p.plano.nome,
        ate: p.ate,
        vencido: p.vencido,
        gruposAtivos: meus.filter(([, g]) => g.ativo !== false).length,
        gruposInativos: meus.filter(([, g]) => g.ativo === false).length,
        nomesGrupos: meus.map(([, g]) => g.name || 'Grupo'),
        acesso: (c && c.acesso) || null,
        criada: (c && c.criada) || null,
        ultimaRodada: datas.length ? datas[datas.length - 1] : null,
      };
    })
    .sort((a, b) => (b.acesso || 0) - (a.acesso || 0) || a.email.localeCompare(b.email));
}

export type Filtro = 'todos' | 'semAcesso30' | 'vence7' | `plano:${string}`;
export function filtrarClientes(cs: Cliente[], filtro: Filtro, busca: string, agora: number): Cliente[] {
  const q = (busca || '').trim().toLowerCase();
  return cs.filter(c => {
    if (q && !c.email.toLowerCase().includes(q) && !c.nomesGrupos.some(n => n.toLowerCase().includes(q))) return false;
    if (filtro === 'semAcesso30') return !c.acesso || agora - c.acesso > 30 * DIA;
    if (filtro === 'vence7') return c.ate !== null && c.ate >= agora && c.ate - agora <= 7 * DIA;
    if (filtro.startsWith('plano:')) return c.plano === filtro.slice(6);
    return true;
  });
}
export function resumoPorPlano(cs: Cliente[]): Record<string, number> {
  const r: Record<string, number> = {};
  cs.forEach(c => {
    r[c.plano] = (r[c.plano] || 0) + 1;
  });
  return r;
}
