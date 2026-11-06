/* Portal do Nosso Jogo (KAN-116): site separado do app dos clientes, só para a administração.
   - Sem criação de conta: só "Entrar com o Google".
   - Quem acessa é decidido nas regras do Firebase (adminPortal(): identificadores de contas Google, incluídos à mão).
   - Mostra dados de cadastro e de uso. Nunca notas, caixa, Pix ou contatos dos grupos.
   - KAN-117 (pelada-v99): virou componente (Preact) e ganhou a ficha do cliente: mudar o plano com validade e motivo
     (pago por fora, cortesia, parceria, teste estendido), com o histórico das mudanças. Bloquear conta: 2ª entrega. */
import { render } from 'preact';
import {
  MOTIVOS,
  camposDaMudanca,
  catalogo,
  diaDaValidade,
  erroDaMudanca,
  filtrarClientes,
  fimDoDia,
  mesmaMudanca,
  montarClientes,
  mudancaAtual,
  resumoPorPlano,
  situacao,
  transicaoAte,
  ultimoDia,
  type Catalogo,
  type Cliente,
  type Filtro,
  type Mudanca,
  type Motivo,
} from '../dominio/planos.ts';
import { tx } from './textos.js';
import { LOCAL } from '../i18n/formatos.js';
import { today } from '../nucleo/util.js';

type Conta = {
  plano?: string;
  planoAte?: number | null;
  motivo?: string | null;
  obs?: string;
  teste?: number;
  email?: string;
};
type Historico = { id: string; em: number; por: string; de: Mudanca; para: Mudanca; obs?: string };
type Banco = any; // FirebaseBackend ou LocalBackend (JavaScript sem tipos)

