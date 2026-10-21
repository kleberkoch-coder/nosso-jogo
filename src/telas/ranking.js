import { tx } from '../i18n/index.js';
import { col, sport, tnJogo } from '../dominio/esportes.js';
import { pname, rodById } from '../dominio/grupo.js';
import { placares, ranking } from '../dominio/resumos.ts';
import { S } from '../nucleo/estado.js';
import { esc, fdate, fmonth, today } from '../nucleo/util.js';

/* ---------- Ranking (D11, KAN-87) ----------
   Soma as fichas de resumo do período: o ano lê até 12 fichas, o mês lê 1.
   Nada de ler todas as partidas do grupo. */
function anoRank() {
  return S.rankAno || today().slice(0, 4);
}
function docsDoPeriodo() {
  const m = S.rankMes || '';
  return Object.values(S.res || {}).filter(d => d && d.mes && (!m || d.mes.slice(5, 7) === m));
}
function periodoRecalc() {
  const a = anoRank(),
    m = S.rankMes || '';
  return a === 'todos' ? 'todos' : m ? a + '-' + m : a;
}

function vRanking() {
  const a = anoRank(),
    anoAtual = +today().slice(0, 4),
    anos = [anoAtual, anoAtual - 1, anoAtual - 2].map(String);
  const filtros = `<div class="row"><select class="sel" style="width:auto" data-c="rankAno" aria-label="${tx('rank.ano')}">${anos.map(x => `<option value="${x}" ${x === a ? 'selected' : ''}>${x}</option>`).join('')}<option value="todos" ${a === 'todos' ? 'selected' : ''}>${tx('rank.todosAnos')}</option></select>
    ${
      a === 'todos'
        ? ''
        : `<select class="sel" style="width:auto" data-c="rankMes" aria-label="${tx('rank.mes')}"><option value="">${tx('rank.anoInteiro')}</option>${Array.from(
            { length: 12 },
            (_, i) => String(i + 1).padStart(2, '0')
          )
            .map(
              m =>
                `<option value="${m}" ${m === (S.rankMes || '') ? 'selected' : ''}>${esc(fmonth(a + '-' + m).replace(/\s*(de\s*)?\d{4}$/, ''))}</option>`
            )
            .join('')}</select>`
    }</div>`;
  const cols = [
    ['pts', 'Pts'],
    ['j', 'J'],
    ['v', 'V'],
    ['e', 'E'],
    ['d', 'D'],
    ['ap', 'Aprov.'],
    ['gols', sport().word],
    ['mvp', 'Destaques'],
    ['bagre', 'Bagre'],
  ];
  const k = S.rankSort,
    topo = `<div class="row between"><h2>Ranking</h2><label class="row small muted">Ordenar por <select class="sel" style="width:auto" data-c="rank">${cols.map(([c, l]) => `<option value="${c}" ${c === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>${filtros}`;
  if (((S.migr || {}).v || 0) < 18)
    return `<div class="stack">${topo}<div class="panel empty"><p class="muted">${tx('resumo.preparando')}</p></div></div>`;
  if (!S.loaded.res) return `<div class="stack">${topo}<div class="empty muted">${tx('comum.carregando')}</div></div>`;
  const docs = docsDoPeriodo(),
    st = ranking(docs);
  st.sort((x, y) => y[k] - x[k] || y.pts - x.pts || y.gols - x.gols);
  const rs = placares(docs);
  return `<div class="stack">${topo}
  ${
    st.length
      ? `<div class="panel tbl"><table><thead><tr><th>#</th><th>Jogador</th>${cols.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>
  ${st.map((x, i) => `<tr class="${i === 0 ? 'lead' : ''}"><td>${i + 1}</td><td>${esc(pname(x.id))}</td><td class="pts">${x.pts}</td><td>${x.j}</td><td>${x.v}</td><td>${x.e}</td><td>${x.d}</td><td>${x.ap}%</td><td>${x.gols}</td><td>${x.mvp}</td><td>${x.bagre}</td></tr>`).join('')}</tbody></table>
  <p class="small muted" style="margin-top:8px">Vitória 3 pts, empate 1. Destaques e bagres vêm das votações encerradas.</p></div>`
      : `<div class="panel empty"><h2>${tx('rank.semPartidas')}</h2><p class="muted">${tx('rank.semPartidasTexto')}</p></div>`
  }
  ${rs.length ? `<div class="panel"><h3>Histórico</h3><ul class="plist wrap">${rs.map(r => `<li><b style="min-width:110px">${fdate(r.date)}</b><span class="small muted pn">${r.jogos.map(m => `<span class="dot" style="background:${col(m.ca).c}"></span> ${tnJogo(m, 'a', (rodById(r.rid) || {}).times)} ${m.ga}×${m.gb} ${tnJogo(m, 'b', (rodById(r.rid) || {}).times)}`).join(' · ')}</span></li>`).join('')}</ul></div>` : ''}
  <div class="row small muted" style="justify-content:space-between"><span>${tx('resumo.ajuda')}</span><button class="btn sm" data-a="recalc" data-v="${periodoRecalc()}">${tx('resumo.recalcular')}</button></div></div>`;
}

export { anoRank, vRanking };
