/* Aba Jogadores (KAN-159): componente em TypeScript + Preact, com "Importar da planilha".
   Por fora é a mesma tela de antes, mais o botão de importar. Os botões usam data-a (ações em acoes/jogadores.js). */
import { render } from 'preact';
import { ptipo } from '../dominio/caixa.js';
import { fdia, lvl, players, pname, ppos, rat } from '../dominio/grupo.js';
import { hasPos, posKeys } from '../dominio/esportes.js';
import { ORDENS, ordemValida, ordenarJogadores, type Ordem } from '../dominio/ordem-jogadores.ts';
import { history } from '../dominio/sorteio.js';
import { LOCAL } from '../i18n/formatos.js';
import { tx } from '../i18n/index.js';
import { waUrl } from '../nucleo/edicoes.js';
import { S as estado } from '../nucleo/estado.js';
import { Nota, Pos } from '../ui/componentes';

type Jogador = { id: string; name: string; criado?: number; ativo?: boolean };
type Avulso = { nome?: string; criado?: number };

const st = (): any => estado;

/* Ordem da lista (KAN-168): fica guardada neste aparelho. */
const ORDEM_K = 'nj-ordem-jogadores';
export function ordemJogadores(): Ordem {
  let v = null;
  try {
    v = localStorage.getItem(ORDEM_K);
  } catch (e) {}
  return ordemValida(v, hasPos());
}
export function guardarOrdemJogadores(v: string) {
  try {
    localStorage.setItem(ORDEM_K, ordemValida(v, hasPos()));
  } catch (e) {}
}
function ordenar<T>(lista: T[], id: (x: T) => string, nome: (x: T) => string, criado: (x: T) => number | undefined) {
  const itens = lista.map(x => ({
    x,
    id: id(x),
    nome: nome(x),
    pos: ppos(id(x)) as string,
    nota: lvl(id(x)) as number,
    tipo: ptipo(id(x)) as string,
    criado: criado(x),
  }));
  return ordenarJogadores(itens, ordemJogadores(), { posicoes: posKeys() as string[], local: LOCAL }).map(i => i.x);
}

function SeletorOrdem() {
  const atual = ordemJogadores();
  return (
    <label class="row ordem-jog">
      <span class="small muted">{tx('jogadores.ordenarPor')}</span>
      <select class="sel" data-c="ordemJog" value={atual}>
        {ORDENS.filter(o => o !== 'posicao' || hasPos()).map(o => (
          <option key={o} value={o} selected={o === atual}>
            {tx('jogadores.ordem.' + o)}
          </option>
        ))}
      </select>
    </label>
  );
}

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
          {tx('tipo.' + ptipo(p.id))} · {tx('jogadores.desde', { data: fdia(p.criado) })}
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
    porJogador = (p: Jogador) => p.id,
    nomeJ = (p: Jogador) => p.name,
    criadoJ = (p: Jogador) => p.criado,
    ps = ordenar(players() as Jogador[], porJogador, nomeJ, criadoJ);
  const inativos = ordenar(
    (Object.entries(S.jog) as [string, Jogador][])
      .filter(([, p]) => p.ativo === false)
      .map(([id, p]) => Object.assign({}, p, { id })),
    porJogador,
    nomeJ,
    criadoJ
  );
  const avs = ordenar(
    (Object.entries(S.avul || {}) as [string, Avulso][]).filter(([id]) => !S.jog[id]),
    a => a[0],
    a => a[1].nome || '',
    a => a[1].criado
  );
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
        {ps.length > 1 ? <SeletorOrdem /> : null}
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
