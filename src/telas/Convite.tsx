/* Convite para administrar um grupo (KAN-218: virou componente; antes montava a tela como texto).
   Sem conta: a tela de entrar/criar conta com o cabeçalho do convite (#invHead). Com conta: aceitar, já administra,
   grupo não encontrado ou plano cheio (KAN-204). Baixa só quando um convite é aberto (KAN-217). */
import { render } from 'preact';
import { sport, sportName } from '../dominio/esportes.js';
import { gname } from '../dominio/grupo.js';
import { juntarTextos, tp, tx } from '../i18n/index.js';
import textos from '../i18n/pt-BR-convite';
import { conviteDoGrupoCheio, limiteAdmins } from '../nucleo/plano';
import { S as estado } from '../nucleo/estado.js';
import { $, main } from '../nucleo/util.js';
import { entrarPronto } from '../nucleo/carga-entrar';

juntarTextos(textos);
const st = (): any => estado;

function Cabecalho() {
  const S = st(),
    n = S.app ? gname() : '';
  return (
    <>
      <h2 style={{ margin: 0 }}>{n ? tx('convite.convidado', { grupo: n }) : tx('convite.convidadoSemNome')}</h2>
      {S.app ? (
        <p class="muted small" style={{ margin: '6px 0 0' }}>
          {sport().e} {sportName()}
        </p>
      ) : null}
      <p class="small muted" style={{ margin: '8px 0 0' }}>
        {tx(S.loaded.app && !S.app ? 'convite.naoExiste' : 'convite.crieConta')}
      </p>
    </>
  );
}

function Logado() {
  const S = st();
  if (!S.loaded.app || !S.loaded.mem) return <div class="empty muted">{tx('comum.carregando')}</div>;
  if (!S.app)
    return (
      <div class="panel empty auth">
        <h2>{tx('convite.naoEncontrado')}</h2>
        <p class="muted">{tx('convite.naoEncontradoTexto')}</p>
        <a class="btn" href="#/">
          {tx('convite.meusGrupos')}
        </a>
      </div>
    );
  if (S.mem)
    return (
      <div class="panel empty auth">
        <h2>{tx('convite.jaAdministra', { grupo: gname() })}</h2>
        <p class="muted">{tx('convite.naoPrecisa')}</p>
        <a class="btn primary" href={'#/g/' + S.gid}>
          {tx('convite.abrir')}
        </a>
      </div>
    );
  /* KAN-204: o plano do grupo já tem todos os administradores convidados que permite. */
  if (conviteDoGrupoCheio())
    return (
      <div class="panel empty auth" id="conviteCheio">
        <h2>{tx('convite.cheioTitulo')}</h2>
        <p class="muted">{tp('convite.cheioTexto', limiteAdmins(), { grupo: gname() })}</p>
        <a class="btn" href="#/">
          {tx('convite.meusGrupos')}
        </a>
      </div>
    );
  return (
    <div class="auth">
      <div class="panel">
        <h2 style={{ margin: 0 }}>{tx('convite.administrar', { grupo: gname() })}</h2>
        <p class="muted small" style={{ margin: '6px 0 0' }}>
          {sport().e} {sportName()}
        </p>
        <p style={{ margin: '14px 0 0' }}>{tx('convite.aoAceitar')}</p>
        <p class="small muted" style={{ margin: '10px 0 16px' }}>
          {tx('convite.conta', { email: S.user.email })}
        </p>
        <button class="btn primary" style={{ width: '100%', justifyContent: 'center' }} data-a="acceptInv">
          {tx('convite.aceitar')}
        </button>
        <p class="small muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>
          {tx('convite.naoEVoce')}{' '}
          <button class="linkbtn" data-a="invSwitch">
            {tx('convite.outraConta')}
          </button>
        </p>
      </div>
    </div>
  );
}

/* Onde o componente desenha: um lugar próprio dentro de main, recriado quando outra tela ocupou main. */
let raiz: HTMLElement | null = null;
function lugar(): HTMLElement {
  if (!raiz || raiz.parentNode !== main) {
    raiz = document.createElement('div');
    main.replaceChildren(raiz);
  }
  return raiz;
}

function renderInvite() {
  const S = st(),
    logged = !!(S.user && !S.user.anon);
  if (!logged) {
    /* Mantém o que já foi digitado quando o nome do grupo chega depois. */
    if (!($('#le') && $('#invHead') && main.dataset.inv === S.authMode)) {
      main.dataset.inv = S.authMode;
      raiz = null;
      const d = document.createElement('div');
      d.id = 'authRaiz';
      main.replaceChildren(d);
      (entrarPronto() as any).montarAuth(true);
    }
    const h = $('#invHead');
    if (h) {
      /* Se a tela de entrar se redesenhou e limpou o cabeçalho, ele é montado de novo. */
      if (!h.firstChild) render(null, h);
      render(<Cabecalho />, h);
    }
    return;
  }
  main.dataset.inv = '';
  render(<Logado />, lugar());
}

export { renderInvite };
