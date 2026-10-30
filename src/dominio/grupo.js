import { cfg } from './caixa.js';
import { hasPos, posKeys, sport } from './esportes.js';
import { S } from '../nucleo/estado.js';
import { diaSemana } from '../nucleo/util.js';
import { FORMATO, LOCAL, agora } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { endTs, proximasFixas, virtualOf, ymd } from './rodadas-fixas.ts';
import { pode } from './permissoes';
import { faixaTexto } from './rodadas.js';

function gname() {
  return (S.app && S.app.name) || tx('comum.meuGrupo');
}
function rat() {
  return Object.assign({ stars: {}, nivel: {}, sep: [] }, S.rat || {});
}
function lvl(id) {
  const R = S.rat || {};
  const n = R.nivel && R.nivel[id];
  if (n != null) return +n;
  const st = R.stars && R.stars[id];
  return st != null ? st * 2 : 5;
}
const fmtL = v => (+v).toLocaleString(FORMATO, { minimumFractionDigits: +v % 1 ? 1 : 0, maximumFractionDigits: 1 });
function setLvl(a, id, v) {
  a.nivel = a.nivel || {};
  a.nivel[id] = v;
  if (a.stars) delete a.stars[id];
}
function players() {
  return Object.entries(S.jog)
    .map(([id, v]) => Object.assign({ id }, v))
    .filter(p => p.ativo !== false)
    .sort((a, b) => a.name.localeCompare(b.name, LOCAL));
}
function fixos() {
  return cfg().fixos || [];
}
function freq(a) {
  a = a || S.app || {};
  return a.freq || (a.cfg && a.cfg.fixos && a.cfg.fixos.length ? 'fixo' : 'esporadico');
}
function grpAtivo(a) {
  a = a || S.app;
  return !a || a.ativo !== false;
}
const fdia = ts =>
  ts ? new Date(ts).toLocaleDateString(FORMATO, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const normName = x =>
  String(x || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
function dupName(name, except) {
  return Object.entries((S.me && S.me.grupos) || {}).some(
    ([g, v]) => g !== except && normName(v.name) === normName(name)
  );
}
/* Próxima data dos jogos fixos: regra em rodadas-fixas.ts, com teste próprio (D12). */
function virtualFixos() {
  if (!grpAtivo()) return [];
  return proximasFixas(fixos(), S.rod, agora());
}
function virtualFromId(id) {
  const m = /^f-(\d{4}-\d{2}-\d{2})-(\d{4})$/.exec(id || '');
  if (!m) return null;
  const dow = new Date(m[1] + 'T12:00').getDay();
  const fx = fixos().find(f => +f.dow === dow && String(f.ini).replace(':', '') === m[2]);
  return fx ? virtualOf(fx, m[1]) : null;
}
/* Cor do colete gravada à parte (KAN-108): trocar a cor não regrava os times, então não desfaz um sorteio feito ao mesmo tempo. */
function comCores(o) {
  if (!o || !o.cores || !o.times) return o;
  return Object.assign({}, o, {
    times: o.times.map((t, i) => (o.cores[i] != null ? Object.assign({}, t, { c: o.cores[i] }) : t)),
  });
}
function rodById(id) {
  if (!id) return null;
  if (S.rod[id]) return comCores(Object.assign({ id }, S.rod[id]));
  return virtualFixos().find(v => v.id === id) || virtualFromId(id);
}
function rodadas() {
  const docs = Object.entries(S.rod).map(([id, v]) => comCores(Object.assign({ id }, v)));
  const ids = new Set(docs.map(d => d.id));
  return docs
    .concat(virtualFixos().filter(v => !ids.has(v.id)))
    .sort(
      (a, b) =>
        (b.date || '').localeCompare(a.date || '') ||
        (b.time || '').localeCompare(a.time || '') ||
        (b.createdAt || 0) - (a.createdAt || 0)
    );
}
/* "Agora" é o do fuso do grupo (KAN-162): o jogo termina na hora do lugar, para quem abre de qualquer fuso. */
function upcoming() {
  const now = agora().getTime();
  return rodadas()
    .filter(r => !r.cancelada && endTs(r) > now)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}
/* Rodadas mostradas na aba Rodada (D10): as próximas e as últimas 4. */
const ULTIMAS = 4;
function rodadasJanela() {
  const now = agora().getTime(),
    rs = rodadas(),
    fut = rs.filter(r => endTs(r) > now),
    pas = rs.filter(r => endTs(r) <= now).slice(0, ULTIMAS);
  return fut.concat(pas);
}
/* Todas as rodadas do grupo: só carregadas quando o ranking é aberto (S.rodAll). */
function rodadasTodas() {
  if (!S.rodAll) return rodadas();
  return Object.entries(S.rodAll)
    .map(([id, v]) => Object.assign({ id }, v))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));
}
/* Rodadas de um mês (caixa): carregadas sob demanda em S.rodMes. */
function rodadasDoMes(m) {
  const fonte = S.rodMesM === m ? Object.entries(S.rodMes || {}).map(([id, v]) => Object.assign({ id }, v)) : rodadas();
  return fonte.filter(r => (r.date || '').slice(0, 7) === m);
}
/* Ficha de uma rodada que pode estar fora da janela (votação antiga, histórico). */
function rodDoc(id) {
  return comCores(
    S.rod[id] || (S.rodAll || {})[id] || (S.rodX || {})[id] || ((S.hist && S.hist.docs) || {})[id] || null
  );
}
function info(id) {
  for (const fonte of [S.rod, S.rodAll || {}, S.rodX || {}, (S.hist && S.hist.docs) || {}])
    for (const r of Object.values(fonte)) {
      if (r && r.info && r.info[id]) return r.info[id];
    }
  return null;
}
function pname(id) {
  return S.jog[id]?.name || S.avul?.[id]?.nome || S.pres[id]?.nome || info(id)?.n || tx('comum.avulso');
}
function ppos(id) {
  if (!hasPos()) return '';
  const k = S.jog[id]?.pos || S.avul?.[id]?.pos || S.pres[id]?.pos || info(id)?.p;
  if (k && posKeys().includes(k)) return k;
  const ks = posKeys().filter(x => x !== sport().key);
  return ks[Math.floor(ks.length / 2)] || posKeys()[0];
}
function isAvulso(id) {
  return !S.jog[id];
}
function isAdmin() {
  return !!(S.user && !S.user.anon && S.mem);
}
function isOwnerMe() {
  return !!(S.app && S.user && S.app.owner === S.user.uid);
}
/* Recurso do plano do grupo (KAN-119): caixa, votação, histórico, ranking do ano, cobrar e controle de vagas.
   A conta vem da gestão (nucleo/plano.ts), que registra aqui como responder; o link do jogador não usa. */
