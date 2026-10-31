/* Link da avaliação de notas (KAN-214): quem abre escolhe o próprio nome e dá nota aos mensalistas da lista.
   Baixa só quando o link é aberto. Não lê nenhuma nota além das que este aparelho enviou. */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { aberta, type Avaliacao } from '../dominio/avaliacao';
import { gname, grpAtivo, pname } from '../dominio/grupo.js';
import { LOCAL } from '../i18n/formatos.js';
import { juntarTextos, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-aval';
import { DEMORA_MS } from '../nucleo/carga';
import { S as estado } from '../nucleo/estado.js';
import { $, main } from '../nucleo/util.js';
import { NotasAvaliacao } from '../ui/NotasAvaliacao';
import { ACT } from '../acoes.js';
import { acoes } from '../acoes/avaliacao-envio';

juntarTextos(textos);
Object.assign(ACT, acoes);

const st = () => estado;
const LOCAL_NOME = 'pelada-aval-nome';
export function nomeGuardado(aid: string): string {
  try {
    return localStorage.getItem(LOCAL_NOME + ':' + aid) || '';
  } catch (e) {
    return '';
  }
}
function guardarNome(aid: string, pid: string) {
  try {
    localStorage.setItem(LOCAL_NOME + ':' + aid, pid);
  } catch (e) {}
}

export const dataCurta = (ms: number) => new Date(ms).toLocaleDateString(LOCAL, { day: '2-digit', month: '2-digit' });

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
    aid: string = S.route.id || '',
    a: Avaliacao | null = S.av ?? null,
    minha = S.minhaAv as { pid?: string; n?: Record<string, number> } | null;
  const [nome, setNome] = useState(() => (minha && minha.pid) || nomeGuardado(aid));
  const me = nome || (minha && minha.pid) || '';
  const carregou = S.loaded.av && S.loaded.app;
  if ((S.falhou || {}).av || (S.falhou || {}).app)
    return <Aviso titulo={tx('comum.naoCarregouTitulo')} texto={tx('carga.falhouTexto')} tentar />;
  if (!carregou)
    return Date.now() - (desde || Date.now()) >= DEMORA_MS ? (
      <Aviso texto={tx('carga.demorando')} tentar />
    ) : (
      <div class="empty muted">{tx('comum.carregando')}</div>
    );
  if (!grpAtivo()) return <Aviso titulo={gname()} texto={tx('voto.grupoInativo')} />;
  if (!a) return <Aviso titulo={tx('aval.naoEncontrada')} texto={tx('aval.naoEncontradaTexto')} />;
  if (!aberta(a, Date.now()))
    return (
      <Aviso titulo={a.t} texto={tx(minha ? 'aval.encerradaComNotas' : 'aval.encerrada', { data: dataCurta(a.ate) })} />
    );
  const nomes = a.jogs.slice().sort((x, y) => pname(x).localeCompare(pname(y), LOCAL));
  const inicial = minha && minha.pid === me ? minha.n || {} : {};
  return (
    <div class="stack" id="avPublico">
      <div class="panel">
        <h2>{a.t}</h2>
        <p class="small muted">{tx('aval.regra', { data: dataCurta(a.ate) })}</p>
        <label class="f" style={{ margin: '12px 0 0' }}>
          <span>{tx('aval.quemEVoce')}</span>
          <select
            class="sel"
            id="avNome"
            value={me}
            onChange={e => {
              const v = (e.currentTarget as HTMLSelectElement).value;
              guardarNome(aid, v);
              setNome(v);
            }}
          >
            <option value="">{tx('aval.escolhaNome')}</option>
            {nomes.map(id => (
              <option key={id} value={id}>
                {pname(id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {me ? (
        <div class="panel">
          <NotasAvaliacao key={aid + ':' + me} jogs={a.jogs} inicial={inicial} />
          <div class="dlg-f">
            <button class="btn primary" data-a="avEnviar" data-v={aid} data-p={me} id="avEnviar">
              {tx(minha && minha.pid === me ? 'aval.atualizar' : 'aval.enviar')}
            </button>
          </div>
          {minha && minha.pid === me ? (
            <p class="small muted" id="avEnviado" role="status">
              {tx('aval.enviado', { data: dataCurta(a.ate) })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

let desde = 0;
let raiz: HTMLElement | null = null;
export function renderPublicoAvaliacao() {
  const S = st();
  $('#tabsnav').hidden = true;
  $('#topright').replaceChildren();
  $('#gsub').textContent = tx('aval.subtitulo');
  const carregou = S.loaded.av && S.loaded.app;
  if (carregou) desde = 0;
  else if (!desde) {
    desde = Date.now();
    setTimeout(() => {
      if (desde && S.route.n === 'a') renderPublicoAvaliacao();
    }, DEMORA_MS + 50);
  }
  if (!raiz || raiz.parentNode !== main) {
    raiz = document.createElement('div');
    main.replaceChildren(raiz);
  }
  render(<Pagina />, raiz);
}
