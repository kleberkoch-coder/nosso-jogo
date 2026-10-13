/* Área administrativa do portal (KAN-116): lista de clientes com plano, grupos e último acesso.
   Só para o administrador do portal (ADMINS_PORTAL em src/dominio/planos.ts e adminPortal() nas regras).
   Mostra dados de cadastro e uso. Nunca notas, caixa, Pix ou contatos dos grupos. */
import { catalogo, ehAdminPortal, filtrarClientes, montarClientes, resumoPorPlano } from '../dominio/planos.ts';
import { tx } from '../i18n/index.js';
import { B } from '../nucleo/backend.js';
import { S } from '../nucleo/estado.js';
import { esc, today } from '../nucleo/util.js';
import { LOCAL } from '../i18n/formatos.js';
import { changed } from '../ui/render.js';
import { linhaVersao } from '../nucleo/versao.js';

const dia = ts => ts ? new Date(ts).toLocaleDateString(LOCAL, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const dataIso = s => s ? new Date(s + 'T12:00').toLocaleDateString(LOCAL, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const norm = s => String(s || '').toLowerCase();

/* Carrega tudo de uma vez ao abrir (e no botão Atualizar). Sem permissão (outra conta), mostra o aviso. */
async function carregarPortal() {
  const st = S.portal = Object.assign({ filtro: 'todos', busca: '' }, S.portal || {}, { estado: 'carregando' }); changed();
  try {
    const [contas, grupos, cat] = await Promise.all([B.get('contas'), B.get('grupos'), B.get('sistema/planos').catch(() => null)]);
    const donos = [...new Set(Object.values(grupos || {}).map(g => g && g.owner).filter(Boolean))];
    const emails = {}, ultima = {};
    await Promise.all(donos.filter(u => !(contas[u] && contas[u].email)).map(async u => {
      const gid = Object.keys(grupos).find(k => grupos[k] && grupos[k].owner === u);
      try { const m = await B.get('grupos/' + gid + '/membros/' + u); if (m && m.email) emails[u] = m.email } catch (e) { }
    }));
    await Promise.all(Object.keys(grupos || {}).map(async gid => {
      try { const p = await B.pagina('grupos/' + gid + '/rodadas', { campo: 'date', ate: today(), ordem: 'desc', limite: 1 });
        ultima[gid] = p.itens.length ? p.itens[0][1].date : null } catch (e) { ultima[gid] = null }
    }));
    st.cat = catalogo(cat);
    st.clientes = montarClientes(contas || {}, grupos || {}, emails, ultima, st.cat, Date.now());
    st.estado = 'ok'; st.em = Date.now();
  } catch (e) { console.warn('portal', e); st.estado = e && e.code === 'permission-denied' ? 'negado' : 'erro' }
  changed();
}

function vPortal() {
  if (!ehAdminPortal(S.user && S.user.email)) return semAcesso();
  const st = S.portal || {};
  if (st.estado === 'negado') return semAcesso(true);
  if (st.estado === 'erro') return `<div class="panel empty"><h2>${tx('portal.titulo')}</h2><p class="muted">${tx('portal.erro')}</p><button class="btn" data-a="portalAtualizar">${tx('portal.atualizar')}</button></div>`;
  if (st.estado !== 'ok') return `<div class="empty muted">${tx('comum.carregando')}</div>`;
  const agora = Date.now(), lista = filtrarClientes(st.clientes, st.filtro, '', agora), res = resumoPorPlano(st.clientes);
  const planos = Object.entries(st.cat);
  const opt = (v, l) => `<option value="${v}"${st.filtro === v ? ' selected' : ''}>${esc(l)}</option>`;
  const card = c => {
    const busca = norm(c.email + ' ' + c.nomesGrupos.join(' '));
    const plano = esc(c.planoNome) + (c.ate ? ` · ${tx('portal.ate', { d: dia(c.ate) })}` : '') + (c.vencido ? ` · <span class="tag">${tx('portal.vencido')}</span>` : '');
    const some = st.busca && !busca.includes(norm(st.busca).trim());
    return `<li class="cli" data-busca="${esc(busca)}"${some ? ' hidden' : ''}><div class="pn"><b>${esc(c.email || tx('portal.semEmail'))}</b><br>
      <span class="tag">${plano}</span><br>
      <span class="small muted">${tx('portal.grupos', { a: c.gruposAtivos, i: c.gruposInativos })}${c.nomesGrupos.length ? ': ' + esc(c.nomesGrupos.join(', ')) : ''}</span><br>
      <span class="small muted">${tx('portal.acesso', { d: dia(c.acesso) })} · ${tx('portal.ultimaRodada', { d: dataIso(c.ultimaRodada) })}${c.criada ? ' · ' + tx('portal.desde', { d: dia(c.criada) }) : ''}</span></div></li>`;
  };
  return `<div class="stack"><div class="row between"><h2>${tx('portal.titulo')}</h2><a class="btn sm" href="#/">${tx('portal.voltar')}</a></div>
  <div class="panel"><div class="kpis"><div><div class="l">${tx('portal.clientes')}</div><div class="money">${st.clientes.length}</div></div>
    ${planos.map(([id, p]) => `<div><div class="l">${esc(p.nome)}</div><div class="money">${res[id] || 0}</div></div>`).join('')}</div>
    <p class="small muted" style="margin:12px 0 0">${tx('portal.ajuda')}</p></div>
  <div class="panel"><div class="row" style="gap:8px;flex-wrap:wrap">
    <input class="inp" id="ptq" placeholder="${tx('portal.buscar')}" value="${esc(st.busca)}" style="flex:2;min-width:180px" aria-label="${tx('portal.buscar')}">
    <select class="sel" data-c="portalFiltro" style="flex:1;min-width:160px" aria-label="${tx('portal.filtro')}">${opt('todos', tx('portal.todos'))}${planos.map(([id, p]) => opt('plano:' + id, p.nome)).join('')}${opt('semAcesso30', tx('portal.semAcesso30'))}${opt('vence7', tx('portal.vence7'))}</select>
    <button class="btn" data-a="portalAtualizar">${tx('portal.atualizar')}</button></div>
    <ul class="plist" id="ptlist" style="margin-top:10px">${lista.map(card).join('') || `<li class="muted small">${tx('portal.nenhum')}</li>`}</ul>
    <p class="small muted" id="ptvazio" hidden>${tx('portal.nenhum')}</p></div>
  <p class="small muted">${tx('portal.atualizado', { d: new Date(st.em).toLocaleString(LOCAL) })}</p>${linhaVersao()}</div>`;
}
const semAcesso = negado => `<div class="panel empty auth"><h2>${tx('portal.titulo')}</h2><p class="muted">${tx(negado ? 'portal.negado' : 'portal.semAcesso')}</p><a class="btn" href="#/">${tx('portal.voltar')}</a></div>`;

/* Busca sem redesenhar a tela (o teclado do celular não fecha). */
function filtrarPortalNaTela(q) {
  S.portal.busca = q; const n = norm(q).trim(); let vis = 0;
  document.querySelectorAll('#ptlist li.cli').forEach(li => { const ok = !n || li.dataset.busca.includes(n); li.hidden = !ok; if (ok) vis++ });
  const v = document.getElementById('ptvazio'); if (v) v.hidden = vis > 0 || !document.querySelector('#ptlist li.cli');
}

export { carregarPortal, filtrarPortalNaTela, vPortal };
