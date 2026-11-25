/* Leitura confiável no celular com sinal fraco (KAN-184). Antes, quem abria o link pela primeira vez podia ver
   "Grupo não encontrado": o Firestore entregava a cópia do aparelho (vazia) antes do servidor responder, e um erro
   de rede marcava a leitura como pronta, sem nova tentativa. */

/* Documento que não existe só na cópia do aparelho, com o aparelho online: ainda não vale, espera o servidor. */
export function esperarServidor(o: { existe: boolean; daCopia: boolean; online: boolean }): boolean {
  return !o.existe && o.daCopia && o.online;
}

/* Erros de rede ou do servidor que costumam passar sozinhos. Sem permissão ou dado inválido não adianta repetir. */
const PASSAGEIROS = ['unavailable', 'deadline-exceeded', 'internal', 'unknown', 'resource-exhausted', 'aborted'];
export const ESPERAS = [1000, 2000, 4000];

/* Quanto esperar antes da próxima tentativa (em ms), ou null para desistir. tentativa começa em 0. */
export function proximaTentativa(codigo: string | undefined, tentativa: number): number | null {
  if (!PASSAGEIROS.includes(String(codigo || '').replace(/^firestore\//, ''))) return null;
  return tentativa < ESPERAS.length ? ESPERAS[tentativa] : null;
}

/* Carregando há mais que isso: a tela mostra "Está demorando mais que o normal" e "Tentar de novo". */
export const DEMORA_MS = 12000;
/* KAN-263 (pelada-v131): a tela que passou do tempo vira um registro de falha ("demora"), uma vez por tela na visita. */
const demoras = new Set<string>();
export function avisarDemora(tela: string) {
  if (demoras.has(tela)) return;
  demoras.add(tela);
  try {
    document.dispatchEvent(new CustomEvent('nj-demora', { detail: DEMORA_MS + 'ms' }));
  } catch (e) {
    /* nunca atrapalha a tela */
  }
}
/* KAN-263: a parte sob demanda que não baixou vira um registro de falha ("parte"). */
export function avisarParte(nome: string, e: unknown) {
  try {
    const m = (e && (e as { message?: string }).message) || String(e);
    document.dispatchEvent(new CustomEvent('nj-parte-falhou', { detail: nome + ': ' + m }));
  } catch (x) {
    /* nunca atrapalha a tela */
  }
}
