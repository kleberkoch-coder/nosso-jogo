/* Vagas para diaristas e avulsos (KAN-63, decisão do Kleber em 21/10/2026): com o controle ligado no grupo,
   quem não é mensalista nem isento só confirma pelo link quando o administrador abre vagas naquela rodada.
   As regras do Firebase garantem (firestore.rules); o app só esconde e avisa antes.
   - grupo: cfg.vagasCtrl = true liga o controle;
   - jogador: vaga = true é a marca pública "só entra com vaga aberta" (ajustada pelo app a partir do tipo);
   - rodada: vagas = { aberta, max } (max 0 = sem limite);
   - contador: rodadas/{rid}/limites/vagas = { n, ult } (quantos entraram pelo link desde que as vagas abriram). */
export type Vagas = { aberta?: boolean; max?: number } | null | undefined;
export type Contador = { n?: number } | null | undefined;
export type Situacao = { aberta: boolean; max: number; n: number; cheia: boolean; podeEntrar: boolean };

/* Quantidade de vagas aceita: inteiro de 0 (sem limite) a 99. */
export function vagasValidas(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 0;
}

/* Marca pública do jogador: só o diarista, e só com o controle ligado (sem controle, ninguém fica marcado). */
export function marcaVaga(tipo: string | undefined, controle: boolean): boolean {
  return controle && tipo === 'diarista';
}

/* Quem precisa de vaga: avulso (não está no elenco) ou jogador com a marca. */
export function precisaVaga(jogador: { vaga?: boolean } | null | undefined): boolean {
  return !jogador || jogador.vaga === true;
}

/* Como estão as vagas da rodada. Sem controle, todo mundo pode entrar. */
export function situacao(controle: boolean, v: Vagas, c: Contador): Situacao {
  const aberta = !!(v && v.aberta),
    max = vagasValidas(v && v.max),
    n = Math.max(0, (c && c.n) || 0),
    cheia = aberta && max > 0 && n >= max;
  return { aberta, max, n, cheia, podeEntrar: !controle || (aberta && !cheia) };
}

/* Quanto a resposta mexe no contador: entrar (+1) ou sair de quem estava dentro (-1). */
export function movimento(antes: string | undefined, depois: string): number {
  if (depois === 'in' && antes !== 'in') return 1;
  if (depois !== 'in' && antes === 'in') return -1;
  return 0;
}

/* Jogadores cuja marca precisa mudar para acompanhar o tipo (ex.: virou diarista, ou o controle foi desligado). */
export function marcasParaAjustar(
  jogadores: Record<string, { vaga?: boolean } | null | undefined>,
  tipoDe: (id: string) => string,
  controle: boolean
): [string, boolean][] {
  return Object.keys(jogadores)
    .filter(id => jogadores[id])
    .map(id => [id, marcaVaga(tipoDe(id), controle)] as [string, boolean])
    .filter(([id, m]) => !!jogadores[id]!.vaga !== m);
}
