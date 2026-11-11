/* Extra da rodada no link do jogador (KAN-228): churrasco, pizzada… com resposta separada da do jogo.
   Baixa sob demanda, só quando a rodada tem extra (o link do jogador continua leve). Traz o painel e as ações. */
import { useEffect } from 'preact/hooks';
import { comConvidado, LIMITE_CONVIDADOS, resumoExtra } from '../dominio/extra';
import { pname } from '../dominio/grupo.js';
import estilo from '../estilos/extra.css' with { type: 'text' };
import { juntarTextos, tp, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-extra';
import { semConexao } from '../eventos.js';
import { GB, S, w } from '../nucleo/estado';
import type { Extra, RespostaExtra } from '../nucleo/tipos';
import { $, brl, toast } from '../nucleo/util.js';
import { changed } from '../ui/render.js';
import { usarEstilo } from '../ui/estilo';
import { NomeNaLista } from '../ui/componentes';

juntarTextos(textos);
usarEstilo('extra', estilo);

type El = HTMLElement & { dataset: DOMStringMap };
/* De quem está com o campo de convidado aberto (um por vez). */
let abrindo: string | null = null;

function gravar(pid: string, o: RespostaExtra) {
  const rid = S.route.id as string;
  S.ext = Object.assign({}, S.ext, { [pid]: o });
  changed();
  return w(GB.set('rodadas/' + rid + '/extra/' + pid, o));
}
function resposta(pid: string, s: 'in' | 'out', conv?: string[]): RespostaExtra | null {
  const u = S.user;
  if (!u) return null;
  const a = (S.ext || {})[pid] || ({} as RespostaExtra),
    o: RespostaExtra = { s, t: a.s === s && a.t ? a.t : Date.now(), by: u.uid, dev: a.dev || u.uid };
  const c = conv || a.conv;
  if (c && c.length) o.conv = c;
  return o;
}
const nomeExtra = () => (rodadaAtual()?.extra as Extra | undefined)?.n || '';
const rodadaAtual = () => (S.rod || {})[S.route.id as string];

export const acoes: Record<string, (el: El) => unknown> = {
  pubExtra: el => {
    const pid = el.dataset.p || '',
      s = el.dataset.v === 'out' ? 'out' : 'in',
      o = resposta(pid, s);
    if (!o) return semConexao();
    if (s === 'out') abrindo = null;
    toast(tx(s === 'in' ? 'extra.ok' : 'extra.okNao', { nome: pname(pid), n: nomeExtra() }));
    return gravar(pid, o);
  },
  pubConvAbrir: el => {
    abrindo = el.dataset.p || null;
    changed();
    setTimeout(() => ($('#extraConv') as HTMLInputElement | null)?.focus(), 30);
  },
  pubConvSalvar: el => {
    const pid = el.dataset.p || '',
      campo = $('#extraConv') as HTMLInputElement | null,
      r = comConvidado(((S.ext || {})[pid] || {}).conv, campo ? campo.value : '');
    if ('erro' in r) {
      toast(tx(r.erro === 'cheio' ? 'extra.erroCheio' : r.erro === 'vazio' ? 'extra.erroVazio' : 'extra.erroRepetido'));
      campo?.focus();
      return;
    }
    const o = resposta(pid, 'in', r.conv);
    if (!o) return semConexao();
    if (campo) campo.value = '';
    abrindo = null;
    return gravar(pid, o);
  },
  pubConvTirar: el => {
    const pid = el.dataset.p || '',
      i = +(el.dataset.i || -1),
      conv = (((S.ext || {})[pid] || {}).conv || []).filter((_, k) => k !== i),
      o = resposta(pid, (((S.ext || {})[pid] || {}).s as 'in' | 'out') || 'in', conv);
    if (!o) return semConexao();
    if (!conv.length) delete o.conv;
    return gravar(pid, o);
  },
};

function Linha({ id, me }: { id: string; me: string | null }) {
  const r = (S.ext || {})[id],
    s = r && r.s,
    conv = (r && r.conv) || [],
    n = nomeExtra();
  return (
    <li class={id === me ? 'me-row' : ''} data-extra={id}>
      <NomeNaLista nome={pname(id)} voce={id === me} />
      <span class="mk lg">
        <button
          class={s === 'in' ? 'on-in' : ''}
          data-a="pubExtra"
          data-p={id}
          data-v="in"
          aria-pressed={s === 'in'}
          aria-label={tx('extra.vaiRotulo', { nome: pname(id), n })}
        >
          {s === 'in' ? '✓ ' : ''}
          {tx('publico.vou')}
        </button>
        <button
          class={s === 'out' ? 'on-out' : ''}
          data-a="pubExtra"
          data-p={id}
          data-v="out"
          aria-pressed={s === 'out'}
          aria-label={tx('extra.naoVaiRotulo', { nome: pname(id), n })}
        >
          {s === 'out' ? '✕ ' : ''}
          {tx('publico.naoVou')}
        </button>
      </span>
      {s === 'in' ? (
        <div class="extra-conv">
          {conv.map((c, i) => (
            <span class="tag" key={c}>
              {tx('extra.convidadoDe', { nome: c, de: pname(id) })}
              <button
                class="linkbtn"
                data-a="pubConvTirar"
                data-p={id}
                data-i={i}
                aria-label={tx('extra.tirarConvidado', { nome: c })}
              >
                ✕
              </button>
            </span>
          ))}
          {conv.length < LIMITE_CONVIDADOS && abrindo !== id ? (
            <button class="btn sm ghost" data-a="pubConvAbrir" data-p={id}>
              {tx('extra.convidar')}
            </button>
          ) : null}
        </div>
      ) : null}
      {s === 'in' && abrindo === id ? <NovoConvidado id={id} /> : null}
    </li>
  );
}
function NovoConvidado({ id }: { id: string }) {
  useEffect(() => {
    ($('#extraConv') as HTMLInputElement | null)?.focus();
  }, []);
  return (
    <div class="extra-novo">
      <input
        class="inp"
        id="extraConv"
        maxLength={40}
        autocomplete="off"
        enterkeyhint="done"
        aria-label={tx('extra.convidadoNome')}
        placeholder={tx('extra.convidadoNome')}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            ($('#extraConvOk') as HTMLButtonElement | null)?.click();
          }
        }}
      />
      <button class="btn sm primary" id="extraConvOk" data-a="pubConvSalvar" data-p={id}>
        {tx('extra.adicionar')}
      </button>
    </div>
  );
}

