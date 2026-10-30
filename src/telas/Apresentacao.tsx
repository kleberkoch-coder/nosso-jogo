/* Página de apresentação (KAN-218: virou componente; KAN-219: textos em i18n/pt-BR-apresentacao.ts).
   Baixa só para quem ainda não tem conta, com o próprio estilo (KAN-217). */
import { render } from 'preact';
import estilo from '../estilos/apresentacao.css' with { type: 'text' };
import { usarEstilo } from '../ui/estilo';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-apresentacao';
import { numeroVersao } from '../nucleo/versao.js';
import { APP, SPORTS } from '../dominio/esportes.js';
import { themeDef, themeLabel } from '../ui/tema.js';
usarEstilo('apresentacao', estilo, true);
juntarTextos(textos);

const n8 = [1, 2, 3, 4, 5, 6, 7, 8];
const ICONES = ['🔗', '⚖️', '⏱️', '🏆', '🗳️', '💰', '📅', '📱'];

function Time({ cor, nome, linhas }: { cor: string; nome: string; linhas: [string, string][] }) {
  return (
    <div class="team">
      <div class="band" style={{ background: cor }}></div>
      <div class="th">
        <b>{nome}</b>
      </div>
      <ul>
        {linhas.map(([p, n]) => (
          <li key={n}>
            <span class={'pos ' + (p === 'GOL' ? 'GOL' : '')}>{p}</span>
            <span class="pn">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Apresentacao() {
  const sp = Object.entries(SPORTS as Record<string, { e: string; n: string }>).filter(
    ([k]) => !['society', 'outro'].includes(k)
  );
  const tema = themeDef() as string[];
  return (
    <div class="ld">
      <nav class="ld-nav">
        <div class="ld-wrap">
          <a class="ld-logo" href="#/" aria-label={APP}>
            <span class="ld-mark" aria-hidden="true"></span>
            <span class="ld-txt">{APP}</span>
          </a>
          <div class="row" style={{ gap: '8px' }}>
            <button
              class="btn ld-ghost ld-ic"
              data-a="themeMenu"
              aria-haspopup="menu"
              aria-expanded="false"
              aria-label={themeLabel()}
              title={themeLabel()}
            >
              {tema[1]}
            </button>
            <a class="btn ld-ghost ld-enter" href="#/entrar">
              {tx('apr.entrar')}
            </a>
            <a class="btn bib" href="#/criar">
              {tx('apr.criarConta')}
              <span class="ld-gr" style={{ marginLeft: '-2px' }}>
                {tx('apr.gratis')}
              </span>
            </a>
          </div>
        </div>
      </nav>
      <header class="ld-hero">
        <div class="ld-wrap ld-hero-in">
          <div class="ld-copy">
            <p class="ld-eyebrow">{tx('apr.eyebrow')}</p>
            <h1>
              {tx('apr.titulo1')}
              <br />
              {tx('apr.titulo2')}
              <br />
              <span>{tx('apr.titulo3')}</span>
            </h1>
            <p class="ld-lead">{tx('apr.lead', { app: APP })}</p>
            <div class="row ld-ctas">
              <a class="btn bib ld-big" href="#/criar">
                {tx('apr.criarGrupo')}
              </a>
              <a class="btn ld-ghost ld-big" href="#/entrar">
                {tx('apr.jaTenho')}
              </a>
            </div>
            <p class="ld-note">{tx('apr.nota')}</p>
          </div>
          <div class="ld-phone" aria-hidden="true">
            <div class="ld-screen">
              <div class="ld-sh">
                <b>{tx('apr.demoGrupo')}</b>
                <span>{tx('apr.demoQuando')}</span>
              </div>
              <div class="ld-big-n">
                14<small>{tx('apr.confirmados')}</small>
              </div>
              {(
                [
                  ['Rafa', 'in'],
                  ['Gui', 'in'],
                  ['Japa', 'out'],
                  ['Bruno', 'in'],
                ] as const
              ).map(([n, s]) => (
                <div class="ld-row" key={n}>
                  <span>{n}</span>
                  <span class={'ld-b ' + (s === 'in' ? 'on' : '')}>{tx('apr.vou')}</span>
                  <span class={'ld-b ' + (s === 'out' ? 'off' : '')}>{tx('apr.naoVou')}</span>
                </div>
              ))}
              <div class="ld-teams">
                <div style={{ '--c': '#F4B183' }}>
                  <b>{tx('apr.laranja')}</b>
                  <i>{tx('apr.notaMedia', { n: '7,2' })}</i>
                </div>
                <div style={{ '--c': '#9DBBF0' }}>
                  <b>{tx('apr.azul')}</b>
                  <i>{tx('apr.notaMedia', { n: '7,2' })}</i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <section class="ld-sports">
        <div class="ld-wrap">
          <p>{tx('apr.esportes')}</p>
          <div class="ld-chips">
            {sp.map(([k, v]) => (
              <span key={k}>{v.e + ' ' + v.n}</span>
            ))}
            <span>{'🏅 ' + tx('apr.outros')}</span>
          </div>
        </div>
      </section>
      <section class="ld-sec">
        <div class="ld-wrap">
          <h2 class="ld-h2">{tx('apr.dorTitulo')}</h2>
          <div class="ld-pains">
            {[1, 2, 3].map(i => (
              <div key={i}>
                <p class="ld-q">{tx('apr.dor' + i + 'q')}</p>
                <p>{tx('apr.dor' + i)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section class="ld-sec alt">
        <div class="ld-wrap">
          <h2 class="ld-h2">{tx('apr.recursosTitulo')}</h2>
          <div class="ld-feat">
            {n8.map(i => (
              <div class="ld-card" key={i}>
                <span class="ld-ic">{ICONES[i - 1]}</span>
                <h3>{tx('apr.rec' + i + 't')}</h3>
                <p>{tx('apr.rec' + i)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section class="ld-sec">
        <div class="ld-wrap ld-split">
          <div>
            <h2 class="ld-h2">{tx('apr.sorteioTitulo')}</h2>
            <p class="ld-p">{tx('apr.sorteioTexto')}</p>
            <ul class="ld-list">
              {[1, 2, 3, 4].map(i => (
                <li key={i}>{tx('apr.sorteio' + i)}</li>
              ))}
            </ul>
          </div>
          <div class="ld-demo">
            <Time
              cor="#F4B183"
              nome={tx('apr.laranja')}
              linhas={[
                ['GOL', 'Bruno'],
                ['DEF', 'Rafa'],
                ['MEI', 'Gui'],
                ['ATA', 'Neto'],
                ['ATA', 'Vini'],
              ]}
            />
            <Time
              cor="#9DBBF0"
              nome={tx('apr.azul')}
              linhas={[
                ['GOL', 'Tiago'],
                ['DEF', 'Léo'],
                ['MEI', 'Caio'],
                ['MEI', 'Fernandinho'],
                ['ATA', 'Japa'],
              ]}
            />
            <div class="quality" style={{ gridColumn: '1/-1' }}>
              <span>
                {tx('apr.diferenca')} <b>0,1</b>
              </span>
              <span>
                {tx('apr.goleiros')} <b>1 × 1</b>
              </span>
              <span>
                {tx('apr.parcerias')} <b>78%</b>
              </span>
            </div>
          </div>
        </div>
      </section>
      <section class="ld-sec alt">
        <div class="ld-wrap">
          <h2 class="ld-h2">{tx('apr.gruposTitulo')}</h2>
          <p class="ld-p" style={{ maxWidth: '640px' }}>
            {tx('apr.gruposTexto')}
          </p>
          <div class="ld-groups">
            {(['⚽', '🏐', '🎾'] as const).map((e, i) => (
              <div class="ld-g" key={e}>
                <span class="gem">{e}</span>
                <div>
                  <b>{tx('apr.g' + (i + 1))}</b>
                  <span>{tx('apr.g' + (i + 1) + 'd')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section class="ld-sec">
        <div class="ld-wrap">
          <h2 class="ld-h2">{tx('apr.passosTitulo')}</h2>
          <ol class="ld-steps">
            {[1, 2, 3].map(i => (
              <li key={i}>
                <b>{tx('apr.passo' + i + 't')}</b>
                <span>{tx('apr.passo' + i)}</span>
              </li>
            ))}
          </ol>
          <div style={{ textAlign: 'center', marginTop: '26px' }}>
            <a class="btn bib ld-big" href="#/criar">
              {tx('apr.criarGrupo')}
            </a>
          </div>
        </div>
      </section>
      <section class="ld-sec alt">
        <div class="ld-wrap ld-faq">
          <h2 class="ld-h2">{tx('apr.faqTitulo')}</h2>
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <details key={i}>
              <summary>{tx('apr.faq' + i + 'q')}</summary>
              <p>{tx('apr.faq' + i)}</p>
            </details>
          ))}
        </div>
      </section>
      <section class="ld-final">
        <div class="ld-wrap">
          <h2>{tx('apr.finalTitulo')}</h2>
          <div class="row" style={{ justifyContent: 'center' }}>
            <a class="btn bib ld-big" href="#/criar">
              {tx('apr.criarGratis')}
            </a>
            <a class="btn ld-ghost ld-big" href="#/entrar">
              {tx('apr.entrar')}
            </a>
          </div>
        </div>
      </section>
      <footer class="ld-foot">
        <div class="ld-wrap">
          © {new Date().getFullYear()} {APP} ·{' '}
          <span class="versao">{tx('comum.versaoCurta', { n: numeroVersao() })}</span>
        </div>
      </footer>
    </div>
  );
}

/* Desenha num lugar próprio dentro de onde (main); outra tela que ocupar main apaga esse lugar e ele é recriado. */
let raiz: HTMLElement | null = null;
export function montarApresentacao(onde: HTMLElement) {
  if (!raiz || raiz.parentNode !== onde) {
    raiz = document.createElement('div');
    onde.replaceChildren(raiz);
  }
  render(<Apresentacao />, raiz);
}
