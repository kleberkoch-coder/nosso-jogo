/* Link público da rodada (jogador sem conta): primeiro componente em TypeScript + Preact (decisão D2).
   O Preact monta a tela a partir do estado (S) e escapa todo texto sozinho: aqui não há innerHTML.
   Os botões continuam com data-a, então as ações, o carregando e o aviso de sem sinal são os mesmos do resto do app. */
import { render } from 'preact';
import { APP, COL, hasPos, posLabel, sport, sportName, tn } from '../dominio/esportes.js';
import { attendance, fixos, gname, grpAtivo, isAvulso, players, pname, ppos, rodById } from '../dominio/grupo.js';
import { hora } from '../dominio/rodadas.js';
import { LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { $, fdate, main } from '../nucleo/util.js';
import { myLocal } from './publico-rodada.js';

type Rodada = { id: string; date: string; time?: string; place?: string; locked?: boolean; cancelada?: boolean; times?: { c: number; players: string[]; res?: string[] }[] | null };
type Presenca = { s?: 'in' | 'out'; nome?: string };

// O estado do app ainda é JavaScript sem tipos; aqui ele é lido como um objeto livre.
// Sempre dentro das funções: ao carregar este módulo o estado ainda não existe (regra de ordem, docs/ARQUITETURA.md).
const st = (): any => estado;

function Pos({ id }: { id: string }) {
  const k = ppos(id) as string;
  if (!hasPos() || !k) return null;
  return <span class={'pos ' + (k === sport().key ? 'GOL' : '')} title={posLabel(k)}>{k}</span>;
}

function Time({ t }: { t: { c: number; players: string[]; res?: string[] } }) {
  const c = COL[(t.c || 0) % COL.length], pares = !!(sport() as { pairs?: boolean }).pairs;
  const ordem = (id: string) => { const i = sport().pos.findIndex((x: string[]) => x[0] === ppos(id)); return i < 0 ? 99 : i; };
  const rs = (id: string) => ((t.res || []).includes(id) ? 1 : 0);
  const ps = t.players.slice().sort((a, b) => rs(a) - rs(b) || ordem(a) - ordem(b));
  return (
    <div class="team">
      <div class={'band' + (c.n === 'Branco' && !pares ? ' branco' : '')} style={{ background: c.c }}></div>
      <div class="th"><b>{tn(t.c)}</b><span class="tag">{t.players.length}</span></div>
      <ul>{ps.map(id => <li key={id} class={rs(id) ? 'reserva' : ''}><Pos id={id} /><span class="pn">{pname(id)}{rs(id) ? <> <span class="tag">· {tx('times.reserva')}</span></> : null}</span></li>)}</ul>
    </div>
  );
}

function Aviso({ titulo, texto, extra }: { titulo: string; texto: string; extra?: preact.ComponentChildren }) {
  return <div class="panel empty"><h2>{titulo}</h2><p class="muted">{texto}</p>{extra}</div>;
}

function Linha({ id, r, me }: { id: string; r: Rodada; me: string | null }) {
  const S = st();
  const s = (S.pres[id] as Presenca | undefined)?.s;
  return (
    <li class={id === me ? 'me-row' : ''}>
      <Pos id={id} />
      <span class="pn">{pname(id)}{id === me && <> <span class="tag">{tx('publico.voce')}</span></>}{isAvulso(id) && <> <span class="tag">{tx('publico.avulso')}</span></>}</span>
      {r.locked
        ? <span class="tag" style={{ color: s === 'in' ? 'var(--in)' : s === 'out' ? 'var(--out)' : '' }}>{s === 'in' ? tx('publico.vai') : s === 'out' ? tx('publico.naoVai') : '—'}</span>
        : <span class="mk lg">
            <button class={s === 'in' ? 'on-in' : ''} data-a="pubMark" data-p={id} data-v="in" aria-pressed={s === 'in'}>{s === 'in' ? '✓ ' : ''}{tx('publico.vou')}</button>
            <button class={s === 'out' ? 'on-out' : ''} data-a="pubMark" data-p={id} data-v="out" aria-pressed={s === 'out'}>{s === 'out' ? '✕ ' : ''}{tx('publico.naoVou')}</button>
          </span>}
    </li>
  );
}

function PublicoRodada() {
  const S = st();
  const r = rodById(S.route.id) as Rodada | null;
  const carregou = S.route.next ? (S.loaded.rods && S.loaded.app) : (S.loaded.r && S.loaded.app);
  if (!carregou) return <div class="empty muted">{tx('comum.carregando')}</div>;
  if (!S.app) return <Aviso titulo={tx('publico.grupoNaoEncontrado')} texto={tx('publico.grupoNaoEncontradoTexto')} />;
  if (!grpAtivo()) return <Aviso titulo={gname()} texto={tx('publico.grupoInativo')} />;
  if (!r && S.route.next) return <Aviso titulo={tx('publico.semJogo')} texto={tx('publico.semJogoTexto')} />;
  if (r && r.cancelada) return <Aviso titulo={tx('publico.cancelado', { data: fdate(r.date) })} texto={tx('publico.canceladoTexto')}
    extra={fixos().length ? <a class="btn primary" href={'#/p/' + S.gid}>{tx('publico.verProxima')}</a> : null} />;
  if (!r) return <Aviso titulo={tx('publico.rodadaNaoEncontrada')} texto={tx('publico.rodadaNaoEncontradaTexto')} />;

  const a = attendance() as { inn: string[] }, me = myLocal() as string | null;
  const ids: string[] = players().map((p: { id: string }) => p.id).concat(Object.keys(S.pres).filter(id => isAvulso(id) && S.pres[id].nome));
  const lista = [...new Set(ids)].sort((x, y) => (x === me ? -1 : y === me ? 1 : pname(x).localeCompare(pname(y), LOCAL)));
  return (
    <div class="stack">
      <div class="panel"><div class="hero-r">
        <div><h2>{fdate(r.date)}{r.time ? ' · ' + hora(r) : ''}</h2><div class="muted">{r.place || tx('publico.localADefinir')}</div></div>
        <div class="count">{a.inn.length}<small>{tx('publico.confirmados')}</small></div>
      </div></div>
      {r.times && <div class="panel"><h3>{tx('publico.timesSorteados')}</h3><div class="teams">{r.times.map((t, i) => <Time key={i} t={t} />)}</div></div>}
      <div class="panel">
        <h3>{r.locked ? tx('publico.listaFechada') : tx('publico.voceVai')}</h3>
        <p class="small muted" style={{ marginTop: '-6px' }}>{r.locked ? tx('publico.listaFechadaTexto') : tx('publico.instrucao')}</p>
        <ul class="plist">{lista.length ? lista.map(id => <Linha key={id} id={id} r={r} me={me} />) : <li class="muted small">{tx('publico.listaVazia')}</li>}</ul>
        {!r.locked && <div class="row" style={{ marginTop: '14px' }}><span class="small muted" style={{ flex: 1 }}>{tx('publico.semNome')}</span><button class="btn primary" data-a="pubAdd">{tx('publico.adicionarNome')}</button></div>}
      </div>
      {a.inn.length > 0 && <div class="panel"><h3>{tx('publico.confirmadosTitulo')}</h3><ol class="plist">{a.inn.map((id, i) => <li key={id}><span class="num">{i + 1}</span><span class="pn">{pname(id)}</span><Pos id={id} /></li>)}</ol></div>}
      <div class="foot"><a href="#/">{tx('publico.rodape', { app: APP })}</a></div>
    </div>
  );
}

let montado = false;
/* Desenha (ou atualiza) o link público dentro de <main>. */
function montarPublico() {
  const S = st();
  ($('#tabsnav') as HTMLElement).hidden = true; ($('#topright') as HTMLElement).innerHTML = '';
  const r = rodById(S.route.id) as Rodada | null, ok = S.app && grpAtivo() && r && !r.cancelada;
  ($('#gsub') as HTMLElement).textContent = ok ? tx('publico.subtitulo', { emoji: sport().e, esporte: sportName() }) : '';
  if (!montado) { main.innerHTML = ''; montado = true; }
  render(<PublicoRodada />, main);
}
/* Antes de outra tela escrever em <main>, o Preact solta a tela pública. */
function desmontarPublico() { if (montado) { render(null, main); montado = false; } }

export { desmontarPublico, montarPublico };
