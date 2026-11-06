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
import { PADRAO as LIMITES_PADRAO, limite, type Chave } from '../dominio/limites.ts';
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
  bloq?: number | null;
};
type Historico = { id: string; em: number; por: string; de: Mudanca; para: Mudanca; obs?: string; acao?: string };
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
  /* Plano escolhido no formulário (KAN-240): no Grátis, validade e motivo ficam desligados. */
  planoForm: null as string | null,
  /* KAN-117, 2ª parte (pelada-v101): grupos (para bloquear os da conta), limites contra abuso e a confirmação do bloqueio. */
  grupos: {} as Record<string, { owner?: string; name?: string; bloq?: boolean }>,
  limites: null as Record<string, unknown> | null,
  limErro: '',
  limOk: '',
  confirmarBloq: false,
  bloqErro: '',
  bloqOk: '',
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
    const [contas, grupos, cfg, lims] = await Promise.all([
      B.get('contas'),
      B.get('grupos'),
      B.get('sistema/planos').catch(() => null),
      B.get('sistema/limites').catch(() => null),
    ]);
    P.grupos = grupos || {};
    P.limites = lims;
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
        {P.contas[c.uid] && P.contas[c.uid]!.bloq ? (
          <>
            {' '}
            <span class="tag alt tag-bloq">{tx('bloq.tag')}</span>
          </>
        ) : null}
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
      <Limites />
      <p class="small muted">{tx('portal.atualizado', { d: new Date(P.em).toLocaleString(LOCAL) })}</p>
    </div>
  );
}

