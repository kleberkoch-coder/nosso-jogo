/* Aba Grupo como componente em TypeScript + Preact (KAN-201; antes, telas/grupo.js).
   Mostra os dados do grupo, as posições, partidas e caixa, os administradores com as permissões de cada convidado
   (só o organizador muda) e a aparência. Cada botão aparece só para quem tem a permissão (dominio/permissoes.ts);
   as regras do Firebase garantem o mesmo. Os botões usam data-a (ações em acoes/grupo.js e acoes/jogadores.js). */
import { render } from 'preact';
import { cfg } from '../dominio/caixa.js';
import { basePos, porTime, sport, sportName } from '../dominio/esportes.js';
import { fdia, fixos, freq, gname, grpAtivo, isOwnerMe, posso, recurso } from '../dominio/grupo.js';
import { faixaTexto } from '../dominio/rodadas.js';
import { PERMISSOES, pode, type Membro } from '../dominio/permissoes';
import { tx } from '../i18n/index.js';
import { S as estado } from '../nucleo/estado.js';
import { DIAS, brl } from '../nucleo/util.js';
import { numeroVersao } from '../nucleo/versao.js';
import { THEMES, effTheme, getTheme } from '../ui/tema.js';

const st = (): any => estado;
type Fixo = { dow: number; ini: string; fim?: string; place?: string };
type MembroDoc = { role?: string; email?: string; via?: string; perm?: Record<string, boolean> | null };

