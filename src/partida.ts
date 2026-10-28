/* Aba Partida (KAN-175): placar, cronômetro e ações da partida. Baixa só quando a aba é aberta
   (src/admin.js, carregarPartida), e o service worker guarda junto com a gestão para funcionar sem sinal na quadra. */
import { juntarTextos } from './i18n/index.js';
import textos from './i18n/pt-BR-partida';
/* Os textos desta parte chegam com ela (KAN-205). */
juntarTextos(textos);
import { acoes } from './acoes/partida.js';

export { montarPartida, vPartida } from './telas/Partida';
export { tick } from './ui/placar.js';
export const ACOES = acoes;
