/* Parte do app de quem tem conta (KAN-149): telas e ações de gestão, a página inicial e o convite.
   É carregada só quando precisa (src/nucleo/carga-admin.js). O jogador que abre o link da rodada ou da votação
   não baixa nada daqui, e o app abre mais rápido com sinal fraco. */
import textosGestao from './i18n/pt-BR-gestao.js';
import { juntarTextos } from './i18n/index.js';
import { acoes as grupo } from './acoes/grupo';
import { acoes as rodada } from './acoes/rodada.js';
import { acoes as jogadores } from './acoes/jogadores.js';
import { acoes as recalcular } from './acoes/recalcular';
import { acoes as plano } from './acoes/plano';
import { acoes as afastamento } from './acoes/afastamento';
import { acoes as avaliacao } from './acoes/avaliacao';
import { ACT } from './acoes.js';
import { tx } from './i18n/index.js';
import { main, toast } from './nucleo/util.js';
import { changed } from './ui/render.js';

/* KAN-217: a tela do convite para administrar baixa só quando alguém abre um convite. */
let convite = null;
export function renderInvite() {
  if (convite) return convite.renderInvite();
  const d = document.createElement('div');
  d.className = 'empty muted';
  d.textContent = tx('comum.carregando');
  main.replaceChildren(d);
  import('./telas/Convite').then(
    m => {
      convite = m;
      changed();
    },
    () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
  );
}

export { inicioAPagar } from './dominio/caixa.js';
export { inicioDaJanela } from './dominio/caixa-regras';
export { montarHome, vHome } from './telas/Grupos';
export { guardarOrdemJogadores, montarJogadores, vJogadores } from './telas/Jogadores';
export { montarRodada, vRodada } from './telas/Rodada';
export { migrar, migrarCaixa, migrarMensal, verificarRodadas } from './nucleo/partidas.js';
export { drawPreview } from './ui/dialogos-gestao.js';
export { contaRegiao, listaPais, paisAparelho, preencher } from './ui/regiao.ts';
export { trocarPaisTelefone } from './ui/contato-form';
/* Planos (KAN-119): quem tem cada recurso, avisos, cadeado das abas e o espelho do plano no grupo. */
export { sincronizarPlano } from './nucleo/plano';
export { montarAvisosPlano, montarCadeado, vCadeado } from './ui/Plano';
/* Os textos da gestão entram no dicionário assim que esta parte chega (KAN-159). */
juntarTextos(textosGestao);

export const ACOES = Object.assign({}, grupo, rodada, jogadores, recalcular, plano, afastamento, avaliacao);

/* Abas sob demanda (KAN-180): Caixa, Histórico, Votação e Ranking baixam na primeira vez que a aba é aberta, como a Partida.
   Cada uma traz a tela (ver, e montar quando é componente) e as próprias ações, que entram no ACT. */
const ABAS = {
  caixa: () => import('./abas/caixa'),
  historico: () => import('./abas/historico'),
  votacao: () => import('./abas/votacao'),
  ranking: () => import('./abas/ranking'),
  grupo: () => import('./abas/grupo'),
};
const abas = {},
  baixandoAba = {};
export const abaSobDemanda = k => k in ABAS;
export const abaPronta = k => abas[k] || null;
export function carregarAba(k) {
  return (
    baixandoAba[k] ||
    (baixandoAba[k] = ABAS[k]()
      .then(m => {
        Object.assign(ACT, m.ACOES);
        abas[k] = m;
        return m;
      })
      .catch(e => {
        delete baixandoAba[k];
        throw e;
      }))
  );
}

/* Aba Partida sob demanda (KAN-175): baixa na primeira vez que a aba é aberta; as ações entram no ACT. */
let partida = null,
  baixandoPartida = null;
export const partidaPronta = () => partida;
export function carregarPartida() {
  return (
    baixandoPartida ||
    (baixandoPartida = import('./partida')
      .then(m => {
        Object.assign(ACT, m.ACOES);
        partida = m;
        return m;
      })
      .catch(e => {
        baixandoPartida = null;
        throw e;
      }))
  );
}
