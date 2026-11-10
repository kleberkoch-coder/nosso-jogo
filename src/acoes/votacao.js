/* Ações: Votação: criar, encerrar e compartilhar. Fazem parte de ACT (src/acoes.js). */
import { posLabel, sport } from '../dominio/esportes.js';
import { isAvulso, rodById, rodadas } from '../dominio/grupo.js';
import { shareDlg } from '../ui/Compartilhar';
import { B, op } from '../nucleo/backend.js';
import { gravarVotacao } from '../nucleo/partidas.js';
import { GB, S, gp, w } from '../nucleo/estado.js';
import { cfg, ptipo } from '../dominio/caixa.js';
import { ehPadrao, lerParticipa, quemParticipa } from '../dominio/votacao-participa';
import { lerMarcados } from '../ui/QuemParticipa';
import { linkVoto } from '../nucleo/links.js';
import { $, cl, toast, uid } from '../nucleo/util.js';
import { auditoria, tally, votosQueValem } from '../dominio/votacao-contagem';
import { participacao } from '../dominio/votacao-resultado';
import { jaVotaram, loteVotoRapido, quemVota } from '../dominio/votacao-rapida';
import { R } from '../telas/VotacaoRapida';
import { pname, rodDoc } from '../dominio/grupo.js';
import { LOCAL } from '../i18n/formatos.js';
import { baixarPlanilha, mandarResultado } from '../telas/VotacaoZap';
import { montarNovaVotacao } from '../telas/Votacao';
import { confirmou, dlg, openDlg, val } from '../ui/dialogos.js';
import { changed } from '../ui/render.js';
import { ACT } from '../acoes.js';
import { tx } from '../i18n/index.js';

/* Tipo de cada um para a votação (KAN-230): avulso (fora do elenco), diarista ou mensalista (isento conta junto). */
const tipoNaVotacao = id => (isAvulso(id) ? 'avulso' : ptipo(id) === 'diarista' ? 'diarista' : 'mensalista');

/* KAN-254: votação rápida (telas/VotacaoRapida.tsx). */
const rapida = (etapa, pid = '') => {
  Object.assign(R, { etapa, pid, v: {} });
  changed();
  window.scrollTo(0, 0);
  const t = document.getElementById('votRapida');
  if (t) t.scrollTop = 0;
};

