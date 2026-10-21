/* Aba Rodada da gestão (KAN-153): componente em TypeScript + Preact, no lugar do HTML montado como texto.
   Por fora é a mesma tela de antes; os testes automáticos conferem. Os botões usam data-a (ações em acoes/rodada.js). */
import { render } from 'preact';
import { divergencia } from '../dominio/divergencia';
import { linkCobrar, semResposta } from '../dominio/cobrar';
import { linkWhatsApp } from '../dominio/contato';
import { linkDaRodada } from '../dominio/whatsapp.js';
import { COL, col, colete, hasPos, posIdx, posKeys, posLabel, sport, tn } from '../dominio/esportes.js';
import { TOTAL, faltaTotal, minimoValido } from '../dominio/posicoes';
import { situacao } from '../dominio/vagas';
import {
  attendance,
  curRodada,
  fixos,
  fmtL,
  freq,
  grpAtivo,
  isAvulso,
  lvl,
  players,
  pname,
  ppos,
  rodadasJanela,
} from '../dominio/grupo.js';
import { avulsosEsgotados, limite } from '../dominio/limites';
import { hora } from '../dominio/rodadas.js';
import { quality } from '../dominio/sorteio.js';
import { tp, tx } from '../i18n/index.js';
import { presAlterada } from '../nucleo/edicoes.js';
import { S as estado } from '../nucleo/estado.js';
import { fdate } from '../nucleo/util.js';
import { ComoChegar, Nota, Pos, PorPosicao, Segmentado, SeletorRodada, Tag, TextoCortado } from '../ui/componentes';
import { rodadasProntas, temVotacao } from './rodada-partes.js';

type Time = { c: number; players: string[]; res?: string[] };
type Rodada = {
  id: string;
  date: string;
  time?: string;
  fim?: string;
  place?: string;
  locked?: boolean;
  cancelada?: boolean;
  fixo?: boolean;
  times?: Time[] | null;
  vagas?: { aberta?: boolean; max?: number };
};
type Qualidade = { diff: number; gk?: number[]; nsep?: number; viol?: number; newPct?: number | null } | null;

// O estado do app ainda é JavaScript sem tipos; é lido sempre dentro das funções (regra de ordem, docs/ARQUITETURA.md).
const st = (): any => estado;
const statusDe = (id: string): 'in' | 'out' | undefined => st().pres[id]?.s;

/* Seletor da rodada (D10): as próximas e as últimas 4; as antigas ficam na aba Histórico. */
/* Painel do link permanente (KAN-150): só o link; dia, hora e local ficam no cartão da rodada. */
function LinkPermanente() {
  if (!fixos().length) {
    return freq() === 'fixo' ? (
      <div class="row small muted">
        {tx('fixos.semDias')}
        <button class="btn sm" data-a="editGroup">
          {tx('fixos.definir')}
        </button>
      </div>
    ) : null;
  }
  return (
    <div class="panel fixos">
      <div class="row between">
        <div>
          <h3 style="margin:0">{tx('fixos.titulo')}</h3>
          <div class="small muted">{tx('fixos.ajuda')}</div>
        </div>
        <div class="row">
          <button class="btn sm primary" data-a="shareFixo">
            {tx('fixos.mandar')}
          </button>
          <button class="btn sm" data-a="copyFixo">
            {tx('fixos.copiar')}
          </button>
          <button class="btn sm" data-a="editGroup">
            {tx('fixos.editar')}
          </button>
        </div>
      </div>
      <details class="small" style="margin-top:8px">
        <summary>{tx('fixos.comoFunciona')}</summary>
        <p class="muted" style="margin:6px 0 0">
          {tx('fixos.comoFuncionaTexto')}
        </p>
      </details>
    </div>
  );
}

