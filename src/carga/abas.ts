/* Dados que só carregam quando a aba precisa deles (D10; KAN-225, saiu de rotas.js): fichas do ranking, partidas da
   rodada aberta, caixa, quem mais joga junto, histórico e a rodada de uma votação antiga. A ordem das leituras é a
   mesma de antes (o caixa vem antes de "quem joga junto", e o saldo e o A pagar, depois). */
import { curRodada } from '../dominio/grupo.js';
import { adm } from '../nucleo/carga-admin.js';
import { S, SUBS, drop, sub, subQ } from '../nucleo/estado';
import { cargaCaixa, cargaSaldoEAPagar, type GestaoCaixa } from './caixa';
import { dia, JUNTOS_RODADAS } from './rodada';
import { rodadaDaVotacao } from './votacao';

type Aba = { anoRank?: () => string | null; estadoHist?: () => Hist; buscarHist?: (mais: boolean) => void };
type Hist = { buscou?: boolean; carregando?: boolean; auto?: boolean };
type Gestao = GestaoCaixa & {
  migrar: () => void;
  migrarCaixa: () => void;
  migrarMensal: () => void;
  verificarRodadas: () => void;
  abaPronta: (aba: string) => Aba | null;
};

/* Fichas de resumo: o ranking lê só as do ano escolhido (até 12), quando a aba já chegou (KAN-180). */
function ranking(A: Gestao) {
  const RK = S.tab === 'ranking' ? A.abaPronta('ranking') : null,
    want = RK && RK.anoRank ? RK.anoRank() : null;
  if (want) {
    if (S.resK !== want) {
      S.resK = want;
      S.res = {};
      subQ(
        'res',
        'resumos',
        want === 'todos'
          ? { campo: 'mes', ordem: 'asc' }
          : { campo: 'mes', de: want + '-01', ate: want + '-12', ordem: 'asc' },
        d => {
          S.res = d || {};
        }
      );
    }
  } else if (SUBS.res) {
    drop('res');
    S.res = null;
    S.resK = null;
  }
}
/* Partidas só da rodada aberta na aba Partida. */
function partidas() {
  if (S.tab === 'partida') {
    const r = curRodada(),
      id = r && r.id;
    if (id && S.partsRid !== id) {
      S.partsRid = id;
      S.parts = {};
      sub('parts', 'rodadas/' + id + '/partidas', d => {
        S.parts = d || {};
      });
    }
  } else if (SUBS.parts) {
    drop('parts');
    S.partsRid = null;
    S.parts = {};
  }
}
/* Quem mais joga junto (KAN-200): as últimas 20 rodadas, só com a aba Jogadores aberta. */
function juntos() {
  if (S.tab === 'jogadores') {
    if (!SUBS.rodJunt)
      subQ('rodJunt', 'rodadas', { campo: 'date', ate: dia(0), ordem: 'desc', limite: JUNTOS_RODADAS }, d => {
        S.rodJunt = d || {};
      });
  } else if (SUBS.rodJunt) {
    drop('rodJunt');
    S.rodJunt = null;
  }
}
/* Histórico sob demanda (KAN-180): a busca automática roda quando a aba já chegou. */
function historico(A: Gestao) {
  const H = S.tab === 'historico' ? A.abaPronta('historico') : null;
  if (H && H.estadoHist && H.buscarHist) {
    const h = H.estadoHist();
    if (!h.buscou && !h.carregando && !h.auto) {
      h.auto = true;
      H.buscarHist(false);
    }
  }
}

export function ensureExtras() {
  const A = adm() as Gestao | null;
  if (S.route.n !== 'admin' || !S.dataOn || !A) return;
  /* Partidas e totais por mês (pelada-v18): move dados antigos uma vez e mantém tudo no lugar novo. */
  A.migrar();
  A.migrarCaixa(); // KAN-207: totais do caixa saem do resumo do ranking (uma vez, pelo organizador)
  A.migrarMensal(); // KAN-212: mensalidades pagas por competência, para o Quadro do ano (uma vez, quem tem Caixa)
  A.verificarRodadas();
  ranking(A);
  partidas();
  cargaCaixa(A);
  juntos();
  cargaSaldoEAPagar(A);
  historico(A);
  if (S.tab === 'votacao') rodadaDaVotacao();
}
