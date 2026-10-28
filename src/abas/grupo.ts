/* Aba Grupo sob demanda (pelada-v71): baixa na primeira vez que a aba é aberta, como Caixa e Ranking,
   para a gestão abrir leve (D7). As ações da aba continuam em acoes/grupo.js, que já vem com a gestão. */
import { juntarTextos } from '../i18n/index.js';
import textos from '../i18n/pt-BR-grupo';
/* Os textos desta parte chegam com ela (KAN-205). */
juntarTextos(textos);
export { vGrupo as ver, montarGrupo as montar } from '../telas/GrupoTela';
export const ACOES = {};