/* Limites contra abuso (KAN-117, KAN-89): os números de sistema/limites, que valem na hora para todos. */
function Limites() {
  const v = (k: Chave) => String(limite(P.limites as never, k));
  return (
    <form class="panel" id="limitesForm">
      <h3 style="margin:0 0 6px">{tx('lim.titulo')}</h3>
      <p class="small muted" style="margin:0 0 10px">
        {tx('lim.ajuda', { a: LIMITES_PADRAO.avulsosPorRodada, g: LIMITES_PADRAO.gruposPorConta })}
      </p>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <label class="f" style="margin:0;flex:1;min-width:150px">
          <span>{tx('lim.avulsos')}</span>
          <input
            class="inp"
            id="limAvulsos"
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            defaultValue={v('avulsosPorRodada')}
          />
        </label>
        <label class="f" style="margin:0;flex:1;min-width:150px">
          <span>{tx('lim.grupos')}</span>
          <input
            class="inp"
            id="limGrupos"
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            defaultValue={v('gruposPorConta')}
          />
        </label>
      </div>
      <p class="err" id="limErro" role="alert">
        {P.limErro}
      </p>
      {P.limOk ? (
        <p class="small" id="limOk" role="status">
          {P.limOk}
        </p>
      ) : null}
      <div class="row">
        <button class="btn" type="submit" data-p="salvarLimites" id="limSalvar">
          {tx('lim.salvar')}
        </button>
      </div>
    </form>
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
    atual = mudancaAtual(conta as never),
    gratis = (P.planoForm || atual.plano) === 'gratis';
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
      {/* key: cada cliente recomeça o formulário; os campos não voltam ao gravado quando a tela redesenha (erro, plano). */}
      <form class="panel" id="fichaForm" key={uid}>
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
            <input
              class="inp"
              type="date"
              id="fAte"
              defaultValue={diaDaValidade(atual.ate)}
              min={today()}
              disabled={gratis}
            />
          </label>
          <label class="f" style="margin:0;flex:1;min-width:160px">
            <span>{tx('ficha.motivoRotulo')}</span>
            <select class="sel" id="fMotivo" disabled={gratis}>
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
          {tx(gratis ? 'ficha.gratisAviso' : 'ficha.ajuda')}
        </p>
        <label class="f">
          <span>{tx('ficha.obs')}</span>
          <input class="inp" id="fObs" maxLength={200} defaultValue={conta.obs || ''} autocomplete="off" />
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
      <Bloqueio uid={uid} conta={conta} />
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
                  {h.acao ? (
                    <b>{tx('bloq.acao.' + h.acao)}</b>
                  ) : (
                    <>
                      {linhaMudanca(h.de)} → <b>{linhaMudanca(h.para)}</b>
                    </>
                  )}
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

/* Bloqueio da conta (KAN-117, 2ª parte): a conta não cria nem muda nada, e os links dos grupos dela ficam indisponíveis.
   Bloquear pede confirmação (é sério e vale na hora); desbloquear é direto. Nada é apagado. */
function Bloqueio({ uid, conta }: { uid: string; conta: Conta }) {
  const gs = Object.values(P.grupos).filter(g => g && g.owner === uid).length;
  return (
    <div class="panel" id="bloqPainel">
      <h3 style="margin:0 0 6px">{tx('bloq.titulo')}</h3>
      {conta.bloq ? (
        <>
          <p style="margin:0 0 10px" id="bloqSituacao">
            <span class="tag alt tag-bloq">{tx('bloq.tag')}</span>{' '}
            {tx('bloq.desde', { d: new Date(conta.bloq).toLocaleString(LOCAL) })}
          </p>
          <button class="btn primary" data-p="desbloquear" id="bloqBotao">
            {tx('bloq.desbloquear')}
          </button>
        </>
      ) : (
        <>
          <p class="small muted" style="margin:0 0 10px">
            {tx('bloq.ajuda', { n: gs })}
          </p>
          <label class="f">
            <span>{tx('bloq.motivo')}</span>
            <input class="inp" id="bloqMotivo" maxLength={200} autocomplete="off" />
          </label>
          {P.confirmarBloq ? (
            <div class="inbar" id="bloqConfirma">
              <span>{tx('bloq.confirmaTexto', { n: gs })}</span>
              <span class="row">
                <button class="btn sm" data-p="cancelarBloq">
                  {tx('bloq.cancelar')}
                </button>
                <button class="btn sm danger" data-p="bloquear" id="bloqConfirmar">
                  {tx('bloq.confirmar')}
                </button>
              </span>
            </div>
          ) : (
            <button class="btn danger" data-p="pedirBloq" id="bloqBotao">
              {tx('bloq.bloquear')}
            </button>
          )}
        </>
      )}
      <p class="err" id="bloqErro" role="alert">
        {P.bloqErro}
      </p>
      {P.bloqOk ? (
        <p class="small" id="bloqOk" role="status">
          {P.bloqOk}
        </p>
      ) : null}
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
  P.planoForm = null;
  P.confirmarBloq = false;
  P.bloqErro = '';
  P.bloqOk = '';
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

/* Bloqueia ou desbloqueia a conta e todos os grupos dela, com a linha do histórico, num lote só. */
async function mudarBloqueio(bloquear: boolean) {
  const uid = P.sel as string,
    conta = P.contas[uid] || {},
    motivo = bloquear ? (($('#bloqMotivo') as HTMLInputElement | null)?.value || '').trim().slice(0, 200) : '',
    atual = mudancaAtual(conta as never),
    bloq = bloquear ? Date.now() : null,
    gids = Object.keys(P.grupos).filter(g => P.grupos[g] && P.grupos[g]!.owner === uid),
    B = P.B,
    id = B.newId(),
    h: Record<string, unknown> = {
      em: Date.now(),
      por: (P.user && P.user.email) || '',
      de: atual,
      para: atual,
      acao: bloquear ? 'bloquear' : 'desbloquear',
    };
  if (motivo) h.obs = motivo;
  const ops: { tipo: string; p: string; o: unknown }[] = [{ tipo: 'patch', p: 'contas/' + uid, o: { bloq } }];
  gids.forEach(g => ops.push({ tipo: 'patch', p: 'grupos/' + g, o: { bloq: bloquear } }));
  ops.push({ tipo: 'set', p: 'contas/' + uid + '/historico/' + id, o: h });
  try {
    await B.lote(ops);
  } catch (e) {
    console.warn('bloqueio', e);
    P.bloqErro = tx('ficha.erroGravar');
    return desenhar();
  }
  P.contas[uid] = Object.assign({}, conta, { bloq });
  gids.forEach(g => (P.grupos[g] = Object.assign({}, P.grupos[g], { bloq: bloquear })));
  P.hist = [Object.assign({ id }, h) as Historico].concat(P.hist || []);
  P.confirmarBloq = false;
  P.bloqErro = '';
  P.fichaOk = '';
  P.bloqOk = tx(bloquear ? 'bloq.bloqueada' : 'bloq.desbloqueada', { n: gids.length });
  desenhar();
}

/* Salva os limites contra abuso (inteiros de 1 a 500). */
async function salvarLimites() {
  const n = (id: string) => Number((($('#' + id) as HTMLInputElement | null)?.value || '').trim()),
    a = n('limAvulsos'),
    g = n('limGrupos'),
    ok = (x: number) => Number.isInteger(x) && x >= 1 && x <= 500;
  P.limOk = '';
  if (!ok(a) || !ok(g)) {
    P.limErro = tx('lim.erro');
    return desenhar();
  }
  const o = { avulsosPorRodada: a, gruposPorConta: g };
  try {
    await P.B.set('sistema/limites', o);
  } catch (e) {
    console.warn('limites', e);
    P.limErro = tx('ficha.erroGravar');
    return desenhar();
  }
  P.limites = o;
  P.limErro = '';
  P.limOk = tx('lim.salvo', { a, g });
  desenhar();
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
    } else if (a === 'salvarLimites') {
      e.preventDefault();
      ocupado(el, salvarLimites);
    } else if (a === 'pedirBloq') {
      P.confirmarBloq = true;
      P.bloqOk = '';
      desenhar();
      setTimeout(() => ($('#bloqConfirmar') as HTMLElement | null)?.focus(), 0);
    } else if (a === 'cancelarBloq') {
      P.confirmarBloq = false;
      desenhar();
    } else if (a === 'bloquear') ocupado(el, () => mudarBloqueio(true));
    else if (a === 'desbloquear') {
      ocupado(el, () => mudarBloqueio(false));
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
    const id = (e.target as HTMLElement).id;
    if (id !== 'fichaForm' && id !== 'limitesForm') return;
    e.preventDefault();
    const b = $(id === 'fichaForm' ? '#fSalvar' : '#limSalvar') as HTMLButtonElement | null;
    if (b && !b.disabled) ocupado(b, id === 'fichaForm' ? salvarPlano : salvarLimites);
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
    } else if (t.id === 'fPlano') {
      /* KAN-240: no Grátis, validade e motivo não valem; ficam desligados, com a explicação. */
      P.planoForm = t.value;
      P.fichaErro = '';
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
