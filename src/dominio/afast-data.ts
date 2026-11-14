/* No link do jogador (KAN-271, pelada-v117): o jogador está afastado na data da rodada? Lê a marca pública "af" do
   jogador (datas de início e fim, sem motivo), gravada pela gestão (dominio/afast-link.ts). Fica num arquivo à parte
   para o link não carregar a regra do ciclo e dos afastamentos. */
export type Periodo = { de: string; ate: string };

export function afastadoNaData(af: unknown, data: string): boolean {
  if (!Array.isArray(af) || !data) return false;
  return af.some(
    (p: Partial<Periodo> | null) => !!p && typeof p.de === 'string' && p.de <= data && (!p.ate || data <= p.ate)
  );
}