const P = {
  B: null as Banco,
  user: undefined as { uid: string; email?: string; anon?: boolean } | null | undefined,
  estado: 'inicio' as 'inicio' | 'carregando' | 'ok' | 'erro' | 'negado',
  filtro: 'todos' as Filtro,
  busca: '',
  clientes: [] as Cliente[],
  contas: {} as Record<string, Conta>,
  cfg: null as { transicaoAte?: unknown } | null,
  cat: {} as Catalogo,
  em: 0,
  erro: '',
  /* Ficha aberta (KAN-117) */
  sel: null as string | null,
  hist: null as Historico[] | null,
  fichaErro: '',
  fichaOk: '',
};
const $ = (s: string) => document.querySelector(s) as HTMLElement | null;
const dia = (ts: number | null | undefined) =>
  ts ? new Date(ts).toLocaleDateString(LOCAL, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const dataIso = (s: string | null) =>
  s ? new Date(s + 'T12:00').toLocaleDateString(LOCAL, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const norm = (s: unknown) => String(s || '').toLowerCase();
const nomePlano = (id: string) => (P.cat[id] ? P.cat[id]!.nome : id);
const validade = (ate: number | null) =>
  ate == null ? tx('ficha.semValidade') : tx('portal.ate', { d: dia(ultimoDia(ate)) });

async function carregar() {
  /* Ao atualizar, a lista continua na tela e só o botão mostra o carregando (padrão do app). */
  const B = P.B;
  if (P.estado !== 'ok') {
    P.estado = 'carregando';
    desenhar();
  }
  try {
    const [contas, grupos, cfg] = await Promise.all([
      B.get('contas'),
      B.get('grupos'),
      B.get('sistema/planos').catch(() => null),
    ]);
    const donos = [
      ...new Set(
        Object.values((grupos || {}) as Record<string, { owner?: string }>)
          .map(g => g && g.owner)
          .filter(Boolean) as string[]
      ),
    ];
    const emails: Record<string, string> = {},
      ultima: Record<string, string | null> = {};
    await Promise.all(
      donos
        .filter(u => !(contas[u] && contas[u].email))
        .map(async u => {
          const gid = Object.keys(grupos).find(k => grupos[k] && grupos[k].owner === u);
          try {
            const m = await B.get('grupos/' + gid + '/membros/' + u);
            if (m && m.email) emails[u] = m.email;
          } catch (e) {
            /* sem e-mail */
          }
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
    P.cfg = cfg;
    P.cat = catalogo(cfg);
    P.contas = contas || {};
    P.clientes = montarClientes(contas || {}, grupos || {}, emails, ultima, P.cat, Date.now());
    P.estado = 'ok';
    P.em = Date.now();
  } catch (e) {
    console.warn('portal', e);
    P.estado = e && (e as { code?: string }).code === 'permission-denied' ? 'negado' : 'erro';
  }
  desenhar();
}

function Entrar() {
  return (
    <div class="panel empty auth">
      <h2>{tx('portal.titulo')}</h2>
      <p class="muted">{tx('portal.entrarAjuda')}</p>
      <button class="btn primary" data-p="google">
        {tx('portal.entrarGoogle')}
      </button>
      <p class="err" id="perr">
        {P.erro}
      </p>
    </div>
  );
}
function Negado() {
  const u = P.user || { uid: '' };
  return (
    <div class="panel empty auth">
      <h2>{tx('portal.titulo')}</h2>
      <p class="muted">{tx('portal.negado')}</p>
      <p class="small">{tx('portal.seuId')}</p>
      <p>
        <code id="puid" class="uid">
          {u.uid || ''}
        </code>
      </p>
      <div class="row" style="justify-content:center;gap:8px">
        <button class="btn" data-p="copiar">
          {tx('portal.copiarId')}
        </button>
        <button class="btn" data-p="sair">
          {tx('portal.sair')}
        </button>
      </div>
    </div>
  );
}

function Cartao({ c, q }: { c: Cliente; q: string }) {
  const busca = norm(c.email + ' ' + c.nomesGrupos.join(' ')),
    motivo = P.contas[c.uid] && P.contas[c.uid]!.motivo;
  return (
    <li class="cli" data-busca={busca} hidden={!!q && !busca.includes(q)} data-uid={c.uid}>
      <div class="pn">
        <b>{c.email || tx('portal.semEmail')}</b>
        <br />
        <span class="tag">
          {c.planoNome}
          {c.ate ? ` · ${tx('portal.ate', { d: dia(ultimoDia(c.ate)) })}` : ''}
          {c.vencido ? (
            <>
              {' · '}
              <span class="tag">{tx('portal.vencido')}</span>
            </>
          ) : null}
          {c.teste ? ` · ${tx('portal.teste', { d: dia(c.teste + 14 * 864e5) })}` : ''}
          {c.plano !== 'gratis' && motivo ? ` · ${tx('ficha.motivo.' + motivo)}` : ''}
        </span>
        <br />
        <span class="small muted">
          {tx('portal.grupos', { a: c.gruposAtivos, i: c.gruposInativos })}
          {c.nomesGrupos.length ? ': ' + c.nomesGrupos.map(n => n || tx('portal.semNome')).join(', ') : ''}
        </span>
        <br />
        <span class="small muted">
          {tx('portal.acesso', { d: dia(c.acesso) })} · {tx('portal.ultimaRodada', { d: dataIso(c.ultimaRodada) })}
          {c.criada ? ' · ' + tx('portal.desde', { d: dia(c.criada) }) : ''}
        </span>
      </div>
      <button class="btn sm" data-p="ficha" data-v={c.uid} aria-label={tx('ficha.abrirRotulo', { email: c.email })}>
        {tx('ficha.abrir')}
      </button>
    </li>
  );
}

function Lista() {
  const agora = Date.now(),
    lista = filtrarClientes(P.clientes, P.filtro, '', agora),
    res = resumoPorPlano(P.clientes),
    planos = Object.entries(P.cat),
    q = norm(P.busca).trim();
  const opt = (v: string, l: string) => (
    <option value={v} selected={P.filtro === v}>
      {l}
    </option>
  );
  return (
    <div class="stack">
      <div class="panel">
        <div class="kpis">
          <div>
            <div class="l">{tx('portal.clientes')}</div>
            <div class="money">{P.clientes.length}</div>
          </div>
          {planos.map(([id, p]) => (
            <div key={id}>
              <div class="l">{p.nome}</div>
              <div class="money">{res[id] || 0}</div>
            </div>
          ))}
        </div>
        <p class="small muted" style="margin:12px 0 0">
          {tx('portal.ajuda')}
        </p>
      </div>
      <div class="panel">
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <input
            class="inp"
            id="ptq"
            placeholder={tx('portal.buscar')}
            value={P.busca}
            style="flex:2;min-width:180px"
            aria-label={tx('portal.buscar')}
          />
          <select class="sel" id="ptf" style="flex:1;min-width:160px" aria-label={tx('portal.filtro')}>
            {opt('todos', tx('portal.todos'))}
            {planos.map(([id, p]) => opt('plano:' + id, p.nome))}
            {opt('semAcesso30', tx('portal.semAcesso30'))}
            {opt('vence7', tx('portal.vence7'))}
          </select>
          <button class="btn" data-p="atualizar">
            {tx('portal.atualizar')}
          </button>
        </div>
        <ul class="plist" id="ptlist" style="margin-top:10px">
          {lista.length ? (
            lista.map(c => <Cartao key={c.uid} c={c} q={q} />)
          ) : (
            <li class="muted small">{tx('portal.nenhum')}</li>
          )}
        </ul>
      </div>
      <p class="small muted">{tx('portal.atualizado', { d: new Date(P.em).toLocaleString(LOCAL) })}</p>
    </div>
  );
}

const linhaMudanca = (m: Mudanca) =>
  nomePlano(m.plano) +
  (m.plano !== 'gratis' ? ' · ' + validade(m.ate) + (m.motivo ? ' · ' + tx('ficha.motivo.' + m.motivo) : '') : '');

/* Ficha do cliente (KAN-117): situação de agora, o formulário para mudar e o histórico. */
function Ficha() {
  const uid = P.sel as string,
    c = P.clientes.find(x => x.uid === uid),
    conta = P.contas[uid] || {},
    s = situacao(conta as never, P.cat, Date.now(), transicaoAte(P.cfg)),
    atual = mudancaAtual(conta as never);
  return (
    <div class="stack" id="ficha">
      <div class="row">
        <button class="btn sm" data-p="voltar">
          ← {tx('ficha.voltar')}
        </button>
      </div>
      <div class="panel">
        <h2 style="margin:0 0 4px">{(c && c.email) || tx('portal.semEmail')}</h2>
        <p class="small muted" style="margin:0 0 10px">
          {c ? tx('portal.grupos', { a: c.gruposAtivos, i: c.gruposInativos }) : ''}
        </p>
        <p id="fichaAgora" style="margin:0">
          <b>{tx('ficha.emVigor')}</b> {s.plano.nome} · {tx('ficha.origem.' + s.origem)}
          {s.ate != null ? ' · ' + tx('portal.ate', { d: dia(ultimoDia(s.ate)) }) : ''}
        </p>
        {atual.plano !== 'gratis' || conta.obs ? (
          <p class="small muted" id="fichaGravado" style="margin:6px 0 0">
            {tx('ficha.gravado', { plano: linhaMudanca(atual) })}
            {conta.obs ? ' · ' + tx('ficha.obsLinha', { obs: conta.obs }) : ''}
          </p>
        ) : null}
      </div>
      <form class="panel" id="fichaForm">
        <h3 style="margin:0 0 10px">{tx('ficha.mudarTitulo')}</h3>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <label class="f" style="margin:0;flex:1;min-width:140px">
            <span>{tx('ficha.plano')}</span>
            <select class="sel" id="fPlano">
              {Object.entries(P.cat).map(([id, p]) => (
                <option key={id} value={id} selected={id === atual.plano}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label class="f" style="margin:0;flex:1;min-width:140px">
            <span>{tx('ficha.validade')}</span>
            <input class="inp" type="date" id="fAte" value={diaDaValidade(atual.ate)} min={today()} />
          </label>
          <label class="f" style="margin:0;flex:1;min-width:160px">
            <span>{tx('ficha.motivoRotulo')}</span>
            <select class="sel" id="fMotivo">
              <option value="">{tx('ficha.escolha')}</option>
              {MOTIVOS.map(m => (
                <option key={m} value={m} selected={m === atual.motivo}>
                  {tx('ficha.motivo.' + m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p class="small muted" style="margin:6px 0 10px">
          {tx('ficha.ajuda')}
        </p>
        <label class="f">
          <span>{tx('ficha.obs')}</span>
          <input class="inp" id="fObs" maxLength={200} value={conta.obs || ''} autocomplete="off" />
        </label>
        <p class="err" id="fErro" role="alert">
          {P.fichaErro}
        </p>
        {P.fichaOk ? (
          <p class="small" id="fOk" role="status">
            {P.fichaOk}
          </p>
        ) : null}
        <div class="row">
          <button class="btn primary" type="submit" data-p="salvarPlano" id="fSalvar">
            {tx('ficha.salvar')}
          </button>
        </div>
      </form>
      <div class="panel">
        <h3 style="margin:0 0 8px">{tx('ficha.historico')}</h3>
        {P.hist == null ? (
          <p class="small muted">{tx('comum.carregando')}</p>
        ) : P.hist.length ? (
          <ul class="plist wrap" id="fHist">
            {P.hist.map(h => (
              <li key={h.id}>
                <span class="pn">
                  <span class="small muted">
                    {new Date(h.em).toLocaleString(LOCAL)} · {h.por}
                  </span>
                  <br />
                  {linhaMudanca(h.de)} → <b>{linhaMudanca(h.para)}</b>
                  {h.obs ? <span class="small muted">{' · ' + h.obs}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="small muted">{tx('ficha.semHistorico')}</p>
        )}
      </div>
    </div>
  );
}

function Topo() {
  const u = P.user;
  return u && !u.anon ? (
    <>
      <span class="small">{u.email || ''}</span>
      <button class="chip" data-p="sair">
        {tx('portal.sair')}
      </button>
    </>
  ) : null;
}
function Principal() {
  const u = P.user,
    logado = !!(u && !u.anon);
  if (u === undefined) return <div class="empty muted">{tx('comum.carregando')}</div>;
  if (!logado) return <Entrar />;
  if (P.estado === 'negado') return <Negado />;
  if (P.estado === 'erro')
    return (
      <div class="panel empty">
        <p class="muted">{tx('portal.erro')}</p>
        <button class="btn" data-p="atualizar">
          {tx('portal.atualizar')}
        </button>
      </div>
    );
  if (P.estado !== 'ok') return <div class="empty muted">{tx('comum.carregando')}</div>;
  return P.sel ? <Ficha /> : <Lista />;
}
function desenhar() {
  render(<Topo />, $('#ptopo') as HTMLElement);
  render(<Principal />, $('#pmain') as HTMLElement);
}

/* Botões mostram "carregando" até terminar (padrão do app). */
async function ocupado(el: HTMLButtonElement, fn: () => Promise<unknown>) {
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

async function abrirFicha(uid: string) {
  P.sel = uid;
  P.hist = null;
  P.fichaErro = '';
  P.fichaOk = '';
  desenhar();
  window.scrollTo(0, 0);
  try {
    const h = (await P.B.get('contas/' + uid + '/historico')) || {};
    P.hist = Object.entries(h as Record<string, Omit<Historico, 'id'>>)
      .map(([id, x]) => Object.assign({ id }, x))
      .sort((a, b) => b.em - a.em);
  } catch (e) {
    console.warn('histórico', e);
    P.hist = [];
  }
  if (P.sel === uid) desenhar();
}

/* Grava o plano e a linha do histórico juntos (ou entram os dois, ou nenhum). */
async function salvarPlano() {
  const uid = P.sel as string,
    val = (id: string) => (($('#' + id) as HTMLInputElement | null)?.value || '').trim(),
    novo: Mudanca = {
      plano: val('fPlano') || 'gratis',
      ate: fimDoDia(val('fAte')),
      motivo: (val('fMotivo') || null) as Motivo | null,
    },
    obs = val('fObs'),
    conta = P.contas[uid] || {},
    antes = mudancaAtual(conta as never),
    erro = erroDaMudanca(novo, P.cat, Date.now());
  P.fichaOk = '';
  if (erro) {
    P.fichaErro = tx(erro);
    return desenhar();
  }
  const campos = camposDaMudanca(novo, obs),
    para = mudancaAtual(campos as never);
  if (mesmaMudanca(antes, para) && (conta.obs || '') === campos.obs) {
    P.fichaErro = tx('ficha.nadaMudou');
    return desenhar();
  }
  P.fichaErro = '';
  const B = P.B,
    id = B.newId(),
    h = { em: Date.now(), por: (P.user && P.user.email) || '', de: antes, para, obs: campos.obs as string };
  try {
    await B.lote([
      { tipo: 'patch', p: 'contas/' + uid, o: campos },
      { tipo: 'set', p: 'contas/' + uid + '/historico/' + id, o: h },
    ]);
  } catch (e) {
    console.warn('plano', e);
    P.fichaErro = tx('ficha.erroGravar');
    return desenhar();
  }
  P.contas[uid] = Object.assign({}, conta, campos);
  P.clientes = P.clientes.map(c => (c.uid === uid ? Object.assign({}, c, linhaDoCliente(uid)) : c));
  P.hist = [Object.assign({ id }, h) as Historico].concat(P.hist || []);
  P.fichaOk = tx('ficha.salvo', { plano: linhaMudanca(para) });
  desenhar();
}
/* Plano do cliente na lista, depois de mudar na ficha (sem precisar de Atualizar). */
function linhaDoCliente(uid: string): Partial<Cliente> {
  const c = P.contas[uid] || {},
    agora = Date.now(),
    id = c.plano && P.cat[c.plano] ? c.plano : 'gratis',
    ate = typeof c.planoAte === 'number' ? c.planoAte : null,
    vencido = id !== 'gratis' && ate !== null && ate < agora,
    efetivo = vencido ? 'gratis' : id;
  return { plano: efetivo, planoNome: nomePlano(efetivo), ate: vencido ? null : ate, vencido };
}

function ligar(B: Banco) {
  P.B = B;
  document.addEventListener('click', e => {
    const el = (e.target as HTMLElement).closest('[data-p]') as HTMLButtonElement | null;
    if (!el) return;
    const a = el.dataset.p;
    if (a === 'google')
      ocupado(el, async () => {
        P.erro = '';
        try {
          await B.google();
        } catch (x) {
          if (
            !['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(
              (x as { code?: string })?.code || ''
            )
          ) {
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
    else if (a === 'ficha') abrirFicha(el.dataset.v || '');
    else if (a === 'voltar') {
      P.sel = null;
      desenhar();
    } else if (a === 'salvarPlano') {
      e.preventDefault();
      ocupado(el, salvarPlano);
    } else if (a === 'copiar') {
      const t = (P.user && P.user.uid) || '';
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
        .then(() => {
          el.textContent = tx('comum.copiado');
        })
        .catch(() => {});
    }
  });
  /* Enter no formulário da ficha salva (padrão do app). */
  document.addEventListener('submit', e => {
    if ((e.target as HTMLElement).id !== 'fichaForm') return;
    e.preventDefault();
    const b = $('#fSalvar') as HTMLButtonElement | null;
    if (b && !b.disabled) ocupado(b, salvarPlano);
  });
  document.addEventListener('input', e => {
    if ((e.target as HTMLElement).id !== 'ptq') return;
    P.busca = (e.target as HTMLInputElement).value;
    const n = norm(P.busca).trim();
    document.querySelectorAll<HTMLElement>('#ptlist li.cli').forEach(li => {
      li.hidden = !!n && !(li.dataset.busca || '').includes(n);
    });
  });
  document.addEventListener('change', e => {
    const t = e.target as HTMLSelectElement;
    if (t.id === 'ptf') {
      P.filtro = t.value as Filtro;
      desenhar();
    }
  });
  if (B.redirectResult) B.redirectResult().catch(() => {});
  B.onAuth((u: typeof P.user) => {
    const antes = P.user && P.user.uid;
    P.user = u;
    if (u && !u.anon && u.uid !== antes) carregar();
    else desenhar();
  });
}

export { ligar };
