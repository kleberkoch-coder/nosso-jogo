/* Link da votação (KAN-218: virou componente; antes montava a tela como texto). O jogador escolhe o nome e vota em cada
   categoria; encerrada, mostra os vencedores. Baixa só quando o link de votação é aberto (KAN-183). Os botões usam
   data-a (pubVote, acoes/publico.js). */
import { render } from 'preact';
import { gname, grpAtivo, pname, ppos, rodDoc } from '../dominio/grupo.js';
import { candidatos, type Categoria, type Votacao } from '../dominio/votacao';
import { LOCAL } from '../i18n/formatos.js';
import { tp, tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { $, fdate, main } from '../nucleo/util.js';
import { myLocal } from './publico-rodada.js';
import { DEMORA_MS } from '../nucleo/carga';

/* Candidatos de uma categoria (regra em dominio/votacao.ts) com os dados da rodada. */
const candidates = (v: Votacao, c: Categoria) =>
  candidatos((rodDoc(v.rid) as { times?: { players: string[] }[] } | null)?.times, c, ppos, pname, LOCAL);

const st = (): any => estado;
type Vot = {
  rid: string;
  title: string;
  open?: boolean;
  selfVote?: boolean;
  cats: Categoria[];
  resultado?: Record<string, { winners: string[]; counts: Record<string, number> }>;
};

let desde = 0;
function Aviso({ titulo, texto, tentar }: { titulo?: string; texto: string; tentar?: boolean }) {
  return (
    <div class="panel empty">
      {titulo ? <h2>{titulo}</h2> : null}
      <p class="muted">{texto}</p>
      {tentar ? (
        <button class="btn primary" data-a="recarregar">
          {tx('carga.tentarDeNovo')}
        </button>
      ) : null}
    </div>
  );
}

function Pagina() {
  const S = st(),
    v: Vot | undefined = S.vot[S.route.id];
  /* KAN-184: falha de rede (depois das novas tentativas) avisa e oferece tentar de novo; nunca vira "não encontrada".
     Carregando há mais de 12 s, avisa que está demorando. */
  const carregou = S.loaded.v && S.loaded.app;
  if ((S.falhou || {}).v || (S.falhou || {}).app)
    return <Aviso titulo={tx('comum.naoCarregouTitulo')} texto={tx('carga.falhouTexto')} tentar />;
  if (!carregou)
    return Date.now() - desde >= DEMORA_MS ? (
      <Aviso texto={tx('carga.demorando')} tentar />
    ) : (
      <div class="empty muted">{tx('comum.carregando')}</div>
    );
  if (!grpAtivo()) return <Aviso titulo={gname()} texto={tx('voto.grupoInativo')} />;
  if (!v) return <Aviso titulo={tx('voto.naoEncontrada')} texto={tx('voto.naoEncontradaTexto')} />;
  const r = S.rod[v.rid],
    my = S.myVote || {},
    me: string = my.pid || myLocal();
  const rodadaDe = r ? tx('voto.rodadaDe', { data: fdate(r.date) }) : '';
  if (!v.open) {
    const res = v.resultado || {};
    return (
      <div class="stack">
        <div class="panel">
          <h2>{v.title}</h2>
          <p class="muted small">
            {rodadaDe}
            {tx('voto.encerrada')}
          </p>
        </div>
        {v.cats.map(c => {
          const R = res[c.id] || { winners: [], counts: {} };
          return (
            <div class="panel" key={c.id}>
              <h3>{c.name}</h3>
              <p style={{ font: '800 28px var(--display)', margin: 0 }}>
                {R.winners.map(id => pname(id)).join(tx('voto.e')) || (
                  <span class="muted small">{tx('voto.semVotos')}</span>
                )}
              </p>
              {R.winners.length ? <p class="small muted">{tp('voto.votos', R.counts[R.winners[0]!])}</p> : null}
            </div>
          );
        })}
      </div>
    );
  }
  const played: string[] = r && r.times ? r.times.flatMap((t: { players: string[] }) => t.players) : [];
  const voters = [...new Set(played)].sort((a, b) => pname(a).localeCompare(pname(b), LOCAL));
  return (
    <div class="stack">
      <div class="panel">
        <h2>{v.title}</h2>
        <p class="muted small">
          {rodadaDe}
          {tx('voto.regra')}
        </p>
        <label class="f" style={{ margin: '12px 0 0' }}>
          <span>{tx('voto.quemEVoce')}</span>
          <select class="sel" data-c="voter" value={me}>
            <option value="">{tx('voto.escolhaNome')}</option>
            {voters.map(id => (
              <option key={id} value={id}>
                {pname(id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {me
        ? v.cats.map(c => {
            const cand = candidates(v, c).filter(id => v.selfVote || id !== me);
            return (
              <div class="panel" key={c.id}>
                <h3>{c.name}</h3>
                <div class="vgrid">
                  {cand.length ? (
                    cand.map(id => (
                      <button
                        key={id}
                        class="opt"
                        aria-pressed={(my.v || {})[c.id] === id ? 'true' : 'false'}
                        data-a="pubVote"
                        data-c2={c.id}
                        data-p={id}
                      >
                        {pname(id)}
                      </button>
                    ))
                  ) : (
                    <span class="muted small">{tx('voto.semCandidatos')}</span>
                  )}
                </div>
              </div>
            );
          })
        : null}
      {me ? <p class="small muted">{Object.keys(my.v || {}).length ? tx('voto.registrado') : ''}</p> : null}
    </div>
  );
}

let raiz: HTMLElement | null = null;
function renderPublicVoto() {
  const S = st();
  $('#tabsnav').hidden = true;
  $('#topright').replaceChildren();
  $('#gsub').textContent = tx('voto.subtitulo');
  const carregou = S.loaded.v && S.loaded.app;
  if (carregou) desde = 0;
  else if (!desde) {
    desde = Date.now();
    setTimeout(() => {
      if (desde && S.route.n === 'v') renderPublicVoto();
    }, DEMORA_MS + 50);
  }
  if (!raiz || raiz.parentNode !== main) {
    raiz = document.createElement('div');
    main.replaceChildren(raiz);
  }
  render(<Pagina />, raiz);
}

export { renderPublicVoto };
