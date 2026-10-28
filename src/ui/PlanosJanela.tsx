/* Janelas dos planos (KAN-119): "Planos" e "Quais continuam ativos?". Baixam só quando abertas (sob demanda),
   para a gestão abrir leve. Os botões usam data-a (ações em acoes/plano.ts). */
import { render } from 'preact';
import { catalogo } from '../dominio/planos';
import { fdia } from '../dominio/grupo.js';
import { juntarTextos, tp, tx } from '../i18n/index.js';
import textosPlanos from '../i18n/pt-BR-planos';
import { S as estado } from '../nucleo/estado.js';
import { limiteGrupos, meusAtivos, minhaSituacao, situacaoDoGrupo } from '../nucleo/plano';
import { Convite } from './Plano';

juntarTextos(textosPlanos);
const st = (): any => estado;
const cat = () => catalogo(st().planosCfg);

/* Janela "Planos": o plano de agora e o que cada plano tem. */
const RECURSOS = [
  'presenca',
  'sorteio',
  'placar',
  'rankingMes',
  'caixa',
  'votacao',
  'rankingAnual',
  'historico',
].concat(['listaEspera', 'cobrarPendentes']);
function PlanosJanela({ motivo }: { motivo?: string }) {
  const S = st(),
    s = S.gid ? situacaoDoGrupo() : minhaSituacao(),
    c = cat(),
    ids = Object.keys(c);
  const limite = (v: number | null) => (v === null ? tx('plano.semLimite') : String(v));
  return (
    <>
      <h3 id="planosTitulo">{tx('plano.titulo')}</h3>
      {motivo ? (
        <p class="trava-linha small" id="planoMotivo">
          <span aria-hidden="true">🔒</span> <span>{motivo}</span>
        </p>
      ) : null}
      <p class="small" id="planoAgora">
        <b>{tx('plano.seu', { plano: s.plano.nome })}</b>
        {s.ate ? ' · ' + tx('plano.ate', { origem: tx('plano.origem.' + s.origem), data: fdia(s.ate) }) : ''}
      </p>
      <div class="tbl planos-tbl">
        <table>
          <thead>
            <tr>
              <th>{tx('plano.recurso')}</th>
              {ids.map(id => (
                <th key={id} class={id === s.id ? 'atual' : ''}>
                  {c[id].nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{tx('plano.gruposAtivos')}</td>
              {ids.map(id => (
                <td key={id}>{limite(c[id].grupos)}</td>
              ))}
            </tr>
            <tr>
              <td>{tx('plano.adminsConvidados')}</td>
              {ids.map(id => (
                <td key={id}>{limite(c[id].admins)}</td>
              ))}
            </tr>
            {RECURSOS.map(r => (
              <tr key={r}>
                <td>{tx('plano.rec.' + r)}</td>
                {ids.map(id => (
                  <td key={id} aria-label={tx(c[id].recursos.includes(r) ? 'plano.tem' : 'plano.naoTem')}>
                    {c[id].recursos.includes(r) ? '✓' : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="small muted">{tx('plano.linkSempre')}</p>
      <Convite s={s} />
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('plano.fechar')}
        </button>
      </div>
    </>
  );
}
export function montarPlanos(el: HTMLElement, motivo?: string) {
  render(<PlanosJanela motivo={motivo} />, el);
}

/* Escolher os grupos que continuam ativos quando o plano permite menos do que a pessoa tem. */
function EscolherJanela() {
  const S = st(),
    g = (S.me && S.me.grupos) || {},
    ids = meusAtivos(),
    n = limiteGrupos() as number;
  return (
    <>
      <h3 id="escolherTitulo">{tx('plano.escolherTitulo', { grupos: tp('plano.nGrupos', n) })}</h3>
      <p class="small muted">{tx('plano.escolherAjuda')}</p>
      <ul class="perm-lista" id="escolherLista">
        {ids.map((id, i) => (
          <li key={id}>
            <label class="perm-item">
              <input type="checkbox" value={id} checked={i < n} data-c="escolherAtivo" />
              <span>
                <b>{g[id].name || tx('inicio.grupo')}</b>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p class="err" id="escolherErr" aria-live="polite"></p>
      <div class="dlg-f">
        <button class="btn" data-a="close">
          {tx('comum.cancelar')}
        </button>
        <button class="btn primary" data-a="salvarAtivos">
          {tx('plano.manterAtivos')}
        </button>
      </div>
    </>
  );
}
export function montarEscolher(el: HTMLElement) {
  render(<EscolherJanela />, el);
}
