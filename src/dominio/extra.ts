/* Extra da rodada (KAN-228): churrasco, pizzada ou outro encontro depois do jogo, com resposta separada da do jogo.
   Regra pura (sem ler a memória do app), testada em testes/regras/extra.test.mjs.
   - Quem responde: jogadores do elenco (inclusive afastados), avulsos e quem o organizador adicionar.
   - Cada pessoa leva até 3 convidados, que só contam se ela vai.
   - O jogo (sorteio, vagas, mínimo) não olha o extra, e o extra não olha o jogo. */
export const LIMITE_CONVIDADOS = 3;
export const NOME_MAX = 40;
export type Resposta = { s?: string; t?: number; conv?: string[]; nome?: string };
export type Convidado = { nome: string; de: string };

const limpar = (s: unknown) =>
  String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NOME_MAX);

/* Quem vai (na ordem da resposta), quem não vai, os convidados de quem vai e o total. */
export function resumoExtra(ext: Record<string, Resposta | null | undefined> | null | undefined) {
  const lista = Object.entries(ext || {}).filter(([, r]) => r && (r.s === 'in' || r.s === 'out')) as [
    string,
    Resposta,
  ][];
  const vao = lista
    .filter(([, r]) => r.s === 'in')
    .sort((a, b) => (a[1].t || 0) - (b[1].t || 0))
    .map(([id]) => id);
  const naoVao = lista.filter(([, r]) => r.s === 'out').map(([id]) => id);
  const convidados: Convidado[] = [];
  vao.forEach(id => ((ext || {})[id]!.conv || []).forEach(nome => convidados.push({ nome: limpar(nome), de: id })));
  return { vao, naoVao, convidados, total: vao.length + convidados.length };
}

/* Novo convidado: devolve a lista nova ou o motivo de não dar. */
export function comConvidado(
  atual: string[] | undefined,
  nome: string
): { conv: string[] } | { erro: 'vazio' | 'cheio' | 'repetido' } {
  const n = limpar(nome),
    l = (atual || []).slice();
  if (!n) return { erro: 'vazio' };
  if (l.length >= LIMITE_CONVIDADOS) return { erro: 'cheio' };
  if (l.some(x => x.toLowerCase() === n.toLowerCase())) return { erro: 'repetido' };
  return { conv: l.concat(n) };
}

/* Para o rateio do extra: quem é do elenco (ou avulso) entra pelo id; convidados e pessoas que o organizador
   adicionou pelo nome entram como "de fora" (KAN-216), com o nome de quem convidou. */
export function participantesDoRateio(
  ext: Record<string, Resposta | null | undefined> | null | undefined,
  ehDoGrupo: (id: string) => boolean,
  nomeDe: (id: string) => string,
  rotuloConvidado: (nome: string, de: string) => string
) {
  const r = resumoExtra(ext),
    sel: string[] = [],
    fora: Record<string, string> = {};
  let i = 0;
  const deFora = (nome: string) => {
    const id = 'f_x' + ++i;
    fora[id] = limpar(nome);
    sel.push(id);
  };
  r.vao.forEach(id => {
    if (ehDoGrupo(id)) sel.push(id);
    else deFora((ext || {})[id]!.nome || nomeDe(id));
  });
  r.convidados.forEach(c => deFora(rotuloConvidado(c.nome, nomeDe(c.de))));
  return { sel, fora };
}
