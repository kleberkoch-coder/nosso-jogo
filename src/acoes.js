/* O que cada botão (data-a) faz. As ações ficam divididas por assunto em src/acoes/ (organização pedida pelo Arquiteto em 14/10/2026). */
import { acoes as conta } from './acoes/conta.js';
import { acoes as grupo } from './acoes/grupo.js';
import { acoes as rodada } from './acoes/rodada.js';
import { acoes as jogadores } from './acoes/jogadores.js';
import { acoes as partida } from './acoes/partida.js';
import { acoes as caixa } from './acoes/caixa.js';
import { acoes as votacao } from './acoes/votacao.js';
import { acoes as publico } from './acoes/publico.js';

const ACT=Object.assign({},conta, grupo, rodada, jogadores, partida, caixa, votacao, publico);

export { ACT };
