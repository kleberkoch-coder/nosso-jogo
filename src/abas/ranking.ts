/* Aba Ranking sob demanda (KAN-180): baixa na primeira vez que a aba é aberta. Componente desde a v71 (KAN-203). */
import estilo from '../estilos/ranking.css' with { type: 'text' };
import { usarEstilo } from '../ui/estilo';
import { juntarTextos } from '../i18n/index.js';
import textos from '../i18n/pt-BR-ranking';
usarEstilo('ranking', estilo);
/* Os textos desta parte chegam com ela (KAN-205). */
juntarTextos(textos);
export { anoRank, montarRanking as montar, vRanking as ver } from '../telas/Ranking';
export const ACOES = {};
