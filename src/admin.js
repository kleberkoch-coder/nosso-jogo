/* Parte do app de quem tem conta (KAN-149): telas e ações de gestão, a página inicial e o convite.
   É carregada só quando precisa (src/nucleo/carga-admin.js). O jogador que abre o link da rodada ou da votação
   não baixa nada daqui, e o app abre mais rápido com sinal fraco. */
import { acoes as grupo } from './acoes/grupo.js';
import { acoes as rodada } from './acoes/rodada.js';
import { acoes as jogadores } from './acoes/jogadores.js';
import { acoes as partida } from './acoes/partida.js';
import { acoes as caixa } from './acoes/caixa.js';
import { acoes as votacao } from './acoes/votacao.js';

export { buscarHist, estadoHist, vHistorico } from './telas/historico.js';
export { anoRank, vRanking } from './telas/ranking.js';
export { vLanding } from './telas/apresentacao.js';
export { montarCaixa, vCaixa } from './telas/Caixa.tsx';
export { renderInvite } from './telas/convite.js';
export { vGrupo } from './telas/grupo.js';
export { vHome } from './telas/grupos.js';
export { vJogadores } from './telas/jogadores.js';
export { tick, vPartida } from './telas/partida.js';
export { vRodada } from './telas/rodada.js';
export { migrar, verificarRodadas } from './nucleo/partidas.js';
export { drawPreview } from './ui/dialogos-gestao.js';
export { vVotacao } from './telas/votacao-gestao.js';
export const ACOES = Object.assign({}, grupo, rodada, jogadores, partida, caixa, votacao);
