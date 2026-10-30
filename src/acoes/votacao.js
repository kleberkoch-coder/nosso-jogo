/* Ações: Votação: criar, encerrar e compartilhar. Fazem parte de ACT (src/acoes.js). */
import { posLabel, sport } from '../dominio/esportes.js';
import { pname, rodById, rodadas } from '../dominio/grupo.js';
import { shareDlg } from '../ui/Compartilhar';
import { B } from '../nucleo/backend.js';
import { gravarVotacao } from '../nucleo/partidas.js';
import { GB, S, w } from '../nucleo/estado.js';
import { linkVoto } from '../nucleo/links.js';
import { $, cl, toast, uid } from '../nucleo/util.js';
import { tally } from '../dominio/votacao';
import { montarNovaVotacao } from '../telas/Votacao';
import { confirmou, dlg, openDlg, val } from '../ui/dialogos.js';
import { changed } from '../ui/render.js';
import { ACT } from '../acoes.js';
import { tx } from '../i18n/index.js';

const acoes = {
  /* KAN-195: a janela é um componente (telas/Votacao.tsx). */
  newVote: () => {
    const rs = rodadas().filter(r => r.times);
    if (!rs.length) return;
    openDlg('<div id="novaVotRaiz"></div>');
    dlg.setAttribute('aria-labelledby', 'novaVotTitulo');
    montarNovaVotacao(rs);
  },
  saveVote: () => {
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
      o = {
        rid: val('vr'),
        rdate: (rodById(val('vr')) || {}).date || '',
        title: val('vt') || tx('votacao.semTitulo'),
        cats,
        open: true,
        selfVote: $('#vsf').checked,
        createdAt: Date.now(),
      };
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
    delete S.vot[vid];
    S.vid = null;
    return gravarVotacao(vid, antes, null);
  },
  shareVote: () => {
    const v = S.vot[S.vid];
    let t = `🗳️ *${v.title}*\n`;
    if (v.open) t += tx('votacao.voteAqui', { link: linkVoto(S.vid) });
    else
      t +=
        '\n' +
        v.cats
          .map(
            c =>
              `🏅 ${c.name}: ${(v.resultado?.[c.id]?.winners || []).map(pname).join(tx('votacao.e')) || tx('votacao.semVotosCurto')}`
          )
          .join('\n');
    shareDlg(tx('votacao.semTitulo'), t);
  },
};

export { acoes };
