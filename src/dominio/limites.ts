/* Limites contra abuso (KAN-89), sem servidor.
   Os números ficam no documento sistema/limites do Firebase: o Kleber muda lá e vale na hora, sem versão nova.
   Sem o documento (ou com valor inválido), valem os padrões abaixo, os mesmos das regras do Firebase (firestore.rules).
   As regras do Firebase é que garantem o limite; o app só avisa antes, para a pessoa entender o que aconteceu. */

export type Limites = { avulsosPorRodada?: unknown; gruposPorConta?: unknown } | null | undefined;
export type Chave = 'avulsosPorRodada' | 'gruposPorConta';

export const PADRAO: Record<Chave, number> = { avulsosPorRodada: 30, gruposPorConta: 20 };

export function limite(cfg: Limites, k: Chave): number {
  const v = cfg ? (cfg as Record<string, unknown>)[k] : undefined;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : PADRAO[k];
}

/* Contador de avulsos novos pelo link numa rodada: rodadas/{rid}/limites/avulsos = { n, ult }. */
export function avulsosEsgotados(cont: { n?: number } | null | undefined, cfg: Limites): boolean {
  return ((cont && cont.n) || 0) >= limite(cfg, 'avulsosPorRodada');
}

/* Contador de grupos criados pela conta: contas/{uid} = { ng, ult }. */
export function gruposEsgotados(conta: { ng?: number } | null | undefined, cfg: Limites): boolean {
  return ((conta && conta.ng) || 0) >= limite(cfg, 'gruposPorConta');
}

/* Uma presença gravada pelo link conta como avulso novo quando quem grava não é administrador,
   o nome não é de um jogador cadastrado e a pessoa ainda não está na lista desta rodada.
   Mudar a própria resposta depois (Vou / Não vou) nunca conta. */
export function contaComoAvulso(o: { admin: boolean; jogador: boolean; jaNaLista: boolean }): boolean {
  return !o.admin && !o.jogador && !o.jaNaLista;
}
