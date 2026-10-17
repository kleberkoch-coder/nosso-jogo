/* Aba Partida (KAN-175): placar, cronômetro e ações da partida. Baixa só quando a aba é aberta
   (src/admin.js, carregarPartida), e o service worker guarda junto com a gestão para funcionar sem sinal na quadra. */
import { acoes } from './acoes/partida.js';

export { montarPartida, vPartida } from './telas/Partida';
export { tick } from './ui/placar.js';
export const ACOES = acoes;
