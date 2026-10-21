/* Link público da rodada (jogador sem conta): primeiro componente em TypeScript + Preact (decisão D2).
   O Preact monta a tela a partir do estado (S) e escapa todo texto sozinho: aqui não se monta HTML como texto.
   Os botões continuam com data-a, então as ações, o carregando e o aviso de sem sinal são os mesmos do resto do app. */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { APP, COL, colete, sport, sportName, tn, tnJogo } from '../dominio/esportes.js';
import {
  attendance,
  fixos,
  gname,
  grpAtivo,
  isAvulso,
  normName,
  players,
  pname,
  ppos,
  rodById,
} from '../dominio/grupo.js';
import { hora } from '../dominio/rodadas.js';
import { LOCAL } from '../i18n/formatos.js';
import { tp, tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { $, fdate, main } from '../nucleo/util.js';
import { myLocal } from './publico-rodada.js';
import { partidasDe } from '../nucleo/partidas-lista.js';
import { ComoChegar, Pos, PorPosicao, TextoCortado } from '../ui/componentes';
import { avulsosEsgotados } from '../dominio/limites';
import { DEMORA_MS } from '../nucleo/carga';
import { precisaVaga, situacao } from '../dominio/vagas';

type Rodada = {
  id: string;
  vagas?: { aberta?: boolean; max?: number };
  date: string;
  time?: string;
  place?: string;
  locked?: boolean;
  cancelada?: boolean;
  times?: { c: number; players: string[]; res?: string[] }[] | null;
};
type Presenca = { s?: 'in' | 'out'; nome?: string };

// O estado do app ainda é JavaScript sem tipos; aqui ele é lido como um objeto livre.
// Sempre dentro das funções: ao carregar este módulo o estado ainda não existe (regra de ordem, docs/ARQUITETURA.md).
const st = (): any => estado;

function Time({ t, i }: { t: { c: number; players: string[]; res?: string[] }; i: number }) {
  const c = COL[(t.c || 0) % COL.length],
    pares = !!(sport() as { pairs?: boolean }).pairs;
  const ordem = (id: string) => {
    const i = sport().pos.findIndex((x: string[]) => x[0] === ppos(id));
    return i < 0 ? 99 : i;
  };
  const rs = (id: string) => ((t.res || []).includes(id) ? 1 : 0);
  const ps = t.players.slice().sort((a, b) => rs(a) - rs(b) || ordem(a) - ordem(b));
  return (
    <div class="team">
      <div class={'band' + (c.n === 'Branco' && !pares ? ' branco' : '')} style={{ background: c.c }}></div>
      <div class="th">
        <b>{tn(i)}</b>
        <span class="tag">
          {pares ? '' : colete(t.c) + ' · '}
          {t.players.length}
        </span>
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
                  <span class="tag">· {tx('times.reserva')}</span>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Carregando (KAN-184): depois de 12 s, avisa que está demorando e oferece tentar de novo. */
let desde = 0;
function Carregando() {
  if (!desde) {
    desde = Date.now();
    setTimeout(() => {
      if (desde && st().route.n === 'r') montarPublico();
    }, DEMORA_MS + 50);
  }
  return Date.now() - desde >= DEMORA_MS ? (
    <div class="panel empty" id="cargaDemorada">
      <p class="muted">{tx('carga.demorando')}</p>
      <button class="btn primary" data-a="recarregar">
        {tx('carga.tentarDeNovo')}
      </button>
    </div>
  ) : (
    <div class="empty muted">{tx('comum.carregando')}</div>
  );
}
function FalhouCarga() {
  return (
    <Aviso
      titulo={tx('comum.naoCarregouTitulo')}
      texto={tx('carga.falhouTexto')}
      extra={
        <button class="btn primary" data-a="recarregar" id="cargaFalhou">
          {tx('carga.tentarDeNovo')}
        </button>
      }
    />
  );
}
function Aviso({ titulo, texto, extra }: { titulo: string; texto: string; extra?: preact.ComponentChildren }) {
  return (
    <div class="panel empty">
      <h2>{titulo}</h2>
      <p class="muted">{texto}</p>
      {extra}
    </div>
  );
}

function Linha({ id, r, me }: { id: string; r: Rodada; me: string | null }) {
  const S = st();
  const s = (S.pres[id] as Presenca | undefined)?.s;
  return (
    <li class={id === me ? 'me-row' : ''}>
      <Pos id={id} />
      <span class="pn">
        {pname(id)}
        {id === me && (
          <>
            {' '}
            <span class="tag">{tx('publico.voce')}</span>
          </>
        )}
        {isAvulso(id) && (
          <>
            {' '}
            <span class="tag">{tx('publico.avulso')}</span>
          </>
        )}
      </span>
      {r.locked ? (
        <span class="tag" style={{ color: s === 'in' ? 'var(--in)' : s === 'out' ? 'var(--out)' : '' }}>
          {s === 'in' ? tx('publico.vai') : s === 'out' ? tx('publico.naoVai') : '—'}
        </span>
      ) : (
        <span class="mk lg">
          <button class={s === 'in' ? 'on-in' : ''} data-a="pubMark" data-p={id} data-v="in" aria-pressed={s === 'in'}>
            {s === 'in' ? '✓ ' : ''}
            {tx('publico.vou')}
          </button>
          <button
            class={s === 'out' ? 'on-out' : ''}
            data-a="pubMark"
            data-p={id}
            data-v="out"
            aria-pressed={s === 'out'}
          >
            {s === 'out' ? '✕ ' : ''}
            {tx('publico.naoVou')}
          </button>
        </span>
      )}
    </li>
  );
}

/* Placar das partidas já salvas (pelada-v18): só leitura para o jogador. */
function Placar({ r }: { r: Rodada }) {
  const ms = partidasDe(r.id) as { id: string; ca: number; cb: number; ga: number; gb: number }[];
  if (!ms.length) return null;
  return (
    <div class="panel">
      <h3>{tx('publico.partidas')}</h3>
      <ul class="plist wrap">
        {ms.map((m, i) => (
          <li key={m.id}>
            <span class="num">{i + 1}</span>
            <span class="pn">
              <span class="dot" style={{ background: COL[(m.ca || 0) % COL.length].c }}></span>{' '}
              {tnJogo(m, 'a', r.times)}{' '}
              <b>
                {m.ga} × {m.gb}
              </b>{' '}
              {tnJogo(m, 'b', r.times)}{' '}
              <span class="dot" style={{ background: COL[(m.cb || 0) % COL.length].c }}></span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PublicoRodada() {
  const S = st();
  const r = rodById(S.route.id) as Rodada | null;
  const carregou = S.route.next ? S.loaded.rods && S.loaded.app : S.loaded.r && S.loaded.app;
  /* KAN-184: falha de rede (depois das novas tentativas) avisa e oferece tentar de novo; nunca vira "não encontrado". */
  if (['app', 'r', 'rods'].some(k => (S.falhou || {})[k])) return <FalhouCarga />;
  if (!carregou) return <Carregando />;
  desde = 0;
  if (!S.app) return <Aviso titulo={tx('publico.grupoNaoEncontrado')} texto={tx('publico.grupoNaoEncontradoTexto')} />;
  if (!grpAtivo()) return <Aviso titulo={gname()} texto={tx('publico.grupoInativo')} />;
  if (!r && S.route.next) return <Aviso titulo={tx('publico.semJogo')} texto={tx('publico.semJogoTexto')} />;
  if (r && r.cancelada)
    return (
      <Aviso
        titulo={tx('publico.cancelado', { data: fdate(r.date) })}
        texto={tx('publico.canceladoTexto')}
        extra={
          fixos().length ? (
            <a class="btn primary" href={'#/p/' + S.gid}>
              {tx('publico.verProxima')}
            </a>
          ) : null
        }
      />
    );
  if (!r) return <Aviso titulo={tx('publico.rodadaNaoEncontrada')} texto={tx('publico.rodadaNaoEncontradaTexto')} />;

  const a = attendance() as { inn: string[] },
    me = myLocal() as string | null;
  const ids: string[] = players()
    .map((p: { id: string }) => p.id)
    .concat(Object.keys(S.pres).filter(id => isAvulso(id) && S.pres[id].nome));
  /* KAN-63: com as vagas para diaristas e avulsos fechadas (ou esgotadas), quem precisa de vaga some do link,
     a não ser que já esteja confirmado. */
  const vg = vagasDoLink(r);
  const visiveis = vg.podeEntrar
    ? ids
    : ids.filter(id => !precisaVaga((S.jog || {})[id]) || (S.pres[id] && S.pres[id].s === 'in'));
  const lista = [...new Set(visiveis)].sort((x, y) =>
    x === me ? -1 : y === me ? 1 : pname(x).localeCompare(pname(y), LOCAL)
  );
  const aberta = !r.locked;
  /* KAN-127: com a lista aberta, "Você vai?" vem logo depois do resumo e os times ficam recolhidos.
     Com a lista fechada, os times vêm primeiro e a lista de respostas é que fica recolhida.
     Fora dos blocos recolhidos, cada nome aparece uma vez só. */
  const times = r.times ? (
    <div class="teams">
      {r.times.map((t, i) => (
        <Time key={i} t={t} i={i} />
      ))}
    </div>
  ) : null;
  return (
    <div class="stack">
      <div class="panel">
        <div class="hero-r">
          <div>
            <h2>
              {fdate(r.date)}
              {r.time ? ' · ' + hora(r) : ''}
            </h2>
            <div class="muted linha-local">
              <TextoCortado texto={r.place || tx('publico.localADefinir')} />
            </div>
            {r.place && <ComoChegar local={r.place} />}
          </div>
          <div class="count">
            {a.inn.length}
            <small>{tx('publico.confirmados')}</small>
          </div>
        </div>
        <PorPosicao inn={a.inn} minimos={(S.app.cfg || {}).minPos} />
      </div>
      {times && !aberta && (
        <div class="panel">
          <h3>{tx('publico.timesSorteados')}</h3>
          {times}
        </div>
      )}
      {aberta ? (
        <Lista r={r} lista={lista} me={me} />
      ) : (
        <details class="panel">
          <summary>
            {tx('publico.listaFechada')} · {tx('publico.verLista', { n: lista.length })}
          </summary>
          <p class="small muted" style={{ marginTop: '8px' }}>
            {tx('publico.listaFechadaTexto')}
          </p>
          <ul class="plist">
            {lista.map(id => (
              <Linha key={id} id={id} r={r} me={me} />
            ))}
          </ul>
        </details>
      )}
      {times && aberta && (
        <details class="panel">
          <summary>{tx('publico.verTimes', { n: r.times!.length })}</summary>
          <div style={{ marginTop: '12px' }}>{times}</div>
        </details>
      )}
      <Placar r={r} />
      {a.inn.length > 0 && (
        <details class="panel">
          <summary>{tp('publico.confirmadosVer', a.inn.length)}</summary>
          <ol class="plist">
            {a.inn.map((id, i) => (
              <li key={id}>
                <span class="num">{i + 1}</span>
                <span class="pn">{pname(id)}</span>
                <Pos id={id} />
              </li>
            ))}
          </ol>
        </details>
      )}
      <div class="foot">
        <a href="#/">{tx('publico.rodape', { app: APP })}</a>
      </div>
    </div>
  );
}

/* "Você vai?" com a busca pelo nome (KAN-127): filtra enquanto digita, sem diferenciar acentos e maiúsculas. */
/* Vagas para diaristas e avulsos desta rodada, como o link vê (KAN-63). */
function vagasDoLink(r: Rodada) {
  const S = st();
  return situacao(!!((S.app || {}).cfg || {}).vagasCtrl, r.vagas, S.limVg);
}
function AvisoVagas({ r }: { r: Rodada }) {
  const v = vagasDoLink(r);
  const texto = !v.podeEntrar
    ? tx(v.cheia ? 'vagaslink.esgotadas' : 'vagaslink.fechadas')
    : v.aberta && v.max && ((st().app || {}).cfg || {}).vagasCtrl
      ? tp('vagaslink.restam', v.max - v.n)
      : '';
  return texto ? (
    <p class={'small aviso-vagas' + (v.podeEntrar ? ' muted' : '')} id="avisoVagas">
      {texto}
    </p>
  ) : null;
}
function Lista({ r, lista, me }: { r: Rodada; lista: string[]; me: string | null }) {
  const [busca, setBusca] = useState('');
  const q = normName(busca) as string;
  const vis = q ? lista.filter(id => (normName(pname(id)) as string).includes(q)) : lista;
  const esgotou = avulsosEsgotados(st().limAv, st().limCfg),
    semVaga = !vagasDoLink(r).podeEntrar;
  return (
    <div class="panel">
      <h3>{tx('publico.voceVai')}</h3>
      <p class="small muted" style={{ marginTop: '-6px' }}>
        {tx('publico.instrucao')}
      </p>
      {lista.length > 0 && (
        <label class="f busca-nome">
          <span>{tx('publico.buscar')}</span>
          <input
            class="inp"
            id="pbusca"
            type="search"
            autocomplete="off"
            enterkeyhint="search"
            value={busca}
            onInput={e => setBusca((e.target as HTMLInputElement).value)}
          />
        </label>
      )}
      <ul class="plist">
        {vis.length ? (
          vis.map(id => <Linha key={id} id={id} r={r} me={me} />)
        ) : (
          <li class="muted small">{lista.length ? tx('publico.buscarVazio') : tx('publico.listaVazia')}</li>
        )}
      </ul>
      <AvisoVagas r={r} />
      {semVaga ? null : esgotou ? (
        <p class="small muted aviso-limite" style={{ marginTop: '14px' }}>
          {tx('limite.avulsosPublico')}
        </p>
      ) : (
        <div class="row" style={{ marginTop: '14px' }}>
          <span class="small muted" style={{ flex: 1 }}>
            {tx('publico.semNome')}
          </span>
          <button class="btn primary" data-a="pubAdd" data-v={busca.trim()}>
            {tx('publico.adicionarNome')}
          </button>
        </div>
      )}
    </div>
  );
}

let montado = false;
/* Desenha (ou atualiza) o link público dentro de <main>. */
function montarPublico() {
  const S = st();
  ($('#tabsnav') as HTMLElement).hidden = true;
  ($('#topright') as HTMLElement).replaceChildren();
  const r = rodById(S.route.id) as Rodada | null,
    ok = S.app && grpAtivo() && r && !r.cancelada;
  ($('#gsub') as HTMLElement).textContent = ok
    ? tx('publico.subtitulo', { emoji: sport().e, esporte: sportName() })
    : '';
  if (!montado) {
    main.replaceChildren();
    montado = true;
  }
  render(<PublicoRodada />, main);
}
/* Antes de outra tela escrever em <main>, o Preact solta a tela pública. */
function desmontarPublico() {
  if (montado) {
    render(null, main);
    montado = false;
  }
}

export { desmontarPublico, montarPublico };
