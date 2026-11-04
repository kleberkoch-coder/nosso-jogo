/* Carga do link da avaliação (KAN-214; KAN-225, saiu de rotas.js): o elenco (nome e posição), a avaliação e só as
   notas deste aparelho. */
import { S, sub } from '../nucleo/estado';

export function cargaLinkAvaliacao(aid: string) {
  sub('jog', 'jogadores', d => {
    S.jog = d || {};
  });
  sub('av', 'avaliacoes/' + aid, d => {
    S.av = d || null;
  });
  if (S.user)
    sub('ma', 'avaliacoes/' + aid + '/notas/' + S.user.uid, d => {
      S.minhaAv = d || null;
    });
}