function SemRodada() {
  const fixo = freq() === 'fixo';
  return (
    <div class="panel empty">
      <h2>{tx('rodada.nenhuma')}</h2>
      <p class="muted">
        {grpAtivo() ? tx(fixo ? 'rodada.nenhumaFixo' : 'rodada.nenhumaEsporadico') : tx('rodada.grupoInativo')}
      </p>
      <div class="row" style="justify-content:center">
        {fixo && (
          <button class="btn" data-a="editGroup">
            {tx('rodada.diasDoGrupo')}
          </button>
        )}
        <button class="btn primary" data-a="newRod">
          {tx('rodada.criar')}
        </button>
      </div>
    </div>
  );
}

/* Cartão de um time. Na gestão: Cor, mover (⇄) e "+ Pôr no time". */
function CartaoTime({ t, ti }: { t: Time; ti: number }) {
  const c = col(t.c),
    pares = !!sport().pairs;
  const rs = (id: string) => ((t.res || []).includes(id) ? 1 : 0);
  const ps = t.players.slice().sort((a, b) => rs(a) - rs(b) || posIdx(ppos(a)) - posIdx(ppos(b)));
  const media = t.players.reduce((s, id) => s + lvl(id), 0) / Math.max(1, t.players.length);
  return (
    <div class="team">
      <div class={'band' + (c.n === 'Branco' && !pares ? ' branco' : '')} style={{ background: c.c }}></div>
      <div class="th">
        <b>{tn(ti)}</b>
        {pares ? (
          <Tag>{t.players.length}</Tag>
        ) : (
          <button
            class="btn sm ghost colete-btn"
            data-a="color"
            data-v={ti}
            aria-label={tx('colete.trocarRotulo', { time: tn(ti) })}
          >
            <span class="dot" style={{ background: c.c }}></span>
            {colete(t.c)}
          </button>
        )}
      </div>
      <ul>
        {ps.map(id => (
          <li key={id} class={rs(id) ? 'reserva' : ''}>
            <Pos id={id} />
            <span class="pn">
              {pname(id)}
              {rs(id) ? (
                <>
                  {' '}
                  <Tag>· {tx('times.reserva')}</Tag>
                </>
              ) : null}
            </span>
            <button
              class="btn sm ghost"
              data-a="move"
              data-v={ti}
              data-p={id}
              title={tx('times.mover')}
              aria-label={tx('times.moverRotulo', { nome: pname(id) })}
            >
              ⇄
            </button>
          </li>
        ))}
      </ul>
      <div class="row between small muted" style="padding:0 14px 12px">
        <span>{tx('times.media', { n: fmtL(Math.round(media * 10) / 10) })}</span>
        {pares ? null : (
          <button class="btn sm ghost" data-a="porTime" data-v={ti}>
            {tx('porTime.botao')}
          </button>
        )}
      </div>
    </div>
  );
}

/* Aviso de lista diferente dos times (pelada-v15). Só depois que a presença chegou (KAN-137). */
function Divergencia({ r }: { r: Rodada }) {
  const d = divergencia(r, st().pres) as { saiu: string[]; entrou: string[] };
  if (!d.saiu.length && !d.entrou.length) return null;
  const pares = !!sport().pairs;
  const linha = (id: string, texto: string, acao: string, rotulo: string) => (
    <li key={acao + id}>
      <span class="pn">{texto}</span>
      {pares ? null : (
        <button class="btn sm" data-a={acao} data-p={id}>
          {rotulo}
        </button>
      )}
    </li>
  );
  return (
    <div class="warn-alt warn-div" role="status">
      <b>{tx('div.titulo')}</b> {tx(pares ? 'div.ajudaDuplas' : 'div.ajuda')}
      <ul class="plist wrap" style="margin:8px 0">
        {d.saiu.map(id => linha(id, tx('div.naoVaiMais', { nome: pname(id) }), 'divTirar', tx('div.tirar')))}
        {d.entrou.map(id => linha(id, tx('div.confirmouDepois', { nome: pname(id) }), 'divPor', tx('div.por')))}
      </ul>
      <div class="row">
        {temVotacao(r) ? null : (
          <button class="btn sm bib" data-a="drawDlg">
            {tx('div.sortearDeNovo')}
          </button>
        )}
        <button class="btn sm" data-a="divManter">
          {tx('div.manter')}
        </button>
      </div>
    </div>
  );
}

