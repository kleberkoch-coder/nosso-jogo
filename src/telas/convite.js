import { sport, sportName } from '../dominio/esportes.js';
import { gname } from '../dominio/grupo.js';
import { S } from '../nucleo/estado.js';
import { $, esc, main } from '../nucleo/util.js';
import { entrarPronto } from '../nucleo/carga-entrar';

/* ---------- Convite para administrador ---------- */
function invHead() {
  const n = S.app ? gname() : '';
  return `<h2 style="margin:0">${n ? 'Você foi convidado para administrar ' + esc(n) : 'Convite para administrar um grupo'}</h2>
  ${S.app ? `<p class="muted small" style="margin:6px 0 0">${sport().e} ${esc(sportName())}</p>` : ''}
  <p class="small muted" style="margin:8px 0 0">${S.loaded.app && !S.app ? 'Este grupo não existe mais. Peça um novo link ao organizador.' : 'Crie sua conta ou entre para aceitar. Jogadores não precisam de conta, só quem administra.'}</p>`;
}
function renderInvite() {
  const logged = !!(S.user && !S.user.anon);
  if (!logged) {
    /* Mantém o que já foi digitado quando o nome do grupo chega depois. */
    if ($('#le') && $('#invHead') && main.dataset.inv === S.authMode) {
      $('#invHead').innerHTML = invHead();
      return;
    }
    main.dataset.inv = S.authMode;
    main.innerHTML = entrarPronto().vAuth(`<div id="invHead">${invHead()}</div>`);
    return;
  }
  main.dataset.inv = '';
  if (!S.loaded.app || !S.loaded.mem) {
    main.innerHTML = '<div class="empty muted">Carregando…</div>';
    return;
  }
  if (!S.app) {
    main.innerHTML =
      '<div class="panel empty auth"><h2>Grupo não encontrado</h2><p class="muted">Ele pode ter sido excluído. Peça um novo link ao organizador.</p><a class="btn" href="#/">Meus grupos</a></div>';
    return;
  }
  if (S.mem) {
    main.innerHTML = `<div class="panel empty auth"><h2>Você já administra ${esc(gname())}</h2><p class="muted">Não precisa aceitar de novo.</p><a class="btn primary" href="#/g/${esc(S.gid)}">Abrir o grupo</a></div>`;
    return;
  }
  main.innerHTML = `<div class="auth"><div class="panel"><h2 style="margin:0">Administrar ${esc(gname())}</h2>
    <p class="muted small" style="margin:6px 0 0">${sport().e} ${esc(sportName())}</p>
    <p style="margin:14px 0 0">Ao aceitar, você passa a cuidar da presença, do sorteio, do placar, do caixa e das notas deste grupo junto com o organizador.</p>
    <p class="small muted" style="margin:10px 0 16px">Você está usando a conta ${esc(S.user.email)}.</p>
    <button class="btn primary" style="width:100%;justify-content:center" data-a="acceptInv">Aceitar convite</button>
    <p class="small muted" style="text-align:center;margin:12px 0 0">Não é você? <button class="linkbtn" data-a="invSwitch">Entrar com outra conta</button></p></div></div>`;
}

export { renderInvite };
