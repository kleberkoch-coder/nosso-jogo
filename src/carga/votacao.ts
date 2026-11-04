/* Carga da votação (KAN-225, saiu de rotas.js): votos e trocas da votação aberta na aba (gestão) e o link da votação. */
import { S, SUBS, drop, sub } from '../nucleo/estado';

/* Aba Votação: votos e trocas (KAN-222, só administradores leem) da votação escolhida ou da mais recente. */
export function ensureVotos() {
  const id =
    S.tab === 'votacao'
      ? S.vid || Object.keys(S.vot).sort((a, b) => (S.vot[b].createdAt || 0) - (S.vot[a].createdAt || 0))[0]
      : null;
  if (S.votosVid === id) return;
  S.votosVid = id;
  S.votos = {};
  S.trocas = {};
  drop('votos');
  drop('trocas');
  if (id) {
    sub('votos', 'votacoes/' + id + '/votos', d => {
      S.votos = d || {};
    });
    sub('trocas', 'votacoes/' + id + '/trocas', d => {
      S.trocas = d || {};
    });
  }
}
/* Aba Votação com uma votação antiga: a rodada dela, se não está na janela da aba Rodada. */
export function rodadaDaVotacao() {
  const v = S.vot[S.vid || ''];
  const rid = v && v.rid;
  if (rid && !S.rod[rid] && S.rodXid !== rid) {
    S.rodXid = rid;
    sub('rodX', 'rodadas/' + rid, d => {
      S.rodX = d ? { [rid]: d } : {};
    });
  }
}
/* Link da votação (#/p/{grupo}/v/{votação}): elenco, a votação, a rodada dela e só o voto deste aparelho. */
export function cargaLinkVotacao(vid: string) {
  sub('jog', 'jogadores', d => {
    S.jog = d || {};
  });
  sub('v', 'votacoes/' + vid, d => {
    S.vot = d ? { [vid]: d } : {};
    if (d && !SUBS.rv)
      sub('rv', 'rodadas/' + d.rid, x => {
        S.rod = x ? { [d.rid]: x } : {};
      });
  });
  if (S.user)
    sub('mv', 'votacoes/' + vid + '/votos/' + S.user.uid, d => {
      const keep = S.myVote?.pid;
      S.myVote = d || (keep ? { pid: keep, v: {} } : null);
    });
}
