/* Aba Votação sob demanda (KAN-180): baixa na primeira vez que a aba é aberta. */
import { juntarTextos } from '../i18n/index.js';
import textos from '../i18n/pt-BR-votacao';
/* Os textos desta parte chegam com ela (KAN-205). */
juntarTextos(textos);
import { acoes } from '../acoes/votacao.js';

export { vVotacao as ver } from '../telas/votacao-gestao.js';
export const ACOES = acoes;
