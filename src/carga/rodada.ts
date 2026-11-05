/* Carga da rodada (KAN-225, saiu de rotas.js): presenças da rodada aberta, contadores de avulsos e vagas pelo link,
   avulsos que jogaram e as rodadas da janela da aba Rodada (D10). Mesmas leituras, na mesma ordem, de antes. */
import { curRodada, isAdmin, upcoming, ymd } from '../dominio/grupo.js';
import { agora } from '../i18n/formatos.js';
import { GB, S, drop, sub, subRaw } from '../nucleo/estado';

/* Data relativa a hoje (AAAA-MM-DD), no relógio do grupo. */
export const dia = (n: number): string => {
  const d = agora();
  d.setDate(d.getDate() + n);
  return ymd(d);
};
/* Rodadas da janela da aba Rodada (D10): as próximas (a partir de ontem, para pegar o jogo que vira a meia-noite) e as recentes
   (até hoje: as últimas 4 mais uma folga para o jogo de hoje). */
export const Q_PROX = { campo: 'date', ordem: 'asc', limite: 12 },
  Q_REC = { campo: 'date', ordem: 'desc', limite: 5 },
  JUNTOS_RODADAS = 20;

/* Avulso que jogou (está nos times) e ainda não tem cadastro: o administrador guarda em avulsos/{id}. */
export function regAvulsos() {
  if (!isAdmin() || !S.loaded.avul || !S.presRid) return;
  const r = S.rod[S.presRid],
    jogou = new Set(r && r.times ? r.times.flatMap(t => t.players) : []),
    avul = S.avul || (S.avul = {});
  Object.entries(S.pres).forEach(([id, p]) => {
    if (jogou.has(id) && p.avulso && p.nome && !S.jog[id] && !avul[id]) {
      const o = { nome: p.nome, pos: p.pos || '', criado: Date.now() };
      avul[id] = o;
      GB.set('avulsos/' + id, o).catch(() => {});
    }
  });
}
/* Contador de avulsos novos pelo link nesta rodada (KAN-89) e vagas ocupadas pelo link (KAN-63). */
export function subLimAv(id: string | null) {
  S.limAv = null;
  S.limVg = null;
  drop('limAv');
  drop('limVg');
  if (!id) return;
  sub('limAv', 'rodadas/' + id + '/limites/avulsos', d => {
    S.limAv = d;
  });
  sub('limVg', 'rodadas/' + id + '/limites/vagas', d => {
    S.limVg = d;
  });
}
export const subLimCfg = () =>
  subRaw('limCfg', 'sistema/limites', d => {
    S.limCfg = d;
  });
/* Respostas ao extra da rodada (KAN-228: churrasco, pizzada…): só lê quando o extra está ligado. */
export function subExtra(r: { id?: string; extra?: unknown } | null | undefined) {
  const id = r && r.extra && r.id ? r.id : null;
  if (S.extRid === id) return;
  S.extRid = id;
  S.ext = {};
  drop('ext');
  if (id)
    sub('ext', 'rodadas/' + id + '/extra', d => {
      S.ext = d || {};
    });
}
/* Presenças da rodada aberta na gestão: troca a assinatura quando a rodada muda. */
export function ensurePres() {
  if (S.route.n === 'admin' && !(S.loaded.rodF && S.loaded.rodP)) return;
  const r = curRodada(),
    id = r ? r.id : null;
  subExtra(r);
  if (S.presRid === id) return;
  S.presRid = id;
  S.pres = {};
  drop('pres');
  if (id)
    sub('pres', 'rodadas/' + id + '/presencas', d => {
      S.pres = d || {};
      regAvulsos();
    });
  subLimAv(id);
}
export function juntarRod() {
  S.rod = Object.assign({}, S.rodP || {}, S.rodF || {});
  regAvulsos();
}
/* Link "próxima rodada" (#/p/{grupo}): quando as rodadas chegam, abre a próxima e lê as presenças e partidas dela. */
export function resolveNext() {
  if (!S.loaded.app || !S.loaded.rods) return;
  const r = upcoming()[0],
    id = r ? r.id : null;
  subExtra(r);
  if (S.route.id !== id || S.presRid !== id) {
    S.route.id = id;
    S.presRid = id;
    S.pres = {};
    drop('pres');
    if (id)
      sub('pres', 'rodadas/' + id + '/presencas', d => {
        S.pres = d || {};
      });
    subLimAv(id);
    S.partsRid = id;
    S.parts = {};
    drop('parts');
    if (id)
      sub('parts', 'rodadas/' + id + '/partidas', d => {
        S.parts = d || {};
      });
  }
}
