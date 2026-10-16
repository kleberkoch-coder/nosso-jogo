import { gname, grpAtivo, pname } from '../dominio/grupo.js';
import { LOCAL } from '../i18n/formatos.js';
import { tp, tx } from '../i18n/index.js';
import { S } from '../nucleo/estado.js';
import { $, esc, fdate, main } from '../nucleo/util.js';
import { myLocal } from './publico-rodada.js';
import { candidates } from './votacao.js';

/* ---------- Página pública de votação ---------- */
function renderPublicVoto() {
  $('#tabsnav').hidden = true;
  $('#topright').replaceChildren();
  $('#gsub').textContent = tx('voto.subtitulo');
  const v = S.vot[S.route.id];
  if (!S.loaded.v || !S.loaded.app) {
    main.innerHTML = `<div class="empty muted">${tx('comum.carregando')}</div>`;
    return;
  }
  if (!grpAtivo()) {
    main.innerHTML = `<div class="panel empty"><h2>${esc(gname())}</h2><p class="muted">${tx('voto.grupoInativo')}</p></div>`;
    return;
  }
  if (!v) {
    main.innerHTML = `<div class="panel empty"><h2>${tx('voto.naoEncontrada')}</h2><p class="muted">${tx('voto.naoEncontradaTexto')}</p></div>`;
    return;
  }
  const r = S.rod[v.rid],
    my = S.myVote || {},
    me = my.pid || myLocal();
  const rodadaDe = r ? tx('voto.rodadaDe', { data: fdate(r.date) }) : '';
  if (!v.open) {
    const res = v.resultado || {};
    main.innerHTML = `<div class="stack"><div class="panel"><h2>${esc(v.title)}</h2><p class="muted small">${rodadaDe}${tx('voto.encerrada')}</p></div>
    ${v.cats
      .map(c => {
        const R = res[c.id] || { winners: [], counts: {} };
        return `<div class="panel"><h3>${esc(c.name)}</h3><p style="font:800 28px var(--display);margin:0">${R.winners.map(id => esc(pname(id))).join(tx('voto.e')) || `<span class="muted small">${tx('voto.semVotos')}</span>`}</p>${R.winners.length ? `<p class="small muted">${tp('voto.votos', R.counts[R.winners[0]])}</p>` : ''}</div>`;
      })
      .join('')}</div>`;
    return;
  }
  const played = r && r.times ? r.times.flatMap(t => t.players) : [];
  const voters = [...new Set(played)].sort((a, b) => pname(a).localeCompare(pname(b), LOCAL));
  main.innerHTML = `<div class="stack"><div class="panel"><h2>${esc(v.title)}</h2><p class="muted small">${rodadaDe}${tx('voto.regra')}</p>
    <label class="f" style="margin:12px 0 0"><span>${tx('voto.quemEVoce')}</span><select class="sel" data-c="voter"><option value="">${tx('voto.escolhaNome')}</option>${voters.map(id => `<option value="${id}" ${id === me ? 'selected' : ''}>${esc(pname(id))}</option>`).join('')}</select></label></div>
  ${
    me
      ? v.cats
          .map(c => {
            const cand = candidates(v, c).filter(id => v.selfVote || id !== me);
            return `<div class="panel"><h3>${esc(c.name)}</h3><div class="vgrid">${cand.map(id => `<button class="opt" aria-pressed="${(my.v || {})[c.id] === id}" data-a="pubVote" data-c2="${c.id}" data-p="${id}">${esc(pname(id))}</button>`).join('') || `<span class="muted small">${tx('voto.semCandidatos')}</span>`}</div></div>`;
          })
          .join('') + `<p class="small muted">${Object.keys(my.v || {}).length ? tx('voto.registrado') : ''}</p>`
      : ''
  }</div>`;
}

export { renderPublicVoto };
