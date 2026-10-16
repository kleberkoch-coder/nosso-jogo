/* Portal do Nosso Jogo (KAN-116): site separado do app dos clientes, só para a administração.
   - Sem criação de conta: só "Entrar com o Google".
   - Quem acessa é decidido nas regras do Firebase (adminPortal(): identificadores de contas Google, incluídos à mão).
   - Mostra dados de cadastro e de uso. Nunca notas, caixa, Pix ou contatos dos grupos. */
import { catalogo, filtrarClientes, montarClientes, resumoPorPlano } from '../dominio/planos.ts';
import { tx } from './textos.js';
import { LOCAL } from '../i18n/formatos.js';
import { esc, today } from '../nucleo/util.js';

const P = {
  B: null,
  user: undefined,
  estado: 'inicio',
  filtro: 'todos',
  busca: '',
  clientes: [],
  cat: null,
  em: 0,
  erro: '',
};
const $ = s => document.querySelector(s);
const dia = ts =>
  ts ? new Date(ts).toLocaleDateString(LOCAL, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const dataIso = s =>
  s ? new Date(s + 'T12:00').toLocaleDateString(LOCAL, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const norm = s => String(s || '').toLowerCase();

async function carregar() {
  /* Ao atualizar, a lista continua na tela e só o botão mostra o carregando (padrão do app). */
  const B = P.B;
  if (P.estado !== 'ok') {
    P.estado = 'carregando';
    desenhar();
  }
  try {
    const [contas, grupos, cat] = await Promise.all([
      B.get('contas'),
      B.get('grupos'),
      B.get('sistema/planos').catch(() => null),
    ]);
    const donos = [
      ...new Set(
        Object.values(grupos || {})
          .map(g => g && g.owner)
          .filter(Boolean)
      ),
    ];
    const emails = {},
      ultima = {};
    await Promise.all(
      donos
        .filter(u => !(contas[u] && contas[u].email))
        .map(async u => {
          const gid = Object.keys(grupos).find(k => grupos[k] && grupos[k].owner === u);
          try {
            const m = await B.get('grupos/' + gid + '/membros/' + u);
            if (m && m.email) emails[u] = m.email;
          } catch (e) {}
        })
    );
    await Promise.all(
      Object.keys(grupos || {}).map(async gid => {
        try {
          const p = await B.pagina('grupos/' + gid + '/rodadas', {
            campo: 'date',
            ate: today(),
            ordem: 'desc',
            limite: 1,
          });
          ultima[gid] = p.itens.length ? p.itens[0][1].date : null;
        } catch (e) {
          ultima[gid] = null;
        }
      })
    );
    P.cat = catalogo(cat);
    P.clientes = montarClientes(contas || {}, grupos || {}, emails, ultima, P.cat, Date.now());
    P.estado = 'ok';
    P.em = Date.now();
  } catch (e) {
    console.warn('portal', e);
    P.estado = e && e.code === 'permission-denied' ? 'negado' : 'erro';
  }
  desenhar();
}

function vEntrar() {
  return `<div class="panel empty auth"><h2>${tx('portal.titulo')}</h2><p class="muted">${tx('portal.entrarAjuda')}</p>
    <button class="btn primary" data-p="google">${tx('portal.entrarGoogle')}</button><p class="err" id="perr">${esc(P.erro)}</p></div>`;
}
function vNegado() {
  const u = P.user || {};
  return `<div class="panel empty auth"><h2>${tx('portal.titulo')}</h2><p class="muted">${tx('portal.negado')}</p>
    <p class="small">${tx('portal.seuId')}</p><p><code id="puid" class="uid">${esc(u.uid || '')}</code></p>
    <div class="row" style="justify-content:center;gap:8px"><button class="btn" data-p="copiar">${tx('portal.copiarId')}</button><button class="btn" data-p="sair">${tx('portal.sair')}</button></div></div>`;
}
function vLista() {
  const agora = Date.now(),
    lista = filtrarClientes(P.clientes, P.filtro, '', agora),
    res = resumoPorPlano(P.clientes),
    planos = Object.entries(P.cat);
  const opt = (v, l) => `<option value="${v}"${P.filtro === v ? ' selected' : ''}>${esc(l)}</option>`;
  const q = norm(P.busca).trim();
  const card = c => {
    const busca = norm(c.email + ' ' + c.nomesGrupos.join(' '));
    const plano =
      esc(c.planoNome) +
      (c.ate ? ` · ${tx('portal.ate', { d: dia(c.ate) })}` : '') +
      (c.vencido ? ` · <span class="tag">${tx('portal.vencido')}</span>` : '');
    return `<li class="cli" data-busca="${esc(busca)}"${q && !busca.includes(q) ? ' hidden' : ''}><div class="pn"><b>${esc(c.email || tx('portal.semEmail'))}</b><br>
      <span class="tag">${plano}</span><br>
      <span class="small muted">${tx('portal.grupos', { a: c.gruposAtivos, i: c.gruposInativos })}${c.nomesGrupos.length ? ': ' + esc(c.nomesGrupos.join(', ')) : ''}</span><br>
      <span class="small muted">${tx('portal.acesso', { d: dia(c.acesso) })} · ${tx('portal.ultimaRodada', { d: dataIso(c.ultimaRodada) })}${c.criada ? ' · ' + tx('portal.desde', { d: dia(c.criada) }) : ''}</span></div></li>`;
  };
  return `<div class="stack">
  <div class="panel"><div class="kpis"><div><div class="l">${tx('portal.clientes')}</div><div class="money">${P.clientes.length}</div></div>
    ${planos.map(([id, p]) => `<div><div class="l">${esc(p.nome)}</div><div class="money">${res[id] || 0}</div></div>`).join('')}</div>
    <p class="small muted" style="margin:12px 0 0">${tx('portal.ajuda')}</p></div>
  <div class="panel"><div class="row" style="gap:8px;flex-wrap:wrap">
    <input class="inp" id="ptq" placeholder="${tx('portal.buscar')}" value="${esc(P.busca)}" style="flex:2;min-width:180px" aria-label="${tx('portal.buscar')}">
    <select class="sel" id="ptf" style="flex:1;min-width:160px" aria-label="${tx('portal.filtro')}">${opt('todos', tx('portal.todos'))}${planos.map(([id, p]) => opt('plano:' + id, p.nome)).join('')}${opt('semAcesso30', tx('portal.semAcesso30'))}${opt('vence7', tx('portal.vence7'))}</select>
    <button class="btn" data-p="atualizar">${tx('portal.atualizar')}</button></div>
    <ul class="plist" id="ptlist" style="margin-top:10px">${lista.map(card).join('') || `<li class="muted small">${tx('portal.nenhum')}</li>`}</ul></div>
  <p class="small muted">${tx('portal.atualizado', { d: new Date(P.em).toLocaleString(LOCAL) })}</p></div>`;
}

function desenhar() {
  const m = $('#pmain'),
    u = P.user,
    logado = !!(u && !u.anon);
  $('#ptopo').innerHTML = logado
    ? `<span class="small">${esc(u.email || '')}</span><button class="chip" data-p="sair">${tx('portal.sair')}</button>`
    : '';
  m.innerHTML =
    P.user === undefined
      ? `<div class="empty muted">${tx('comum.carregando')}</div>`
      : !logado
        ? vEntrar()
        : P.estado === 'negado'
          ? vNegado()
          : P.estado === 'erro'
            ? `<div class="panel empty"><p class="muted">${tx('portal.erro')}</p><button class="btn" data-p="atualizar">${tx('portal.atualizar')}</button></div>`
            : P.estado === 'ok'
              ? vLista()
              : `<div class="empty muted">${tx('comum.carregando')}</div>`;
}

/* Botões mostram "carregando" até terminar (padrão do app). */
async function ocupado(el, fn) {
  el.disabled = true;
  el.classList.add('busy');
  el.setAttribute('aria-busy', 'true');
  try {
    await fn();
  } finally {
    if (el.isConnected) {
      el.disabled = false;
      el.classList.remove('busy');
      el.setAttribute('aria-busy', 'false');
    }
  }
}

function ligar(B) {
  P.B = B;
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-p]');
    if (!el) return;
    const a = el.dataset.p;
    if (a === 'google')
      ocupado(el, async () => {
        P.erro = '';
        try {
          await B.google();
        } catch (x) {
          if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(x && x.code)) {
            P.erro = tx('portal.erroEntrar');
            desenhar();
          }
        }
      });
    else if (a === 'sair')
      ocupado(el, async () => {
        await B.logout();
        location.reload();
      });
    else if (a === 'atualizar') ocupado(el, carregar);
    else if (a === 'copiar') {
      const t = (P.user && P.user.uid) || '';
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
        .then(() => {
          el.textContent = tx('comum.copiado');
        })
        .catch(() => {});
    }
  });
  document.addEventListener('input', e => {
    if (e.target.id !== 'ptq') return;
    P.busca = e.target.value;
    const n = norm(P.busca).trim();
    document.querySelectorAll('#ptlist li.cli').forEach(li => {
      li.hidden = !!n && !li.dataset.busca.includes(n);
    });
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'ptf') {
      P.filtro = e.target.value;
      desenhar();
    }
  });
  if (B.redirectResult) B.redirectResult().catch(() => {});
  B.onAuth(u => {
    const antes = P.user && P.user.uid;
    P.user = u;
    if (u && !u.anon && u.uid !== antes) carregar();
    else desenhar();
  });
}

export { ligar };
