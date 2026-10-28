/* Planos na tela (KAN-119, pelada-v70): cadeado dos recursos, avisos do plano, janela "Planos" e escolha dos grupos
   que continuam ativos quando o plano diminui. Segue o Design System (docs/DESIGN-SYSTEM.md, "Planos").
   O que não está no plano nunca some sem explicação: aparece com o cadeado e o convite. Os botões usam data-a
   (ações em acoes/plano.ts). */
import { render } from 'preact';
import { catalogo, diasParaAcabar, planoComRecurso, TESTE_DIAS, type Situacao } from '../dominio/planos';
import { fdia, isOwnerMe } from '../dominio/grupo.js';
import { tp, tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { gruposDemais, limiteGrupos, meusAtivos, minhaSituacao, situacaoDoGrupo } from '../nucleo/plano';

const st = (): any => estado;
const cat = () => catalogo(st().planosCfg);
const planoDe = (r: string) => planoComRecurso(cat(), r) || tx('plano.planoPago');

/* O que fazer para ter o recurso: testar (só o organizador, uma vez), falar com o organizador, ou esperar a contratação. */
export function Convite({ s }: { s: Situacao }) {
  const dono = isOwnerMe() || !st().gid;
  return (
    <div class="row trava-acoes">
      {dono && s.podeTestar ? (
        <button class="btn primary sm" data-a="testarPlano">
          {tx('plano.testar', { n: TESTE_DIAS })}
        </button>
      ) : (
        <span class="small muted">{tx(dono ? 'plano.emBreve' : 'plano.falarOrganizador')}</span>
      )}
      <button class="linkbtn" data-a="planosDlg">
        {tx('plano.verPlanos')}
      </button>
    </div>
  );
}

/* Aba inteira travada (Caixa, Votação, Histórico). */
export function Cadeado({ r }: { r: string }) {
  return (
    <div class="panel trava" id="trava">
      <h2>
        <span aria-hidden="true">🔒 </span>
        {tx('plano.rec.' + r)}
      </h2>
      <p>{tx('plano.fazParte', { plano: planoDe(r) })}</p>
      <p class="small muted">{tx('plano.desc.' + r)}</p>
      <p class="small muted">{tx('plano.nadaApagado')}</p>
      <Convite s={situacaoDoGrupo()} />
    </div>
  );
}

/* Trava pequena, dentro de uma tela (cobrar quem não respondeu, ranking do ano, controle de vagas). */
export function Trava({ r }: { r: string }) {
  return (
    <div class="trava-linha small" data-trava={r}>
      <span aria-hidden="true">🔒</span>{' '}
      <span>{tx('plano.travaLinha', { recurso: tx('plano.rec.' + r), plano: planoDe(r) })}</span>{' '}
      <button class="linkbtn" data-a="planosDlg">
        {tx('plano.verPlanos')}
      </button>
    </div>
  );
}

const lido = (k: string) => {
  try {
    return localStorage.getItem(k) === '1';
  } catch (e) {
    return false;
  }
};

/* Avisos do plano para o organizador: novidade da transição, fim próximo e grupos acima do limite. */
export function AvisosPlano() {
  const S = st();
  if (!S.user || S.user.anon || !S.loaded.conta || !S.loaded.planosCfg) return null;
  if (S.gid && !isOwnerMe()) return null;
  const s = minhaSituacao(),
    agora = Date.now(),
    dias = diasParaAcabar(s, agora),
    demais = gruposDemais(),
    avisos = [];
  if (demais > 0) {
    const n = limiteGrupos() as number;
    avisos.push(
      <div class="inbar" key="demais" id="avisoGrupos">
        <span>{tx('plano.demais', { grupos: tp('plano.nGrupos', n), tem: meusAtivos().length })}</span>
        <button class="btn sm" data-a="escolherAtivos">
          {tx('plano.escolher')}
        </button>
      </div>
    );
  }
  const kFim = 'nj-plano-fim-' + s.ate;
  if (dias !== null && !lido(kFim))
    avisos.push(
      <div class="inbar info" key="fim" id="avisoFimPlano">
        <span>
          {tx(dias === 0 ? 'plano.acabaHoje' : 'plano.acabaEm', {
            plano: s.plano.nome,
            origem: tx('plano.origem.' + s.origem),
            dias: tp('plano.nDias', dias),
            data: fdia(s.ate),
          })}
        </span>
        <span class="row">
          <button class="btn sm" data-a="planosDlg">
            {tx('plano.verPlanos')}
          </button>
          <button class="btn sm ghost" data-a="lerAvisoPlano" data-v={kFim}>
            {tx('plano.entendi')}
          </button>
        </span>
      </div>
    );
  else if (s.origem === 'transicao' && !lido('nj-plano-novidade'))
    avisos.push(
      <div class="inbar info" key="novidade" id="avisoNovidade">
        <span>{tx('plano.novidade', { data: fdia(s.ate), n: TESTE_DIAS })}</span>
        <span class="row">
          <button class="btn sm" data-a="planosDlg">
            {tx('plano.verPlanos')}
          </button>
          <button class="btn sm ghost" data-a="lerAvisoPlano" data-v="nj-plano-novidade">
            {tx('plano.entendi')}
          </button>
        </span>
      </div>
    );
  return avisos.length ? <div class="avisos-plano">{avisos}</div> : null;
}

/* Lugares reservados nas telas montadas como texto. */
export const vCadeado = () => '<div id="travaRaiz"></div>';
export function montarCadeado(r: string) {
  const el = document.getElementById('travaRaiz');
  if (el) render(<Cadeado r={r} />, el);
}
export function montarAvisosPlano() {
  const el = document.getElementById('avisosPlanoRaiz');
  if (el) render(<AvisosPlano />, el);
}
