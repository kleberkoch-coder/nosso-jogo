/* Aba Caixa sob demanda (KAN-180): baixa na primeira vez que a aba é aberta, como a Partida (KAN-175).
   O service worker guarda junto com a gestão, então abre sem internet depois do primeiro uso. */
import { juntarTextos } from '../i18n/index.js';
import textos from '../i18n/pt-BR-caixa';
/* Os textos desta parte chegam com ela (KAN-205). */
juntarTextos(textos);
import { acoes as acoesCaixa } from '../acoes/caixa.js';
import { acoes as acoesRateio } from '../acoes/rateio';
const acoes = Object.assign({}, acoesCaixa, acoesRateio);

export { vCaixa as ver, montarCaixa as montar } from '../telas/Caixa';
export const ACOES = acoes;