/* "G" colorido do Google, pequeno, ao lado de quem entrou com o Google (pelada-v17). */
function GMini() {
  return (
    <svg viewBox="0 0 48 48" width="12" height="12" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/* Como o administrador entrou da última vez (pelada-v17). Vazio até o próximo acesso dele. */
function Via({ v }: { v?: string }) {
  if (v !== 'google' && v !== 'senha') return null;
  const n = tx(v === 'google' ? 'grupo.viaGoogle' : 'grupo.viaSenha');
  return (
    <>
      <br />
      <span class="via tag" title={tx('grupo.viaTitulo', { via: n })}>
        {v === 'google' ? <GMini /> : '✉️'} {n}
      </span>
    </>
  );
}

/* O que o convidado pode, em uma linha ("Só o dia a dia" ou "Dia a dia, caixa e notas"). */
function resumoPerm(m: MembroDoc) {
  if (m.perm === undefined || m.perm === null) return tx('perm.tudo');
  const k = PERMISSOES.filter(p => pode(m as Membro, p));
  if (!k.length) return tx('perm.soDiaADia');
  if (k.length === PERMISSOES.length) return tx('perm.tudo');
  const n = k.map(p => tx('perm.curto.' + p));
  const itens = n.length === 1 ? n[0] : n.slice(0, -1).join(', ') + ' ' + tx('perm.eUltimo', { item: n[n.length - 1] });
  return tx('perm.diaADiaE', { itens });
}

function Administradores() {
  const S = st(),
    dono = isOwnerMe(),
    config = posso('config');
  const lista = (Object.entries(S.membros || {}) as [string, MembroDoc][]).sort(
    (x, y) => (x[1].role === 'owner' ? -1 : 1) - (y[1].role === 'owner' ? -1 : 1)
  );
  return (
    <div class="panel" id="adminsPainel">
      <div class="row between">
        <h3 style="margin:0">{tx('grupo.admins')}</h3>
        {config && (
          <button class="btn sm" data-a="inviteLink">
            {tx('grupo.convidar')}
          </button>
        )}
      </div>
      <ul class="plist" style="margin-top:6px">
        {lista.map(([u, m]) => (
          <li key={u}>
            <span class="pn">
              {m.email || u}
              {u === S.user.uid && <span class="tag"> · {tx('grupo.voce')}</span>}
              <Via v={m.via} />
              {m.role !== 'owner' && (
                <>
                  <br />
                  <span class="small muted perm-resumo">{resumoPerm(m)}</span>
                </>
              )}
            </span>
            <span class="tag">{tx(m.role === 'owner' ? 'grupo.organizador' : 'grupo.admin')}</span>
            {dono && m.role !== 'owner' && (
              <button class="btn sm" data-a="abrirPerm" data-v={u}>
                {tx('perm.botao')}
              </button>
            )}
            {dono && m.role !== 'owner' && (
              <button class="btn sm ghost danger" data-a="rmMember" data-v={u}>
                {tx('grupo.remover')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {config && (
        <p class="small muted" style="margin-top:8px">
          {tx('grupo.conviteAjuda')}{' '}
          {S.convite && S.convite.token && (
            <button class="linkbtn" data-a="newInviteLink">
              {tx('grupo.invalidarConvite')}
            </button>
          )}
        </p>
      )}
    </div>
  );
}

/* Aparência (Automático, Claro, Escuro): vale só para este aparelho. */
function Aparencia() {
  const t = getTheme();
  return (
    <div class="panel">
      <h3>{tx('aparencia.titulo')}</h3>
      <div class="theme-seg" role="radiogroup" aria-label={tx('aparencia.rotulo')}>
        {(THEMES as [string, string, string][]).map(([k, ic, l]) => (
          <button key={k} role="radio" aria-checked={t === k} data-a="setTheme" data-v={k}>
            <span aria-hidden="true">{ic}</span> {l}
          </button>
        ))}
      </div>
      <p class="small muted" style="margin:8px 0 0">
        {t === 'auto' ? tx(effTheme() === 'dark' ? 'aparencia.autoEscuro' : 'aparencia.autoClaro') + ' ' : ''}
        {tx('aparencia.soAparelho')}
      </p>
    </div>
  );
}

function GrupoTela() {
  const S = st(),
    a = S.app,
    f = fixos() as Fixo[],
    c = cfg() as { minutes: number; mensal: number; diaria: number; pix?: string; foraPos?: string[] },
    dono = isOwnerMe(),
    config = posso('config'),
    caixa = posso('caixa'),
    // Duplicar copia elenco, notas, contatos e caixa: só quem pode ver tudo isso.
    duplicar = config && caixa && posso('notas') && posso('elenco');
  return (
    <div class="stack">
      <div class="panel">
        <div class="row between" style="align-items:flex-start">
          <div class="row" style="align-items:center">
            <span class="gem">{sport().e}</span>
            <div>
              <h2 style="margin:0">{gname()}</h2>
              <div class="small muted">
                {sportName()} · {tx('grupo.criadoEm', { data: fdia(a.createdAt) })}
              </div>
            </div>
          </div>
          <span class={'stat ' + (grpAtivo() ? 'on' : 'off')}>{tx(grpAtivo() ? 'grupo.ativo' : 'grupo.inativo')}</span>
        </div>
        <dl class="ficha">
          <dt>{tx('grupo.fichaFrequencia')}</dt>
          <dd>{tx(freq() === 'fixo' ? 'grupo.frequenteFixos' : 'grupo.esporadico')}</dd>
          {freq() === 'fixo' && (
            <>
              <dt>{tx('grupo.diasHorarios')}</dt>
              <dd>
                {f.length
                  ? f.map((x, i) => (
                      <div key={i}>
                        {DIAS[x.dow]}, {faixaTexto(x.ini, x.fim)}
                        {x.place ? (
                          <>
                            {' · '}
                            <span class="corta" data-corta>
                              {x.place}
                            </span>
                          </>
                        ) : null}
                      </div>
                    ))
                  : '—'}
              </dd>
            </>
          )}
          <dt>{tx('grupo.porTime')}</dt>
          <dd>{porTime() === 2 ? tx('grupo.duplas') : porTime()}</dd>
          {(c.foraPos || []).length > 0 && (
            <>
              <dt>{tx('grupo.foraSorteio')}</dt>
              <dd>{(c.foraPos || []).join(', ')}</dd>
            </>
          )}
          {!grpAtivo() && (
            <>
              <dt>{tx('grupo.inativadoEm')}</dt>
              <dd>{fdia(a.inativadoEm)}</dd>
            </>
          )}
        </dl>
        {(config || duplicar || dono) && (
          <div class="row" style="margin-top:12px">
            {config && (
              <button class="btn primary sm" data-a="editGroup">
                {tx('grupo.editar')}
              </button>
            )}
            {duplicar && (
              <button class="btn sm" data-a="dupGroup">
                {tx('grupo.duplicar')}
              </button>
            )}
            {dono &&
              (grpAtivo() ? (
                <button class="btn sm ghost danger" data-a="toggleAtivo">
                  {tx('grupo.inativar')}
                </button>
              ) : (
                <button class="btn sm" data-a="toggleAtivo">
                  {tx('grupo.reativar')}
                </button>
              ))}
          </div>
        )}
        {!dono && (
          <p class="small muted" style="margin-top:8px">
            {tx('grupo.soOrganizadorInativa')}
          </p>
        )}
      </div>
      <div class="panel">
        <div class="row between">
          <h3 style="margin:0">{tx('grupo.posicoes')}</h3>
          {config && (
            <button class="btn sm" data-a="addPos">
              {tx('grupo.novaPosicao')}
            </button>
          )}
        </div>
        <p class="small muted">{tx('grupo.doEsporte', { esporte: sportName() })}</p>
        <div class="poschips">
          {(basePos() as [string, string][]).length ? (
            (basePos() as [string, string][]).map(([k, l]) => (
              <span key={k}>
                <b>{k}</b> {l}
              </span>
            ))
          ) : (
            <span class="muted">{tx('grupo.nenhuma')}</span>
          )}
        </div>
        <p class="small muted" style="margin-top:12px">
          {tx('grupo.criadasPorVoces')}
        </p>
        <div class="poschips">
          {(a.posx || []).length ? (
            (a.posx as [string, string][]).map(([k, l], i) => (
              <span key={k}>
                <b>{k}</b> {l}
                {config && (
                  <button
                    class="linkbtn"
                    data-a="rmPos"
                    data-v={i}
                    aria-label={tx('grupo.removerPosicao', { nome: l })}
                  >
                    ✕
                  </button>
                )}
              </span>
            ))
          ) : (
            <span class="muted small">{tx('grupo.nenhumaAinda')}</span>
          )}
        </div>
      </div>
      <div class="grid2">
        <div class="panel">
          <div class="row between">
            <h3 style="margin:0">{tx(caixa ? 'grupo.partidasCaixa' : 'grupo.partidas')}</h3>
            {(config || (caixa && recurso('caixa'))) && (
              <button class="btn sm" data-a="settings">
                {tx('grupo.editarCurto')}
              </button>
            )}
          </div>
          <p class="small muted">
            {tx('grupo.minutosPartida', { n: c.minutes })}
            {caixa
              ? ' · ' +
                tx('grupo.valoresCaixa', { mensal: brl(c.mensal), diaria: brl(c.diaria) }) +
                (c.pix ? ' · ' + tx('grupo.pix', { pix: c.pix }) : '')
              : ''}
          </p>
        </div>
        <Administradores />
      </div>
      <Aparencia />
      <p class="versao small muted">{tx('comum.versao', { n: numeroVersao() })}</p>
    </div>
  );
}

/* A gestão desenha as abas com texto; a aba Grupo entra num lugar reservado (#grupoRaiz). */
const vGrupo = () => '<div id="grupoRaiz"></div>';
function montarGrupo() {
  const el = document.getElementById('grupoRaiz');
  if (el) render(<GrupoTela />, el);
}

export { montarGrupo, vGrupo };