/* Respostas mudadas por outro aparelho (KAN-78). */
function RespostasMudadas({ alt }: { alt: string[] }) {
  if (!alt.length) return null;
  const nomes = alt
    .map(id => pname(id) + ' (' + tx(statusDe(id) === 'in' ? 'rodada.vai' : 'rodada.naoVai') + ')')
    .join(', ');
  return (
    <div class="warn-alt">
      <b>{tp('rodada.mudadas', alt.length)}</b> {tx('rodada.mudadasTexto', { nomes })}
    </div>
  );
}

const TAG_MUDADO = () => (
  <>
    {' '}
    <Tag classe="alt" titulo={tx('rodada.mudadoTitulo')}>
      · {tx('rodada.mudado')}
    </Tag>
  </>
);

/* KAN-71: uma lista só de presença, com filtros. Em "Vão", a ordem é a de chegada (numerada). */
const FILTROS = ['todos', 'in', 'out', 'sem'];
/* Cobrar quem ainda não respondeu (KAN-64): no topo da Rodada, perto de "Mandar link no WhatsApp". */
function textoCobrarUm(r: Rodada, id: string) {
  return tx('cobrar.individual', { nome: pname(id), data: fdate(r.date), link: linkDaRodada(r) });
}
function Cobrar({ r }: { r: Rodada }) {
  const S = st(),
    falta = semResposta(
      (players() as { id: string }[]).map(p => p.id),
      S.pres
    );
  if (!falta.length || r.locked) return null;
  return (
    <div class="panel" id="semResposta">
      <div class="row between">
        <h3 style="margin:0">{tx('cobrar.titulo', { n: falta.length })}</h3>
        <button class="btn sm primary" data-a="cobrarGrupo">
          {tx('cobrar.noGrupo')}
        </button>
      </div>
      <p class="small muted" style="margin:6px 0 0">
        {falta.map(pname).join(', ')}
      </p>
      <details style="margin-top:6px">
        <summary class="small">{tx('cobrar.umPorUm')}</summary>
        <ul class="plist" id="cobrarLista">
          {falta.map(id => {
            const tel = ((S.cont || {})[id] || {}).tel,
              href = linkCobrar(tel ? linkWhatsApp(tel) : '', textoCobrarUm(r, id));
            return (
              <li key={id}>
                <span class="pn">{pname(id)}</span>
                {href ? (
                  <a
                    class="btn sm"
                    href={href}
                    target="_blank"
                    rel="noopener"
                    aria-label={tx('cobrar.individualRotulo', { nome: pname(id) })}
                  >
                    {tx('cobrar.whatsapp')}
                  </a>
                ) : (
                  <span class="small muted">{tx('cobrar.semTelefone')}</span>
                )}
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}

function Presenca({ r, inn, carregou, avs }: { r: Rodada; inn: string[]; carregou: boolean; avs: string[] }) {
  const S = st();
  const ids = [...new Set((players() as { id: string }[]).map(p => p.id).concat(avs))];
  const f = FILTROS.includes(S.presFiltro) ? S.presFiltro : 'todos';
  const cont: Record<string, number> = {
    todos: ids.length,
    in: inn.length,
    out: ids.filter(id => statusDe(id) === 'out').length,
    sem: ids.filter(id => !statusDe(id)).length,
  };
  const vis =
    f === 'in' ? inn : f === 'todos' ? ids : ids.filter(id => (f === 'out' ? statusDe(id) === 'out' : !statusDe(id)));
  const vazio = !carregou
    ? tx('comum.carregando')
    : !ids.length
      ? tx('rodada.semJogadores')
      : f === 'in'
        ? tx('rodada.ninguemConfirmou')
        : f === 'out'
          ? tx('rodada.ninguemNaoVai')
          : f === 'sem'
            ? tx('rodada.todosResponderam')
            : '';
  const Lista = f === 'in' ? 'ol' : 'ul';
  const linha = (id: string, i: number) => {
    const s = statusDe(id),
      nome = pname(id);
    return (
      <li key={id}>
        {f === 'in' ? <span class="num">{i + 1}</span> : null}
        <Pos id={id} />
        <span class="pn">
          {nome}
          {isAvulso(id) ? (
            <>
              {' '}
              <Tag>· {tx('rodada.avulso')}</Tag>
            </>
          ) : null}
          {presAlterada(id) ? <TAG_MUDADO /> : null}
        </span>
        {isAvulso(id) && s === 'in' ? (
          <button class="btn sm" data-a="editAvulso" data-p={id}>
            {tx('rodada.editar')}
          </button>
        ) : null}
        <Nota id={id} />
        {r.locked ? (
          <Tag cor={s === 'in' ? 'var(--in)' : s === 'out' ? 'var(--out)' : undefined}>
            {s === 'in' ? tx('publico.vai') : s === 'out' ? tx('publico.naoVai') : '—'}
          </Tag>
        ) : (
          <span class="mk">
            <button
              class={s === 'in' ? 'on-in' : ''}
              data-a="mark"
              data-p={id}
              data-v="in"
              aria-label={tx('rodada.vaiRotulo', { nome })}
              aria-pressed={s === 'in'}
            >
              ✓
            </button>
            <button
              class={s === 'out' ? 'on-out' : ''}
              data-a="mark"
              data-p={id}
              data-v="out"
              aria-label={tx('rodada.naoVaiRotulo', { nome })}
              aria-pressed={s === 'out'}
            >
              ✕
            </button>
          </span>
        )}
      </li>
    );
  };
  return (
    <div class="panel" id="presPainel">
      <div class="row between">
        <h3 style="margin:0">{tx('rodada.presenca')}</h3>
        {r.locked ? null : (
          <button class="btn sm" data-a="addAvulso">
            {tx('rodada.addAvulso')}
          </button>
        )}
      </div>
      {!r.locked && avulsosEsgotados(S.limAv, S.limCfg) ? (
        <div class="warn-alt aviso-limite" role="status">
          {tx('limite.avulsosAdmin', { n: limite(S.limCfg, 'avulsosPorRodada') })}
        </div>
      ) : null}
      {r.locked ? (
        <p class="small muted lista-fechada">
          {tx(
            r.times ? (sport().pairs ? 'lista.fechadaComTimesDuplas' : 'lista.fechadaComTimes') : 'lista.fechadaAviso'
          )}
        </p>
      ) : null}
      <Segmentado
        acao="presFiltro"
        atual={f}
        rotulo={tx('rodada.mostrar')}
        opcoes={FILTROS.map(k => ({
          v: k,
          rotulo: tx('rodada.filtro.' + k),
          n: carregou || k === 'todos' ? cont[k] : '…',
        }))}
      />
      {carregou && !inn.length && f !== 'in' && ids.length ? (
        <p class="small muted" style="margin:10px 0 0">
          {tx('rodada.ninguemConfirmou')}
        </p>
      ) : null}
      <Lista class="plist" id="presLista">
        {carregou ? vis.map(linha) : null}
        {!carregou || !vis.length ? <li class="muted small">{vazio}</li> : null}
      </Lista>
    </div>
  );
}

function Qualidade({ q }: { q: Qualidade }) {
  if (!q) return null;
  return (
    <div class="quality">
      <span>
        {tx('times.difMedia')} <b>{fmtL(Math.round(q.diff * 10) / 10)}</b>
      </span>
      {q.gk ? (
        <span>
          {tx('times.posChave', { pos: posLabel(sport().key) })} <b>{q.gk.join(' × ')}</b>
        </span>
      ) : null}
      {q.nsep ? (
        <span>
          {tx('times.separacoes')} <b>{q.nsep - (q.viol || 0) + '/' + q.nsep}</b>
        </span>
      ) : null}
      {q.newPct != null ? (
        <span>
          {tx('times.parcerias')} <b>{q.newPct}%</b>
        </span>
      ) : null}
    </div>
  );
}

function Times({ r, inn }: { r: Rodada; inn: number }) {
  const votou = temVotacao(r);
  return (
    <div class="panel">
      <div class="row between">
        <h3 style="margin:0" id="timesTit" tabIndex={-1}>
          {tx('times.titulo')}
        </h3>
        {r.times && !votou ? (
          <button class="btn bib" data-a="drawDlg" disabled={inn < 4}>
            {tx('div.sortearDeNovo')}
          </button>
        ) : null}
      </div>
      {r.times && votou ? (
        <p class="small muted aviso-votacao" style="margin:8px 0 0">
          {tx('sorteio.bloqueadoVotacao')}
        </p>
      ) : null}
      {!r.times ? (
        <p class="muted small" style="margin-bottom:0">
          {tx(inn < 4 ? 'rodada.timesAjuda' : 'rodada.timesPronto')}
        </p>
      ) : null}
      {r.times ? (
        <>
          <div class="teams" style="margin-top:12px">
            {r.times.map((t, ti) => (
              <CartaoTime key={ti} t={t} ti={ti} />
            ))}
          </div>
          <Qualidade q={quality(r) as Qualidade} />
          <div class="row" style="margin-top:12px">
            <button class="btn sm" data-a="shareTimes">
              {tx('times.mandar')}
            </button>
            <button class="btn sm" data-a="tab" data-v="partida">
              {tx('times.irPartida')}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* KAN-71: barra fixa no rodapé enquanto os times não foram sorteados. */
function BarraSortear({ k }: { k: number }) {
  const falta = Math.max(0, 4 - k);
  return (
    <div class="acao-fixa">
      <button class="btn bib" data-a="drawDlg" disabled={!!falta}>
        {falta
          ? tp('rodada.faltam', falta)
          : tx(sport().pairs ? 'rodada.sortearDuplas' : 'rodada.sortearTimes', { n: k })}
      </button>
    </div>
  );
}

function RodadaTela() {
  const S = st();
  if (!rodadasProntas()) return <div class="empty muted">{tx('comum.carregando')}</div>;
  const r = curRodada() as Rodada | null;
  if (!r) return <SemRodada />;
  if (r.cancelada) {
    return (
      <div class="stack">
        <SeletorRodada r={r} acoes />
        <LinkPermanente />
        <div class="panel empty">
          <h2>{tx('rodada.cancelada', { data: fdate(r.date) })}</h2>
          <p class="muted">{tx('rodada.canceladaTexto')}</p>
          <button class="btn" data-a="cancelRod">
            {tx('rodada.reativar')}
          </button>
        </div>
      </div>
    );
  }
  const a = attendance() as { inn: string[] },
    carregou = S.presRid === r.id && !!S.loaded.pres;
  const pres = Object.keys(S.pres);
  const avs = pres.filter(isAvulso),
    alt = pres.filter(presAlterada);
  return (
    <div class="stack">
      <SeletorRodada r={r} acoes />
      <LinkPermanente />
      <div class="panel">
        <div class="hero-r">
          <div>
            <h2>
              {fdate(r.date)}
              {r.time ? ' · ' + hora(r) : ''}
            </h2>
            <div class="muted linha-local">
              <TextoCortado texto={r.place || tx('publico.localADefinir')} />
              <span class="extra">
                {r.fixo ? ' · ' + tx('rodada.jogoFixo') : ''}
                {r.locked ? ' · ' + tx('rodada.listaFechada') : ''}
              </span>
            </div>
            {r.place ? <ComoChegar local={r.place} /> : null}
          </div>
          <div class="count">
            {carregou ? a.inn.length : '…'}
            <small>{tx('rodada.confirmados')}</small>
          </div>
        </div>
        {carregou ? (
          <PorPosicao
            inn={a.inn}
            minimos={minimosDoGrupo()}
            acao={
              <button class="btn sm ghost" data-a="abrirMinimos">
                {tx('minimo.definir')}
              </button>
            }
          />
        ) : null}
        {carregou ? <Divergencia r={r} /> : null}
        {carregou ? <RespostasMudadas alt={alt} /> : null}
        <div class="row" style="margin-top:12px">
          <button class="btn sm primary" data-a="shareConvite">
            {tx('rodada.mandarLink')}
          </button>
          <button class="btn sm" data-a="copyLink">
            {tx('rodada.copiarLink')}
          </button>
          <button class="btn sm" data-a="editRod">
            {tx('rodada.editar')}
          </button>
          <button class="btn sm" data-a="lock">
            {tx(r.locked ? 'rodada.reabrir' : 'rodada.fechar')}
          </button>
          {r.fixo ? (
            <button class="btn sm ghost danger" data-a="cancelRod">
              {tx('rodada.cancelarData')}
            </button>
          ) : (
            <button class="btn sm ghost danger" data-a="delRod">
              {tx('rodada.excluir')}
            </button>
          )}
        </div>
      </div>
      {carregou ? <PainelVagas r={r} /> : null}
      {carregou ? <Cobrar r={r} /> : null}
      <Presenca r={r} inn={a.inn} carregou={carregou} avs={avs} />
      <Times r={r} inn={a.inn.length} />
      {r.times ? null : <BarraSortear k={a.inn.length} />}
    </div>
  );
}

/* Mínimo para o jogo (KAN-179): total de jogadores (qualquer esporte) e, se houver posições, o mínimo de cada uma. */
const minimosDoGrupo = (): Record<string, number> => (st().app?.cfg || {}).minPos || {};
function Minimos() {
  const m = minimosDoGrupo(),
    campo = (k: string, rotulo: string, titulo?: string) => (
      <label class="f minpos" key={k} title={titulo}>
        <span>{rotulo}</span>
        <input
          class="inp minp"
          type="number"
          inputmode="numeric"
          min="0"
          max="99"
          step="1"
          data-k={k}
          value={String(minimoValido(m[k]))}
        />
      </label>
    );
  return (
    <>
      <h3 id="minTitulo">{tx('minimo.dlgTitulo')}</h3>
      <p class="small muted">{tx('minimo.dlgAjuda')}</p>
      {campo(TOTAL, tx('minimo.campoTotal'))}
      {hasPos() ? (
        <>
          <p class="small muted" style="margin:10px 0 4px">
            {tx('minimo.porPosicao')}
          </p>
          <div class="minpos-grade">{(posKeys() as string[]).map(k => campo(k, k, posLabel(k)))}</div>
        </>
      ) : null}
      <p class="small muted" style="margin:14px 0 4px">
        {tx('vagas.titulo')}
      </p>
      <label class="chk-linha">
        <input type="checkbox" id="vagasCtrl" checked={controleVagas()} />
        <span>{tx('vagas.controle')}</span>
      </label>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="salvarMinimos">
          {tx('comum.salvar')}
        </button>
      </div>
    </>
  );
}
/* Vagas para diaristas e avulsos (KAN-63): com o controle ligado no grupo, só entram pelo link quando a rodada abre vagas. */
const controleVagas = (): boolean => !!(st().app?.cfg || {}).vagasCtrl;
const vagasDaRodada = (r: Rodada) => situacao(true, r.vagas, st().limVg);
function PainelVagas({ r }: { r: Rodada }) {
  if (!controleVagas()) return null;
  const v = vagasDaRodada(r),
    estado = !v.aberta
      ? tx('vagas.fechadas')
      : v.max
        ? tx(v.cheia ? 'vagas.esgotadas' : 'vagas.abertas', { n: v.n, max: v.max })
        : tp('vagas.abertasSemLimite', v.n);
  return (
    <div class="panel" id="vagasPainel">
      <h3 style="margin:0 0 4px">{tx('vagas.titulo')}</h3>
      <p class={'small' + (v.aberta && !v.cheia ? '' : ' muted')} id="vagasEstado" style="margin:0">
        {estado}
      </p>
      <div class="row" style="margin-top:10px">
        <button class={'btn sm' + (v.aberta && !v.cheia ? '' : ' primary')} data-a="abrirVagas">
          {tx(v.aberta ? 'vagas.mudar' : 'vagas.abrir')}
        </button>
        {v.aberta ? (
          <button class="btn sm" data-a="fecharVagas">
            {tx('vagas.fechar')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
/* Janela "Abrir vagas": já vem com o que falta para o mínimo do jogo (v58); vazio = sem limite. */
function AbrirVagas({ r, inn }: { r: Rodada; inn: number }) {
  const v = vagasDaRodada(r),
    sug = v.aberta ? v.max : faltaTotal(inn, minimosDoGrupo()).falta;
  return (
    <>
      <h3 id="vagasTitulo">{tx(v.aberta ? 'vagas.mudar' : 'vagas.abrir')}</h3>
      <p class="small muted">{tx('vagas.ajuda')}</p>
      <label class="f">
        <span>{tx('vagas.quantas')}</span>
        <input
          class="inp"
          id="vagasN"
          type="number"
          inputmode="numeric"
          min="0"
          max="99"
          step="1"
          placeholder={tx('vagas.semLimite')}
          value={sug ? String(sug) : ''}
          style="max-width:140px"
        />
      </label>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="salvarVagas">
          {tx(v.aberta ? 'comum.salvar' : 'vagas.abrir')}
        </button>
      </div>
    </>
  );
}
function montarVagas(r: Rodada, inn: number) {
  const el = document.getElementById('vagasRaiz');
  if (el) render(<AbrirVagas r={r} inn={inn} />, el);
}

/* Cor do colete (v60): escolha livre entre as cores; se outro time já usa, os dois trocam. */
function Coletes({ r, ti }: { r: Rodada; ti: number }) {
  const times = r.times || [];
  return (
    <>
      <h3 id="coleteTitulo">{tx('colete.titulo', { time: tn(ti) })}</h3>
      <p class="small muted">{tx('colete.ajuda')}</p>
      <div class="vgrid" id="coletes">
        {COL.map((x: { n: string; c: string }, c: number) => {
          const dono = times.findIndex(t => t.c === c);
          return (
            <button
              key={c}
              class="opt"
              data-a="pickColor"
              data-v={ti}
              data-c2={c}
              aria-pressed={dono === ti ? 'true' : 'false'}
            >
              <span class={'dot' + (x.n === 'Branco' ? ' branco' : '')} style={{ background: x.c }}></span>
              {x.n}
              {dono >= 0 && dono !== ti ? (
                <span class="tag" style="margin-left:auto">
                  {tn(dono)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
      </div>
    </>
  );
}
function montarColetes(r: Rodada, ti: number) {
  const el = document.getElementById('coleteRaiz');
  if (el) render(<Coletes r={r} ti={ti} />, el);
}

function montarMinimos() {
  const el = document.getElementById('minRaiz');
  if (el) render(<Minimos />, el);
}

/* A gestão desenha as abas com texto; a Rodada entra num lugar reservado (#rodadaRaiz) logo depois (como o Caixa). */
const vRodada = () => '<div id="rodadaRaiz"></div>';
function montarRodada() {
  const el = document.getElementById('rodadaRaiz');
  if (el) render(<RodadaTela />, el);
}

export { minimosDoGrupo, montarColetes, montarMinimos, montarRodada, montarVagas, vRodada };
