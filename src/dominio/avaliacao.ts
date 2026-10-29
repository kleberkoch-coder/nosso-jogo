/* Avaliação de notas por link (KAN-214, decisões do Kleber em 29/10/2026).
   - O organizador cria uma avaliação com data de fechamento. A lista de quem é avaliado (e de quem avalia pelo link)
     são os mensalistas do momento.
   - Quem abre o link escolhe o próprio nome e dá nota (1 a 10, de meio em meio ponto) a cada mensalista, inclusive a si.
     Vê só nome e posição; nunca vê a nota atual nem a dos outros. Os administradores dão nota pelo app.
   - Todas as notas têm o mesmo peso. Se o mesmo nome avaliou mais de uma vez (dois aparelhos), vale a mais recente.
   - Só administradores com a permissão de Notas veem o resultado: média, mediana e quantas notas. Nada muda sozinho:
     o administrador escolhe quem atualizar e com qual nota.
   Regra pura, testada em testes/regras/avaliacao.test.mjs. */
export type Avaliacao = { t: string; ate: number; jogs: string[]; open?: boolean; em?: number };
export type Resposta = { pid?: string; n?: Record<string, number>; t?: number };
export type Linha = { pid: string; media: number | null; mediana: number | null; qtd: number };

/* Notas possíveis: 1, 1,5, 2, ... 10. */
export const NOTAS: number[] = Array.from({ length: 19 }, (_, i) => 1 + i / 2);
export const notaValida = (v: unknown) => typeof v === 'number' && NOTAS.includes(v);

/* Meio ponto mais perto (o cadastro guarda de meio em meio). */
export function meioPonto(v: number): number {
  return Math.min(10, Math.max(1, Math.round(v * 2) / 2));
}

export function media(vs: number[]): number | null {
  if (!vs.length) return null;
  let t = 0;
  for (const v of vs) t += v;
  return Math.round((t / vs.length) * 100) / 100;
}
export function mediana(vs: number[]): number | null {
  if (!vs.length) return null;
  const o = vs.slice().sort((a, b) => a - b),
    m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2;
}

/* Aberta: não encerrada e antes do fim do dia de fechamento. */
export const aberta = (a: Pick<Avaliacao, 'ate' | 'open'> | null | undefined, agora: number) =>
  !!a && a.open !== false && agora < a.ate;

/* Respostas que valem: a mais recente de cada nome (administrador sem nome conta sempre, cada um a sua). */
export function respostasValidas(rs: Record<string, Resposta | null | undefined>): Resposta[] {
  const porNome: Record<string, Resposta> = {},
    adm: Resposta[] = [];
  for (const r of Object.values(rs || {})) {
    if (!r || !r.n) continue;
    if (!r.pid) adm.push(r);
    else if (!porNome[r.pid] || (r.t || 0) > (porNome[r.pid]!.t || 0)) porNome[r.pid] = r;
  }
  return Object.values(porNome).concat(adm);
}

/* Resultado por avaliado, na ordem da lista: média, mediana e quantas notas. */
export function resultado(a: Pick<Avaliacao, 'jogs'>, rs: Record<string, Resposta | null | undefined>): Linha[] {
  const validas = respostasValidas(rs);
  return a.jogs.map(pid => {
    const vs = validas.map(r => (r.n || {})[pid]).filter((v): v is number => notaValida(v));
    return { pid, media: media(vs), mediana: mediana(vs), qtd: vs.length };
  });
}

/* Quem já respondeu (nomes), para o administrador acompanhar. */
export function responderam(rs: Record<string, Resposta | null | undefined>): { nomes: string[]; adm: number } {
  const v = respostasValidas(rs);
  return { nomes: v.filter(r => r.pid).map(r => r.pid as string), adm: v.filter(r => !r.pid).length };
}

/* Fim do dia escolhido ("AAAA-MM-DD"), no fuso do aparelho de quem cria. */
export function fimDoDia(data: string): number {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number];
  return new Date(a, m - 1, d, 23, 59, 59).getTime();
}

/* Confere a criação. Devolve a chave do erro ou ''. */
export function erroAvaliacao(x: { t?: string; data?: string; jogs?: string[] }, hoje: string): string {
  if (!(x.t || '').trim()) return 'aval.erroTitulo';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x.data || '') || (x.data as string) < hoje) return 'aval.erroData';
  if (!(x.jogs || []).length) return 'aval.erroMensalistas';
  return '';
}
