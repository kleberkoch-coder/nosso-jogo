/* Números públicos do card do jogador (KAN-295, pelada-v129; decisão do Kleber de 23/11/2026). O resumo do mês
   (resumos/{mês}) continua só para administradores: ele guarda o "bagre" e, em grupos antigos, o caixa. Cada gravação
   nele ganha, no mesmo lote, uma cópia só com os números que o card mostra (resumosPub/{mês}), que o link do jogador lê.
   Regra pura, sem tela: recebe as gravações de um lote e devolve o lote com as cópias. */

/* Os números de cada jogador que podem ser públicos: jogos, vitórias, empates, derrotas, gols ou pontos, assistências
   e vezes eleito melhor jogador. Nunca a nota, o bagre, o caixa ou o placar de cada jogo. */
export const NUMEROS_PUBLICOS = ['j', 'v', 'e', 'd', 'g', 'as', 'mvp'];

type Op = { tipo: string; p: string; o?: unknown };
type Obj = Record<string, unknown>;

const MES = /^resumos\/(\d{4}-\d{2})$/;
const ehJogador = (k: string) => /^[A-Za-z0-9_-]{1,64}$/.test(k);

/* Um valor de um resumo inteiro (set): só os números públicos de cada jogador. */
function soPublico(o: Obj, mes: string): Obj {
  const jog: Record<string, Obj> = {};
  for (const [pid, l] of Object.entries((o.jog as Record<string, Obj>) || {})) {
    if (!ehJogador(pid) || !l || typeof l !== 'object') continue;
    const r: Obj = {};
    for (const k of NUMEROS_PUBLICOS) if (typeof l[k] === 'number') r[k] = l[k];
    jog[pid] = r;
  }
  const r: Obj = { mes, jog };
  if (o.at != null) r.at = o.at;
  return r;
}

/* Um ajuste por campo (patch com "jog.{pid}.{campo}"): só os campos públicos. */
function soPublicoPatch(o: Obj, mes: string): Obj | null {
  const r: Obj = { mes };
  let algum = false;
  for (const [k, v] of Object.entries(o)) {
    if (k === 'at') r.at = v;
    const ps = k.split('.');
    if (ps[0] !== 'jog' || !ps[1] || !ehJogador(ps[1])) continue;
    if (ps.length === 2 || (ps.length === 3 && NUMEROS_PUBLICOS.includes(ps[2]!))) {
      r[k] = v;
      algum = true;
    }
  }
  return algum ? r : null;
}

export function espelhoPublico(op: Op): Op | null {
  const m = MES.exec(op.p);
  if (!m || !op.o || typeof op.o !== 'object') return null;
  const mes = m[1]!,
    p = 'resumosPub/' + mes;
  if (op.tipo === 'set') return { tipo: 'set', p, o: soPublico(op.o as Obj, mes) };
  if (op.tipo === 'patch') {
    const o = soPublicoPatch(op.o as Obj, mes);
    return o ? { tipo: 'patch', p, o } : null;
  }
  return null;
}

/* O lote com a cópia pública logo depois de cada gravação no resumo do mês. */
export function comEspelho<T extends Op>(ops: T[]): T[] {
  if (!ops.some(x => MES.test(x.p))) return ops;
  const r: T[] = [];
  for (const x of ops) {
    r.push(x);
    const e = espelhoPublico(x);
    if (e) r.push(e as T);
  }
  return r;
}
