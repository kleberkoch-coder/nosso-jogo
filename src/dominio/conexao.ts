/* Conexão que fica ruim sem a pessoa perceber (KAN-276 e KAN-277, pelada-v120). Regra pura, com teste
   (testes/regras/conexao.test.mjs); quem ouve os eventos e mostra o aviso é nucleo/conexao.ts.
   - App Check (KAN-276): depois de um erro de rede (computador que dormiu, internet que caiu), a biblioteca do App
     Check espera antes de tentar de novo, e enquanto isso toda chamada sai sem comprovante. O app pede um comprovante
     novo quando a internet volta ou a aba volta a aparecer; se continuar sem por LIMITE_RECUSA_MS, com a aba visível
     e com internet, mostra o aviso para recarregar.
   - Cópia local do banco (KAN-277): no Safari do iPhone, a cópia local (IndexedDB) às vezes quebra quando o app volta
     do segundo plano. Daí em diante a tela pode parar de atualizar; o app mostra o aviso para recarregar. */

/* 5 minutos sem comprovante, com a aba visível e com internet. */
export const LIMITE_RECUSA_MS = 5 * 60 * 1000;
/* Aba escondida por mais de 1 minuto: ao voltar, pede um comprovante novo (barato: o App Check devolve o que tem). */
export const ESCONDIDA_LONGA_MS = 60 * 1000;

/* Mensagens que a biblioteca do Firebase e o Safari dão quando a cópia local quebrou. */
const BANCO_LOCAL =
  /without an in-progress transaction|Indexed ?Database server lost|database connection is closing|INTERNAL ASSERTION FAILED/i;
export const erroDoBancoLocal = (m: unknown): boolean => BANCO_LOCAL.test(String(m == null ? '' : m));

/* Mostrar o aviso do App Check? Só com a recusa já longa, a aba visível e internet (sem internet, a barra "Sem
   internet" já explica). */
export function mostrarAviso(
  falhaDesde: number | null,
  agora: number,
  visivel: boolean,
  online: boolean,
  limite = LIMITE_RECUSA_MS
): boolean {
  return falhaDesde != null && visivel && online && agora - falhaDesde >= limite;
}

/* Ao a aba voltar a aparecer: pede um comprovante novo se estava sem comprovante ou se ficou muito tempo escondida. */
export function pedirAoVoltar(
  escondidaDesde: number | null,
  agora: number,
  comFalha: boolean,
  minimo = ESCONDIDA_LONGA_MS
): boolean {
  return comFalha || (escondidaDesde != null && agora - escondidaDesde >= minimo);
}
