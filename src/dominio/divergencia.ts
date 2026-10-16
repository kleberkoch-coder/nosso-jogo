/* Lista × times sorteados (pelada-v15).
   Regra pura: não lê o estado do app nem o banco, por isso tem teste próprio em testes/regras/.

   No sorteio o app guarda a "foto" da lista de confirmados (rodada.base).
   Divergência é o que mudou na lista DEPOIS dessa foto:
   - saiu:   está num time, estava na foto e agora não está confirmado;
   - entrou: está confirmado agora, não estava na foto e não está em nenhum time.
   Quem foi desmarcado de propósito na tela do sorteio está na foto, então não gera aviso. */

export type Time = { c: number; players: string[] };
export type RodadaSorteio = { times?: Time[] | null; base?: string[] | null; info?: Record<string, unknown> | null };
export type Presencas = Record<string, { s?: string; t?: number } | undefined>;
export type Divergencia = { saiu: string[]; entrou: string[] };

export function noTime(r: RodadaSorteio): Set<string> {
  return new Set((r.times || []).flatMap(t => t.players));
}

/* Rodadas sorteadas antes da v15 não têm a foto: usa quem entrou no sorteio. */
export function fotoDoSorteio(r: RodadaSorteio): Set<string> {
  if (r.base) return new Set(r.base);
  return new Set([...Object.keys(r.info || {}), ...noTime(r)]);
}

export function divergencia(r: RodadaSorteio | null | undefined, pres: Presencas): Divergencia {
  if (!r || !r.times || !r.times.length) return { saiu: [], entrou: [] };
  const times = noTime(r),
    foto = fotoDoSorteio(r),
    vai = (id: string) => pres[id]?.s === 'in';
  const saiu = [...times].filter(id => foto.has(id) && !vai(id));
  const entrou = Object.keys(pres)
    .filter(id => vai(id) && !foto.has(id) && !times.has(id))
    .sort((a, b) => (pres[a]?.t || 0) - (pres[b]?.t || 0));
  return { saiu, entrou };
}

/* Quem pode ser posto direto num time: ainda não está em nenhum. */
export function foraDosTimes(r: RodadaSorteio, ids: string[]): string[] {
  const t = noTime(r);
  return ids.filter(id => !t.has(id));
}
