/* Link público da rodada (jogador sem conta): primeiro componente em TypeScript + Preact (decisão D2).
   O Preact monta a tela a partir do estado (S) e escapa todo texto sozinho: aqui não se monta HTML como texto.
   Os botões continuam com data-a, então as ações, o carregando e o aviso de sem sinal são os mesmos do resto do app. */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { APP, COL, sport, sportName, tn } from '../dominio/esportes.js';
import { attendance, fixos, gname, grpAtivo, isAvulso, normName, players, pname, ppos, rodById } from '../dominio/grupo.js';
import { hora } from '../dominio/rodadas.js';
import { LOCAL } from '../i18n/formatos.js';
import { tp, tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { $, fdate, main } from '../nucleo/util.js';
import { myLocal } from './publico-rodada.js';
import { partidasDe } from '../nucleo/partidas-lista.js';
import { ComoChegar, Pos, TextoCortado } from '../ui/componentes';
import { avulsosEsgotados } from '../dominio/limites';

type Rodada = { id: string; date: string; time?: string; place?: string; locked?: boolean; cancelada?: boolean; times?: { c: number; players: string[]; res?: string[] }[] | null };
type Presenca = { s?: 'in' | 'out'; nome?: string };

// O estado do app ainda é JavaScript sem tipos; aqui ele é lido como um objeto livre.
// Sempre dentro das funções: ao carregar este módulo o estado ainda não existe (regra de ordem, docs/ARQUITETURA.md).
const st = (): any => estado;

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

/* Placar das partidas já salvas (pelada-v18): só leitura para o jogador. */
function Placar({ rid }: { rid: string }) {
  const ms = partidasDe(rid) as { id: string; ca: number; cb: number; ga: number; gb: number }[];
  if (!ms.length) return null;
  return (
    <div class="panel"><h3>{tx('publico.partidas')}</h3>
      <ul class="plist wrap">{ms.map((m, i) => <li key={m.id}><span class="num">{i + 1}</span><span class="pn"><span class="dot" style={{ background: COL[(m.ca || 0) % COL.length].c }}></span> {tn(m.ca)} <b>{m.ga} × {m.gb}</b> {tn(m.cb)} <span class="dot" style={{ background: COL[(m.cb || 0) % COL.length].c }}></span></span></li>)}</ul>
    </div>
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
  const aberta = !r.locked;
  /* KAN-127: com a lista aberta, "Você vai?" vem logo depois do resumo e os times ficam recolhidos.
     Com a lista fechada, os times vêm primeiro e a lista de respostas é que fica recolhida.
     Fora dos blocos recolhidos, cada nome aparece uma vez só. */
  const times = r.times ? <div class="teams">{r.times.map((t, i) => <Time key={i} t={t} />)}</div> : null;
  return (
    <div class="stack">
      <div class="panel"><div class="hero-r">
        <div><h2>{fdate(r.date)}{r.time ? ' · ' + hora(r) : ''}</h2><div class="muted linha-local"><TextoCortado texto={r.place || tx('publico.localADefinir')} /></div>{r.place && <ComoChegar local={r.place} />}</div>
        <div class="count">{a.inn.length}<small>{tx('publico.confirmados')}</small></div>
      </div></div>
      {times && !aberta && <div class="panel"><h3>{tx('publico.timesSorteados')}</h3>{times}</div>}
      {aberta ? <Lista r={r} lista={lista} me={me} /> : (
        <details class="panel"><summary>{tx('publico.listaFechada')} · {tx('publico.verLista', { n: lista.length })}</summary>
          <p class="small muted" style={{ marginTop: '8px' }}>{tx('publico.listaFechadaTexto')}</p>
          <ul class="plist">{lista.map(id => <Linha key={id} id={id} r={r} me={me} />)}</ul>
        </details>)}
      {times && aberta && <details class="panel"><summary>{tx('publico.verTimes', { n: r.times!.length })}</summary><div style={{ marginTop: '12px' }}>{times}</div></details>}
      <Placar rid={r.id} />
      {a.inn.length > 0 && <details class="panel"><summary>{tp('publico.confirmadosVer', a.inn.length)}</summary><ol class="plist">{a.inn.map((id, i) => <li key={id}><span class="num">{i + 1}</span><span class="pn">{pname(id)}</span><Pos id={id} /></li>)}</ol></details>}
      <div class="foot"><a href="#/">{tx('publico.rodape', { app: APP })}</a></div>
    </div>
  );
}

/* "Você vai?" com a busca pelo nome (KAN-127): filtra enquanto digita, sem diferenciar acentos e maiúsculas. */
function Lista({ r, lista, me }: { r: Rodada; lista: string[]; me: string | null }) {
  const [busca, setBusca] = useState('');
  const q = normName(busca) as string;
  const vis = q ? lista.filter(id => (normName(pname(id)) as string).includes(q)) : lista;
  const esgotou = avulsosEsgotados(st().limAv, st().limCfg);
  return (
    <div class="panel">
      <h3>{tx('publico.voceVai')}</h3>
      <p class="small muted" style={{ marginTop: '-6px' }}>{tx('publico.instrucao')}</p>
      {lista.length > 0 && <label class="f busca-nome"><span>{tx('publico.buscar')}</span>
        <input class="inp" id="pbusca" type="search" autocomplete="off" enterkeyhint="search" value={busca} onInput={e => setBusca((e.target as HTMLInputElement).value)} /></label>}
      <ul class="plist">{vis.length ? vis.map(id => <Linha key={id} id={id} r={r} me={me} />)
        : <li class="muted small">{lista.length ? tx('publico.buscarVazio') : tx('publico.listaVazia')}</li>}</ul>
      {esgotou
        ? <p class="small muted aviso-limite" style={{ marginTop: '14px' }}>{tx('limite.avulsosPublico')}</p>
        : <div class="row" style={{ marginTop: '14px' }}><span class="small muted" style={{ flex: 1 }}>{tx('publico.semNome')}</span><button class="btn primary" data-a="pubAdd" data-v={busca.trim()}>{tx('publico.adicionarNome')}</button></div>}
    </div>
  );
}

let montado = false;
/* Desenha (ou atualiza) o link público dentro de <main>. */
function montarPublico() {
  const S = st();
  ($('#tabsnav') as HTMLElement).hidden = true; ($('#topright') as HTMLElement).replaceChildren();
  const r = rodById(S.route.id) as Rodada | null, ok = S.app && grpAtivo() && r && !r.cancelada;
  ($('#gsub') as HTMLElement).textContent = ok ? tx('publico.subtitulo', { emoji: sport().e, esporte: sportName() }) : '';
  if (!montado) { main.replaceChildren(); montado = true; }
  render(<PublicoRodada />, main);
}
/* Antes de outra tela escrever em <main>, o Preact solta a tela pública. */
function desmontarPublico() { if (montado) { render(null, main); montado = false; } }

export { desmontarPublico, montarPublico };