let provedorRecurso = null,
  provedorSoVer = null;
const definirRecursos = (f, soVer) => {
  provedorRecurso = f;
  provedorSoVer = soVer || null;
};
const recurso = k => (provedorRecurso ? provedorRecurso(k) : true);
/* KAN-204: convidado além do limite de administradores do plano só vê o grupo (nada que grave). */
const soVer = () => (provedorSoVer ? provedorSoVer() : false);
/* Permissão do administrador aberto agora (KAN-201): caixa, notas, elenco ou config. O organizador pode tudo. */
function posso(k) {
  if (!isAdmin() || soVer()) return false;
  if (isOwnerMe()) return true;
  return pode(S.mem, k);
}
function curRodada() {
  const rs = rodadas();
  if (!rs.length) return null;
  if (S.rid) {
    const f = rs.find(r => r.id === S.rid);
    if (f) return f;
  }
  /* Só fixa a escolha automática depois que as rodadas gravadas chegaram: antes disso, um jogo fixo cancelado
     ainda aparece como "virtual" e ficaria escolhido (defeito achado nos testes da v25). */
  const r = upcoming()[0] || rs[0];
  if (S.route.n !== 'admin' || (S.loaded.rodF && S.loaded.rodP)) S.rid = r.id;
  return r;
}
function attendance() {
  const a = Object.entries(S.pres).map(([id, v]) => Object.assign({ id }, v));
  return {
    inn: a
      .filter(x => x.s === 'in')
      .sort((x, y) => x.t - y.t)
      .map(x => x.id),
    out: a.filter(x => x.s === 'out').map(x => x.id),
  };
}

export {
  comCores,
  ULTIMAS,
  attendance,
  curRodada,
  endTs,
  ymd,
  dupName,
  fdia,
  fixos,
  fmtL,
  freq,
  gname,
  grpAtivo,
  isAdmin,
  isAvulso,
  isOwnerMe,
  lvl,
  normName,
  players,
  pname,
  ppos,
  rat,
  rodById,
  rodDoc,
  rodadas,
  rodadasDoMes,
  rodadasJanela,
  rodadasTodas,
  posso,
  definirRecursos,
  recurso,
  soVer,
  setLvl,
  upcoming,
};