/* Painel do extra no link: a minha resposta primeiro; os outros nomes, recolhidos (dá para responder por alguém,
   como no jogo). */
export function PainelExtra({ ids, me }: { ids: string[]; me: string | null }) {
  const e = rodadaAtual()?.extra as Extra | undefined;
  if (!e) return null;
  const res = resumoExtra(S.ext),
    meu = me && ids.includes(me) ? me : null,
    outros = ids.filter(id => id !== meu);
  return (
    <div class="panel extra-painel" id="extraPainel">
      <h3>{tx('extra.titulo', { n: e.n })}</h3>
      <p class="small muted" style={{ marginTop: '-6px' }}>
        {tx('extra.instrucao')}
        {e.v ? ' ' + tx('extra.valor', { valor: brl(e.v) }) : ''}
      </p>
      <p class="extra-total" id="extraTotal">
        <b>{tp('extra.total', res.total)}</b>
        {res.convidados.length ? ' ' + tp('extra.comConvidados', res.convidados.length) : ''}
      </p>
      {meu ? (
        <ul class="plist">
          <Linha id={meu} me={me} />
        </ul>
      ) : null}
      <details class="extra-todos" open={!meu}>
        <summary>{tx(meu ? 'extra.verTodos' : 'extra.verTodosSemMe', { n: outros.length })}</summary>
        <ul class="plist">
          {outros.map(id => (
            <Linha key={id} id={id} me={me} />
          ))}
        </ul>
      </details>
    </div>
  );
}
