/* Afastamento de jogador por um período (KAN-208, decisões do Kleber em 28/10/2026).
   - Conta por mês inteiro, pelo mês da mensalidade ("AAAA-MM"), de `de` até `ate` (vazio: até voltar).
   - Enquanto afastado: fora da lista de presença, de "Ainda não responderam" e da cobrança da rodada.
   - Mensalidade: cobra ou não cobra. "Não cobrar" fica no caixa (privado/caixa.afIsen, só com a permissão de Caixa)
     e vale só nos meses que o afastamento E a isenção cobrem (quem não tem Caixa não estende a isenção mudando as datas).
   - Volta sozinho no mês seguinte ao fim; "Voltou" fecha no mês anterior ao atual.
   Regra pura, testada em testes/regras/afastamento.test.mjs. */
export const MOTIVOS = ['lesao', 'ferias', 'viagem', 'outro'] as const;
export type Motivo = (typeof MOTIVOS)[number];
export type Afastamento = {
  pid: string;
  mot: Motivo;
  obs?: string;
  de: string;
  ate?: string;
  em?: number;
  ign?: string;
};
export type Afastamentos = Record<string, Afastamento | null | undefined>;
export type Isencao = { pid: string; de: string; ate?: string };
export type Isencoes = Record<string, Isencao | null | undefined>;

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
export const mesValido = (m: unknown): m is string => typeof m === 'string' && MES.test(m);

export function somaMes(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const t = a * 12 + (m - 1) + n;
  return Math.floor(t / 12) + '-' + String((t % 12) + 1).padStart(2, '0');
}
export const mesAnterior = (mes: string) => somaMes(mes, -1);

/* O mês está dentro do período? (`ate` vazio: sem fim) */
export const cobre = (x: { de: string; ate?: string }, mes: string) => x.de <= mes && (!x.ate || mes <= x.ate);

/* Afastamento do jogador que vale no mês (o mais recente, se houver mais de um). */
export function afastamentoNoMes(afs: Afastamentos, pid: string, mes: string): [string, Afastamento] | null {
  const v = Object.entries(afs || {})
    .filter((e): e is [string, Afastamento] => !!e[1] && e[1].pid === pid && cobre(e[1], mes))
    .sort((a, b) => (b[1].de < a[1].de ? -1 : b[1].de > a[1].de ? 1 : (b[1].em || 0) - (a[1].em || 0)));
  return v[0] || null;
}
export const afastado = (afs: Afastamentos, pid: string, mes: string) => !!afastamentoNoMes(afs, pid, mes);

/* Mensalidade do mês não é cobrada: o afastamento e a isenção do caixa (mesmo id) cobrem o mês. */
export function semMensalidade(afs: Afastamentos, isen: Isencoes, pid: string, mes: string): boolean {
  return Object.entries(isen || {}).some(([aid, i]) => {
    const a = (afs || {})[aid];
    return !!i && !!a && i.pid === pid && a.pid === pid && cobre(i, mes) && cobre(a, mes);
  });
}

/* "Voltou" no mês atual: o afastamento fecha no mês anterior. Se começou neste mês (ou depois), deixa de existir (null). */
export function fimAoVoltar(a: { de: string }, mesAtual: string): string | null {
  const ate = mesAnterior(mesAtual);
  return ate < a.de ? null : ate;
}

/* Confere o que vem da janela: motivo, meses válidos e fim depois do começo. Devolve o erro (chave do texto) ou ''. */
export function erroAfastamento(x: { mot?: string; de?: string; ate?: string }): string {
  if (!MOTIVOS.includes(x.mot as Motivo)) return 'afast.erroMotivo';
  if (!mesValido(x.de)) return 'afast.erroInicio';
  if (x.ate && (!mesValido(x.ate) || x.ate < x.de)) return 'afast.erroFim';
  return '';
}

/* Afastamentos do jogador, do mais recente para o mais antigo (histórico na ficha). */
export function doJogador(afs: Afastamentos, pid: string): [string, Afastamento][] {
  return Object.entries(afs || {})
    .filter((e): e is [string, Afastamento] => !!e[1] && e[1].pid === pid)
    .sort((a, b) => (a[1].de < b[1].de ? 1 : a[1].de > b[1].de ? -1 : 0));
}

/* Afastados que responderam "Vou" na rodada e ainda não tiveram o aviso dispensado ("Manter afastado"). */
export function afastadosQueConfirmaram(
  afs: Afastamentos,
  pres: Record<string, { s?: string } | undefined>,
  mes: string,
  rid: string
): [string, string][] {
  return Object.keys(pres || {})
    .filter(pid => pres[pid]?.s === 'in')
    .map(pid => [pid, afastamentoNoMes(afs, pid, mes)] as const)
    .filter((x): x is readonly [string, [string, Afastamento]] => !!x[1] && x[1][1].ign !== rid)
    .map(([pid, a]) => [pid, a[0]] as [string, string]);
}
