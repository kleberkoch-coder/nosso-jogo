/* Carga da gestão (KAN-225, saiu de rotas.js): o que todo administrador lê ao abrir o grupo. As abas pedem o resto
   (carga/abas.ts) e as permissões ligam caixa, contatos e convite (carga/permissoes.ts). */
import { migrarPrivado, sincronizarVagas } from '../dominio/caixa-gestao';
import { S, sub, subQ } from '../nucleo/estado';
import { limparTokens, syncPerm } from './permissoes';
import { Q_PROX, Q_REC, dia, juntarRod, regAvulsos, subLimCfg } from './rodada';

export function startData() {
  if (S.dataOn) return;
  S.dataOn = true;
  sub('rat', 'privado/ratings', d => {
    S.rat = d;
  });
  sub('avul', 'avulsos', d => {
    S.avul = d || {};
    regAvulsos();
  });
  sub('jog', 'jogadores', d => {
    S.jog = d || {};
    migrarPrivado();
    sincronizarVagas();
  });
  subQ('rodF', 'rodadas', Object.assign({ de: dia(-1) }, Q_PROX), d => {
    S.rodF = d || {};
    juntarRod();
  });
  subQ('rodP', 'rodadas', Object.assign({ ate: dia(0) }, Q_REC), d => {
    S.rodP = d || {};
    juntarRod();
  });
  sub('migr', 'privado/migracao', d => {
    S.migr = d || { v: 0 };
  });
  /* KAN-208: afastamentos (motivo e período), para todo administrador; o link do jogador não lê. */
  sub('af', 'privado/afast', d => {
    S.af = d || {};
  });
  sub('vot', 'votacoes', d => {
    S.vot = d || {};
  });
  sub('membros', 'membros', d => {
    S.membros = d || {};
    limparTokens();
  });
  subLimCfg();
  syncPerm();
}
