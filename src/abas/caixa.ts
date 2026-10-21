/* Aba Caixa sob demanda (KAN-180): baixa na primeira vez que a aba é aberta, como a Partida (KAN-175).
   O service worker guarda junto com a gestão, então abre sem internet depois do primeiro uso. */
import { acoes } from '../acoes/caixa.js';

export { vCaixa as ver, montarCaixa as montar } from '../telas/Caixa';
export const ACOES = acoes;
