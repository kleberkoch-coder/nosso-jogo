/* Parte do app de quem tem conta (KAN-149): telas e ações de gestão, a página inicial e o convite.
   É carregada só quando precisa (src/nucleo/carga-admin.js). O jogador que abre o link da rodada ou da votação
   não baixa nada daqui, e o app abre mais rápido com sinal fraco. */
import textosGestao from './i18n/pt-BR-gestao.js';
import { juntarTextos } from './i18n/index.js';
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
export { montarHome, vHome } from './telas/Grupos';
export { montarJogadores, vJogadores } from './telas/Jogadores';
export { tick } from './ui/placar.js';
export { montarPartida, vPartida } from './telas/Partida';
export { montarRodada, vRodada } from './telas/Rodada';
export { migrar, verificarRodadas } from './nucleo/partidas.js';
export { drawPreview } from './ui/dialogos-gestao.js';
export { trocarPaisGrupo } from './telas/grupo-form.js';
export { contaRegiao, listaPais, paisAparelho, preencher } from './ui/regiao.ts';
export { trocarPaisTelefone } from './ui/contato-form';
export { vVotacao } from './telas/votacao-gestao.js';
/* Os textos da gestão entram no dicionário assim que esta parte chega (KAN-159). */
juntarTextos(textosGestao);

export const ACOES = Object.assign({}, grupo, rodada, jogadores, partida, caixa, votacao);
