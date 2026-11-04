/* Carga da aba Caixa (KAN-225, saiu de rotas.js): rodadas do mês, lançamentos da janela recente, saldo pelas fichas
   e as rodadas do A pagar. Só quando a aba precisa (D10). */
import { posso, ymd } from '../dominio/grupo.js';
import { agora } from '../i18n/formatos.js';
import { S, SUBS, drop, subQ } from '../nucleo/estado';

/* O que a carga do caixa usa da gestão (carregada sob demanda): o começo da janela de lançamentos e do A pagar. */
export type GestaoCaixa = {
  inicioDaJanela: (mes: string, aPagar: string | null) => string;
  inicioAPagar: () => string | null;
};

export function cargaCaixa(A: GestaoCaixa) {
  const naAba = S.tab === 'caixa';
  if (naAba) {
    const m = S.month;
    if (S.rodMesM !== m) {
      S.rodMesM = m;
      S.rodMes = {};
      subQ('rodMes', 'rodadas', { campo: 'date', de: m + '-01', ate: m + '-31', ordem: 'asc' }, d => {
        S.rodMes = d || {};
      });
    }
  } else if (SUBS.rodMes) {
    drop('rodMes');
    S.rodMesM = null;
  }
  /* Lançamentos do caixa (KAN-106): só a janela recente (3 meses antes do mês escolhido em diante), nunca o histórico todo.
     Fora da aba Caixa, a janela é a do mês atual (usada na referência de valor fora do padrão, KAN-161). */
  const mesCx = naAba ? S.month : ymd(agora()).slice(0, 7),
    deCx = A.inicioDaJanela(mesCx, naAba ? A.inicioAPagar() : null);
  if (!posso('caixa')) {
    if (SUBS.caixa) drop('caixa');
    S.caixa = {};
    S.caixaDe = null;
  } else if (S.caixaDe !== deCx) {
    S.caixaDe = deCx;
    subQ('caixa', 'caixa', { campo: 'd', de: deCx, ordem: 'asc' }, d => {
      S.caixa = d || {};
    });
  }
}

/* Saldo (KAN-106, KAN-207: fichas em resumosCaixa, só com a permissão de Caixa) e A pagar por jogo (KAN-172). */
export function cargaSaldoEAPagar(A: GestaoCaixa) {
  if (S.tab === 'caixa' && posso('caixa')) {
    if (!SUBS.resCx)
      subQ('resCx', 'resumosCaixa', { campo: 'mes', ordem: 'asc' }, d => {
        S.resCx = d || {};
      });
  } else if (SUBS.resCx) {
    drop('resCx');
    S.resCx = null;
  }
  /* A pagar: rodadas desde o primeiro dia em que alguém passou a receber, em qualquer mês. */
  const desde = S.tab === 'caixa' ? A.inicioAPagar() : null;
  if (desde) {
    if (S.rodPagDe !== desde) {
      S.rodPagDe = desde;
      S.rodPag = {};
      subQ('rodPag', 'rodadas', { campo: 'date', de: desde, ordem: 'asc' }, d => {
        S.rodPag = d || {};
      });
    }
  } else if (SUBS.rodPag) {
    drop('rodPag');
    S.rodPagDe = null;
    S.rodPag = {};
  }
}
