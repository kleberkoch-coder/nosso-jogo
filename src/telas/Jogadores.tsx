/* Aba Jogadores (KAN-159): componente em TypeScript + Preact, com "Importar da planilha".
   Por fora é a mesma tela de antes, mais o botão de importar. Os botões usam data-a (ações em acoes/jogadores.js). */
import { render } from 'preact';
import { ptipo } from '../dominio/caixa.js';
import { fdia, players, pname, rat } from '../dominio/grupo.js';
import { history } from '../dominio/sorteio.js';
import { LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { waUrl } from '../nucleo/edicoes.js';
import { S as estado } from '../nucleo/estado.js';
import { Nota, Pos } from '../ui/componentes';

type Jogador = { id: string; name: string; criado?: number; ativo?: boolean };
type Avulso = { nome?: string; criado?: number };

const st = (): any => estado;

function Contato({ id }: { id: string }) {
  const tel = (st().cont || {})[id]?.tel;
  return tel ? (
    <>
      {' · '}
      <a href={waUrl(tel)} target="_blank" rel="noopener">
        {tx('jogadores.whatsapp')}
      </a>
    </>
  ) : null;
}

function LinhaJogador({ p }: { p: Jogador }) {
  return (
    <li>
      <Pos id={p.id} />
      <span class="pn">
        {p.name}
        <br />
        <span class="tag">
          {tx(ptipo(p.id) === 'diarista' ? 'importar.diarista' : 'importar.mensalista')} ·{' '}
          {tx('jogadores.desde', { data: fdia(p.criado) })}
          <Contato id={p.id} />
        </span>
      </span>
      <Nota id={p.id} />
      <button class="btn sm" data-a="editPlayer" data-p={p.id}>
        {tx('rodada.editar')}
      </button>
    </li>
  );
}

function JogadoresTela() {
  const S = st(),
    R = rat() as { sep?: [string, string][] },
    ps = players() as Jogador[];
  const inativos = (Object.entries(S.jog) as [string, Jogador][])
    .filter(([, p]) => p.ativo === false)
    .map(([id, p]) => Object.assign({}, p, { id }))
    .sort((a, b) => a.name.localeCompare(b.name, LOCAL));
  const avs = (Object.entries(S.avul || {}) as [string, Avulso][])
    .filter(([id]) => !S.jog[id])
    .sort((a, b) => (a[1].nome || '').localeCompare(b[1].nome || '', LOCAL));
  const top = (Object.entries(history(null)) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <div class="stack">
      <div class="row between">
        <h2>{tx('jogadores.total', { n: ps.length })}</h2>
        <div class="row">
          <button class="btn primary" data-a="addPlayer">
            {tx('jogadores.adicionar')}
          </button>
          <button class="btn" data-a="importarDlg">
            {tx('jogadores.importar')}
          </button>
          {!ps.length ? (
            <button class="btn" data-a="seed">
              {tx('jogadores.exemplo')}
            </button>
          ) : null}
        </div>
      </div>
      <div class="panel">
        <ul class="plist">
          {ps.length ? (
            ps.map(p => <LinhaJogador key={p.id} p={p} />)
          ) : (
            <li class="muted small">{tx('jogadores.nenhumAtivo')}</li>
          )}
        </ul>
        {inativos.length ? (
          <details style="margin-top:10px">
            <summary class="small">{tx('jogadores.inativos', { n: inativos.length })}</summary>
            <ul class="plist" style="opacity:.75">
              {inativos.map(p => (
                <LinhaJogador key={p.id} p={p} />
              ))}
            </ul>
          </details>
        ) : null}
      </div>
      <div class="panel">
        <h3>{tx('jogadores.avulsosTitulo')}</h3>
        <p class="small muted" style="margin-top:-6px">
          {tx('jogadores.avulsosAjuda')}
        </p>
        <ul class="plist">
          {avs.length ? (
            avs.map(([id, a]) => (
              <li key={id}>
                <Pos id={id} />
                <span class="pn">
                  {a.nome}
                  <br />
                  <span class="tag">
                    {tx('jogadores.desde', { data: fdia(a.criado) })}
                    <Contato id={id} />
                  </span>
                </span>
                <Nota id={id} />
                <button class="btn sm" data-a="editAvulso" data-p={id}>
                  {tx('rodada.editar')}
                </button>
                <button class="btn sm" data-a="promote" data-p={id}>
                  {tx('jogadores.porNoElenco')}
                </button>
              </li>
            ))
          ) : (
            <li class="muted small">{tx('jogadores.avulsosVazio')}</li>
          )}
        </ul>
      </div>
      <div class="grid2">
        <div class="panel">
          <h3>{tx('jogadores.separarTitulo')}</h3>
          <p class="small muted" style="margin-top:-6px">
            {tx('jogadores.separarAjuda')}
          </p>
          <ul class="plist">
            {(R.sep || []).length ? (
              (R.sep || []).map(([a, b], i) => (
                <li key={i}>
                  <span class="pn">
                    {pname(a)} <span class="muted">{tx('jogadores.e')}</span> {pname(b)}
                  </span>
                  <button class="btn sm ghost danger" data-a="delSep" data-v={i}>
                    {tx('jogadores.remover')}
                  </button>
                </li>
              ))
            ) : (
              <li class="muted small">{tx('jogadores.separarVazio')}</li>
            )}
          </ul>
          <button class="btn sm" style="margin-top:10px" data-a="addSep">
            {tx('jogadores.adicionarPar')}
          </button>
        </div>
        <div class="panel">
          <h3>{tx('jogadores.juntosTitulo')}</h3>
          <p class="small muted" style="margin-top:-6px">
            {tx('jogadores.juntosAjuda')}
          </p>
          <ul class="plist">
            {top.length ? (
              top.map(([k, v]) => {
                const [a, b] = k.split('|');
                return (
                  <li key={k}>
                    <span class="pn">
                      {pname(a)} + {pname(b)}
                    </span>
                    <span class="bar" style="max-width:120px">
                      <i style={{ width: Math.min(100, (v / top[0][1]) * 100) + '%' }}></i>
                    </span>
                  </li>
                );
              })
            ) : (
              <li class="muted small">{tx('jogadores.juntosVazio')}</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* A gestão desenha as abas com texto; os Jogadores entram num lugar reservado (#jogadoresRaiz). */
const vJogadores = () => '<div id="jogadoresRaiz"></div>';
function montarJogadores() {
  const el = document.getElementById('jogadoresRaiz');
  if (el) render(<JogadoresTela />, el);
}

export { montarJogadores, vJogadores };
