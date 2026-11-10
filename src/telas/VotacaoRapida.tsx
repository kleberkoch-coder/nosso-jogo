/* Votação rápida (KAN-254, pelada-v102; decisões do Kleber de 09/11). O aparelho do administrador passa de mão em
   mão no fim do jogo: a pessoa escolhe o próprio nome, vota e confirma; a tela limpa e fica pronta para o próximo.
   Cobre a tela inteira (as abas da gestão ficam escondidas por baixo) e só sai com confirmação. O link não muda.
   Regra em dominio/votacao-rapida.ts; os botões usam data-a (acoes/votacao.js: rapida*). Vem com a aba Votação. */
import { pname, ppos, rodDoc } from '../dominio/grupo.js';
import { candidatos, type Categoria } from '../dominio/votacao';
import { jaVotaram, quemVota } from '../dominio/votacao-rapida';
import { LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';

/* O que está na tela fica fora do componente: a aba se desenha de novo a cada voto que chega. */
export const R: { on: boolean; etapa: 'quem' | 'votar' | 'ok'; pid: string; v: Record<string, string> } = {
  on: false,
  etapa: 'quem',
  pid: '',
  v: {},
};

type Vot = {
  title: string;
  rid: string;
  open?: boolean;
  selfVote?: boolean;
  cats: Categoria[];
  quem?: string[] | null;
};
type Times = { players: string[] }[] | undefined;

export function VotacaoRapida({ v, votos }: { v: Vot; votos: Record<string, any> }) {
  const times = (rodDoc(v.rid) as { times?: Times } | null)?.times,
    todos = quemVota(v.quem, times, pname, LOCAL),
    feitos = jaVotaram(votos),
    n = todos.filter(id => feitos.has(id)).length;
  let corpo;
  if (!v.open) corpo = <p class="vr-aviso">{tx('rapida.encerrada')}</p>;
  else if (R.etapa === 'ok')
    corpo = (
      <div class="vr-ok" role="status">
        <p class="vr-check" aria-hidden="true">
          ✓
        </p>
        <h3>{tx('rapida.registrado')}</h3>
        <p class="muted">{tx('rapida.passe')}</p>
        <button class="btn primary vr-grande" data-a="rapidaProximo" id="vrProximo">
          {tx('rapida.proximo')}
        </button>
      </div>
    );
  else if (R.etapa === 'votar' && R.pid) {
    const escolheu = Object.values(R.v).some(Boolean);
    corpo = (
      <>
        <h3 class="vr-quem">{tx('rapida.votoDe', { nome: pname(R.pid) })}</h3>
        {v.cats.map(c => {
          const cand = candidatos(times, c, ppos, pname, LOCAL, v.quem).filter(id => v.selfVote || id !== R.pid);
          return (
            <div class="panel" key={c.id}>
              <h3>{c.name}</h3>
              <div class="vgrid">
                {cand.length ? (
                  cand.map(id => (
                    <button
                      key={id}
                      class="opt"
                      aria-pressed={R.v[c.id] === id ? 'true' : 'false'}
                      data-a="rapidaEscolher"
                      data-c2={c.id}
                      data-p={id}
                    >
                      {pname(id)}
                    </button>
                  ))
                ) : (
                  <span class="muted small">{tx('rapida.semCandidatos')}</span>
                )}
              </div>
            </div>
          );
        })}
        <div class="vr-pe">
          <button class="btn" data-a="rapidaVoltar">
            {tx('rapida.voltar')}
          </button>
          <button class="btn primary vr-grande" data-a="rapidaConfirmar" id="vrConfirmar" disabled={!escolheu}>
            {tx('rapida.confirmar')}
          </button>
        </div>
      </>
    );
  } else
    corpo = (
      <>
        <h3 class="vr-quem">{tx('rapida.quemVai')}</h3>
        {todos.length ? (
          <ul class="vr-nomes">
            {todos.map(id => {
              const ja = feitos.has(id);
              return (
                <li key={id}>
                  <button class={'vr-nome' + (ja ? ' feito' : '')} data-a="rapidaQuem" data-p={id}>
                    <span>{pname(id)}</span>
                    {ja ? <span class="vr-ja">✓ {tx('rapida.jaVotou')}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p class="muted">{tx('rapida.ninguem')}</p>
        )}
      </>
    );
  return (
    <div class="vr-tela" id="votRapida" role="dialog" aria-modal="true" aria-labelledby="vrTitulo">
      <div class="vr-topo">
        <div>
          <h2 id="vrTitulo">{v.title}</h2>
          <p class="small muted" id="vrConta">
            {tx('rapida.contador', { n, total: todos.length })}
          </p>
        </div>
        <button class="btn sm ghost" data-a="rapidaSair" id="vrSair">
          {tx('rapida.sair')}
        </button>
      </div>
      <div class="vr-corpo stack">{corpo}</div>
    </div>
  );
}
