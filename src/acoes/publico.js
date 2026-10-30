/* Ações: Link público (jogador sem conta): presença e voto. Fazem parte de ACT (src/acoes.js). */
import { isAvulso, normName, players, pname, rodById } from '../dominio/grupo.js';
import { tx } from '../i18n/index.js';
import { semConexao } from '../eventos.js';
import { B } from '../nucleo/backend.js';
import { avulsosEsgotados, limite } from '../dominio/limites.ts';
import { precisaVaga, situacao } from '../dominio/vagas.ts';
import { setPres } from '../nucleo/edicoes.js';
import { GB, S, w } from '../nucleo/estado.js';
import { $, cl, esc, toast } from '../nucleo/util.js';
import { MEK, myLocal } from '../telas/publico-rodada.js';
import { closeDlg, dlg, openDlg, posField, val } from '../ui/dialogos.js';
import { changed } from '../ui/render.js';
import { ACT } from '../acoes.js';

/* KAN-63: sem vaga aberta, quem precisa de vaga não entra; o aviso diz por quê (o Firebase também recusa). */
function semVaga(id) {
  const r = rodById(S.route.id),
    v = situacao(!!((S.app || {}).cfg || {}).vagasCtrl, r && r.vagas, S.limVg);
  if (v.podeEntrar || !precisaVaga((S.jog || {})[id]) || (S.pres[id] && S.pres[id].s === 'in')) return false;
  closeDlg();
  toast(tx(v.cheia ? 'vagaslink.esgotadas' : 'vagaslink.fechadas'));
  return true;
}
const acoes = {
  /* KAN-184: "Tentar de novo" quando o link não carregou. */
  recarregar: () => location.reload(),
  /* público */
  pubMark: el => {
    const r = rodById(S.route.id);
    if (!r || r.locked) return;
    const id = el.dataset.p,
      cur = S.pres[id] || {};
    if (!S.user) {
      semConexao();
      return;
    }
    if (el.dataset.v === 'in' && semVaga(id)) return;
    try {
      localStorage.setItem(MEK, id);
    } catch (e) {}
    setPres(
      S.route.id,
      id,
      Object.assign(isAvulso(id) ? { nome: cur.nome, avulso: true, pos: cur.pos } : {}, { s: el.dataset.v })
    )
      .then(() => {
        changed();
        toast(tx(el.dataset.v === 'in' ? 'publico.confirmado' : 'publico.okNaoVai', { nome: pname(id) }));
      })
      .catch(() => {});
  },
  /* KAN-127: o que o jogador digitou na busca já vem no nome. */
  pubAdd: el => {
    openDlg(`<h3>${tx('publico.addTitulo')}</h3><label class="f"><span>${tx('publico.addNome')}</span><input class="inp" id="anm" maxlength="40" autocomplete="off" value="${esc((el && el.dataset.v) || '')}"></label>
    <div id="avsug"></div><div id="avnew">${posField('apos')}</div>
    <div class="dlg-f"><button class="btn" data-a="close">${tx('comum.cancelar')}</button><button class="btn primary" data-a="pubSaveAdd">${tx('publico.addConfirmar')}</button></div>`);
    if (el && el.dataset.v) $('#anm')?.dispatchEvent(new Event('input', { bubbles: true }));
  },
  pubPick: el => {
    const id = el.dataset.p,
      a = S.avul[id];
    if (!S.user) {
      semConexao();
      return;
    }
    if (semVaga(id)) return;
    if (!S.pres[id] && avulsosEsgotados(S.limAv, S.limCfg)) {
      closeDlg();
      toast(tx('limite.avulsosPublico'));
      return;
    }
    closeDlg();
    try {
      localStorage.setItem(MEK, id);
    } catch (e) {}
    return setPres(S.route.id, id, { s: 'in', nome: a.nome, avulso: true, pos: a.pos || '' })
      .then(() => {
        changed();
        toast(tx('publico.confirmado', { nome: a.nome }));
      })
      .catch(() => {});
  },
  pubSaveAdd: () => {
    const n = val('anm');
    if (n.length < 2) {
      toast(tx('publico.digiteNome'));
      return;
    }
    if (!S.user) {
      semConexao();
      return;
    }
    const el = players().find(p => normName(p.name) === normName(n));
    if (el) {
      closeDlg();
      toast(tx('publico.jaNaLista', { nome: el.name }));
      return;
    }
    const same = Object.entries(S.avul || {}).find(([, a]) => normName(a.nome) === normName(n));
    if (same) return ACT.pubPick({ dataset: { p: same[0] } });
    if (semVaga('')) return;
    if (avulsosEsgotados(S.limAv, S.limCfg)) {
      closeDlg();
      toast(tx('limite.avulsosPublico'));
      return;
    }
    const id = B.newId(),
      pos = val('apos');
    closeDlg();
    try {
      localStorage.setItem(MEK, id);
    } catch (e) {}
    return setPres(S.route.id, id, { s: 'in', nome: n, avulso: true, pos })
      .then(() => {
        changed();
        toast(tx('publico.confirmado', { nome: n }));
      })
      .catch(() => {});
  },
  pubVote: el => {
    const me = S.myVote?.pid || myLocal();
    if (!me || !S.user) return;
    const d = cl(S.myVote) || { v: {} };
    d.pid = me;
    d.v = d.v || {};
    d.v[el.dataset.c2] = el.dataset.p;
    d.t = Date.now();
    S.myVote = d;
    changed();
    w(GB.set('votacoes/' + S.route.id + '/votos/' + S.user.uid, d));
  },
};

export { acoes };