const acoes = {
  rapidaAbrir: () => {
    R.on = true;
    rapida('quem');
  },
  rapidaSair: el => {
    if (
      confirmou(el, {
        titulo: tx('rapida.sairTitulo'),
        texto: tx('rapida.sairTexto'),
        acao: tx('rapida.sairAcao'),
      }) !== 'sim'
    )
      return;
    R.on = false;
    rapida('quem');
  },
  rapidaQuem: el => {
    const pid = el.dataset.p;
    /* Já votou (pelo link ou aqui): pode votar de novo; o voto anterior não aparece para ninguém. */
    if (
      jaVotaram(S.votos).has(pid) &&
      confirmou(el, {
        titulo: tx('rapida.jaVotouTitulo', { nome: pname(pid) }),
        texto: tx('rapida.jaVotouTexto'),
        acao: tx('rapida.votarDeNovo'),
      }) !== 'sim'
    )
      return;
    rapida('votar', pid);
  },
  rapidaEscolher: el => {
    const c = el.dataset.c2,
      p = el.dataset.p;
    R.v = Object.assign({}, R.v, { [c]: R.v[c] === p ? '' : p });
    changed();
  },
  rapidaVoltar: () => rapida('quem'),
  rapidaProximo: () => rapida('quem'),
  rapidaConfirmar: () => {
    const v = S.vot[S.vid];
    if (!v || !R.pid) return;
    const ops = loteVotoRapido(
      'votacoes/' + S.vid + '/votos/',
      S.votos,
      R.pid,
      R.v,
      Date.now(),
      v.cats.map(c => c.id),
      op
    );
    if (!ops) return toast(tx('rapida.escolhaUm'));
    const g = w(GB.lote(ops));
    /* Sem sinal, o voto fica na fila do aparelho e sobe sozinho: depois de alguns segundos a tela segue em frente. */
    return Promise.race([g, new Promise(ok => setTimeout(ok, 4000))]).then(
      () => rapida('ok'),
      () => {}
    );
  },
  /* KAN-195: a janela é um componente (telas/Votacao.tsx). */
  newVote: () => {
    const rs = rodadas().filter(r => r.times);
    if (!rs.length) return;
    openDlg('novaVotRaiz');
    dlg.setAttribute('aria-labelledby', 'novaVotTitulo');
    montarNovaVotacao(rs);
  },
  saveVote: async () => {
    const sel = [...dlg.querySelectorAll('.vc:checked')].map(x => x.value),
      cats = [];
    if (sel.includes('best')) cats.push({ id: 'best', name: tx('votacao.catMelhor'), pos: null, neg: false });
    if (sel.includes('gk') && !sel.includes('pos') && sport().key)
      cats.push({
        id: 'gk',
        name: tx('votacao.catMelhorPos', { pos: posLabel(sport().key).toLowerCase() }),
        pos: sport().key,
        neg: false,
      });
    if (sel.includes('pos'))
      sport().pos.forEach(([k, l]) =>
        cats.push({ id: 'p' + k, name: tx('votacao.catMelhorDe', { pos: l.toLowerCase() }), pos: k, neg: false })
      );
    if (val('vx')) cats.push({ id: 'x' + uid(), name: val('vx'), pos: null, neg: false });
    if (sel.includes('worst')) cats.push({ id: 'worst', name: tx('votacao.nomeBagre'), pos: null, neg: true });
    if (!cats.length) {
      toast(tx('votacao.escolhaCategoria'));
      return;
    }
    const id = B.newId(),
      rid = val('vr'),
      r = rodById(rid) || {},
      o = {
        rid,
        rdate: r.date || '',
        title: val('vt') || tx('votacao.semTitulo'),
        cats,
        open: true,
        selfVote: $('#vsf').checked,
        createdAt: Date.now(),
      };
    /* KAN-230: quem participa (vota e pode ser votado). Fora do padrão, a lista vai gravada na votação, porque o
       link não conhece o tipo de cada jogador (é privado). Os confirmados vêm da presença daquela rodada. */
    const part = $('#vpart') ? lerMarcados('vpart') : lerParticipa((cfg() || {}).votPart);
    if (!ehPadrao(part)) {
      const pres = part.fora
        ? S.presRid === rid
          ? S.pres
          : await B.get(gp('rodadas/' + rid + '/presencas')).catch(() => ({}))
        : {};
      const confirmados = Object.entries(pres || {})
        .filter(([, p]) => p && p.s === 'in')
        .sort((a, b) => (a[1].t || 0) - (b[1].t || 0))
        .map(([pid]) => pid);
      o.part = part;
      o.quem = quemParticipa(r.times, confirmados, tipoNaVotacao, part);
      if (!o.quem.length) {
        toast(tx('votpart.ninguem'));
        return;
      }
    }
    S.vot[id] = o;
    S.vid = id;
    changed();
    w(GB.set('votacoes/' + id, o));
    /* A janela troca para o link da votação; não fecha ao terminar de salvar. */ shareDlg(
      tx('votacao.linkTitulo'),
      `🗳️ *${o.title}*\n` + tx('votacao.voteAqui', { link: linkVoto(id) })
    );
  },
  toggleVote: () => {
    const antes = S.vot[S.vid],
      v = cl(antes);
    if (v.open) {
      v.open = false;
      v.resultado = tally(v, S.votos);
      /* KAN-257: quantos votaram de quantos podiam, para o link encerrado mostrar (o link não lê os votos). */
      const pt = participacao(votosQueValem(S.votos), quemVota(v.quem, (rodDoc(v.rid) || {}).times, pname, LOCAL));
      v.votaram = pt.n;
      v.podiam = pt.de;
    } else v.open = true;
    S.vot[S.vid] = v;
    return gravarVotacao(S.vid, antes, v);
  },
  delVote: el => {
    if (
      confirmou(el, {
        titulo: tx('votacao.excluirTitulo'),
        texto: tx('votacao.excluirTexto'),
        acao: tx('votacao.excluirAcao'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    const vid = S.vid,
      antes = S.vot[vid];
    Object.keys(S.votos).forEach(u => GB.del('votacoes/' + vid + '/votos/' + u));
    /* KAN-222: as trocas (auditoria) saem junto. */
    Object.keys(S.trocas || {}).forEach(t => GB.del('votacoes/' + vid + '/trocas/' + t));
    delete S.vot[vid];
    S.vid = null;
    return gravarVotacao(vid, antes, null);
  },
  shareVote: () => {
    const v = S.vot[S.vid];
    /* KAN-231: encerrada, os mais votados de cada categoria e, se o administrador quiser, quem votou em quem. */
    if (!v.open) return mandarResultado(v, S.votos);
    shareDlg(tx('votacao.semTitulo'), `🗳️ *${v.title}*\n` + tx('votacao.voteAqui', { link: linkVoto(S.vid) }));
  },
  /* KAN-231: planilha de "Quem votou" (só administradores veem a aba). */
  baixarVotos: () => {
    const v = S.vot[S.vid];
    if (!v) return;
    const linhas = auditoria(
      Object.fromEntries(
        Object.entries(S.votos).map(([k, d]) => [
          k,
          d && d.em != null && typeof d.em !== 'number' ? { ...d, em: d.em.toMillis ? d.em.toMillis() : null } : d,
        ])
      ),
      {}
    );
    if (!linhas.length) return toast(tx('aud.nenhum'));
    baixarPlanilha(v, linhas);
    toast(tx('votzap.baixada'));
  },
};

export { acoes };
