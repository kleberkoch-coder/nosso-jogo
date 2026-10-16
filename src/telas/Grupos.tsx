/* Página inicial de quem tem conta, "Meus grupos" (KAN-162: virou componente em TypeScript + Preact).
   Lista os grupos ativos e inativos. O país da conta fica no menu da conta, no cabeçalho (KAN-166).
   Os botões usam data-a (ações em acoes/grupo.js). */
import { render } from 'preact';
import { SPORTS } from '../dominio/esportes.js';
import { fdia } from '../dominio/grupo.js';
import { LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { numeroVersao } from '../nucleo/versao.js';

type MeuGrupo = { name?: string; sport?: string; sportName?: string; role?: string; ativo?: boolean; criado?: number };
const st = (): any => estado;
const esporte = (k?: string) => (SPORTS as Record<string, { e: string; n: string }>)[k || 'futebol'] || SPORTS.futebol;

function LinhaGrupo({ gid, g }: { gid: string; g: MeuGrupo }) {
  return (
    <li>
      <span class="gem">{esporte(g.sport).e}</span>
      <span class="pn">
        <b>{g.name || tx('inicio.grupo')}</b>
        <br />
        <span class="tag">
          {g.sportName || esporte(g.sport).n} · {tx(g.role === 'owner' ? 'inicio.organizador' : 'inicio.administrador')}
          {g.criado ? ' · ' + tx('inicio.criadoEm', { data: fdia(g.criado) }) : ''}
        </span>
      </span>
      <a class={'btn sm' + (g.ativo === false ? '' : ' primary')} href={'#/g/' + gid}>
        {tx('inicio.abrir')}
      </a>
    </li>
  );
}

function GruposTela() {
  const S = st();
  if (!S.loaded.me) return <div class="empty muted">{tx('comum.carregando')}</div>;
  const todos = (Object.entries((S.me && S.me.grupos) || {}) as [string, MeuGrupo][]).sort((a, b) =>
    (a[1].name || '').localeCompare(b[1].name || '', LOCAL)
  );
  if (!todos.length)
    return (
      <div class="panel empty auth">
        <h2>{tx('inicio.bemVindo')}</h2>
        <p class="muted">{tx('inicio.primeiro')}</p>
        <button class="btn primary" data-a="newGroup">
          {tx('inicio.criarPrimeiro')}
        </button>
      </div>
    );
  const ativos = todos.filter(([, g]) => g.ativo !== false),
    inativos = todos.filter(([, g]) => g.ativo === false);
  return (
    <div class="stack">
      <div class="row between">
        <h2>{tx('inicio.meusGrupos')}</h2>
        <button class="btn primary" data-a="newGroup">
          {tx('inicio.novoGrupo')}
        </button>
      </div>
      {ativos.length ? (
        <div class="panel">
          <ul class="plist">
            {ativos.map(([gid, g]) => (
              <LinhaGrupo key={gid} gid={gid} g={g} />
            ))}
          </ul>
        </div>
      ) : (
        <div class="panel empty">
          <p class="muted">{tx('inicio.nenhumAtivo')}</p>
        </div>
      )}
      {inativos.length ? (
        <details class="panel">
          <summary>{tx('inicio.inativos', { n: inativos.length })}</summary>
          <ul class="plist" style="margin-top:8px">
            {inativos.map(([gid, g]) => (
              <LinhaGrupo key={gid} gid={gid} g={g} />
            ))}
          </ul>
        </details>
      ) : null}
      <p class="small muted">{tx('inicio.conectado', { email: (S.user && S.user.email) || '' })}</p>
      <p class="versao small muted">{tx('comum.versao', { n: numeroVersao() })}</p>
    </div>
  );
}

/* A página inicial entra num lugar reservado (#homeRaiz), como as abas migradas. */
const vHome = () => '<div id="homeRaiz"></div>';
function montarHome() {
  const el = document.getElementById('homeRaiz');
  if (el) render(<GruposTela />, el);
}

export { montarHome, vHome };
