/* Desenho da página inicial e da gestão do grupo (abas, avisos de grupo bloqueado, só vê e inativo, sem acesso e grupo
   não encontrado). Saiu de ui/render.js (KAN-274, pelada-v119) para vir com a parte de gestão (src/admin.js): o link do
   jogador não baixa nada disto. ui/render.js chama renderGestao com os ajudantes dele (el, lugar, baixar…). */
import { fdia, gname, grpAtivo, grpBloq, curRodada, isAdmin, isOwnerMe, posso, soVer } from '../dominio/grupo.js';
import { sport, sportName } from '../dominio/esportes.js';
import { hora } from '../dominio/rodadas.js';
import { tx } from '../i18n/index.js';
import { adm } from '../nucleo/carga-admin.js';
import { S } from '../nucleo/estado.js';
import { $, fdate, main } from '../nucleo/util.js';
import { ensurePres, ensureVotos } from '../rotas';

const TABS = ['rodada', 'historico', 'jogadores', 'partida', 'ranking', 'caixa', 'votacao', 'grupo'];

type U = {
  el: (tag: string, cls?: string, txt?: string, attrs?: Record<string, string>) => HTMLElement;
  lugar: (id: string) => HTMLElement;
  baixar: (p: Promise<unknown>, guardar?: ((m: unknown) => void) | null, onde?: HTMLElement) => void;
  travada: (k: string) => boolean;
  abasNoLugar: () => void;
};

export function renderGestao(u: U) {
  const { el, lugar, baixar, travada, abasNoLugar } = u;
  const A: any = adm();
  const s: any = S;
  /* Painel de aviso no meio da tela (grupo não encontrado, sem acesso). */
  const painel = (titulo: string, texto: string, acoes: HTMLElement[], emLinha?: boolean) => {
    const p = el('div', 'panel empty auth');
    p.append(el('h2', '', titulo), el('p', 'muted', texto));
    if (!emLinha) p.append(...acoes);
    else {
      const r = el('div', 'row');
      r.style.justifyContent = 'center';
      r.append(...acoes);
      p.append(r);
    }
    return p;
  };
  const meusGrupos = () => el('a', 'btn', tx('gtela.meusGrupos'), { href: '#/' });
  const R = s.route;
  A.sincronizarPlano();
  if (R.n === 'home') {
    main.replaceChildren(lugar(A.vHome()));
    A.montarHome();
    return;
  }
  if (!s.loaded.mem || !s.loaded.app) {
    main.replaceChildren(el('div', 'empty muted', tx('comum.carregando')));
    return;
  }
  if (!s.app) {
    main.replaceChildren(painel(tx('gtela.naoEncontrado'), tx('gtela.naoEncontradoTexto'), [meusGrupos()]));
    return;
  }
  if (!isAdmin()) {
    const acoes = [meusGrupos()];
    if (s.me?.grupos?.[s.gid])
      acoes.push(el('button', 'btn ghost danger', tx('gtela.removerDaLista'), { 'data-a': 'forgetGroup' }));
    main.replaceChildren(
      painel(tx('gtela.semAcesso'), tx('gtela.semAcessoTexto', { email: s.user.email, grupo: gname() }), acoes, true)
    );
    return;
  }
  const r0 = curRodada();
  $('#gsub').textContent =
    `${sport().e} ${sportName()}` +
    (r0 ? ' · ' : '') +
    (r0 ? tx('gtela.proxima', { data: fdate(r0.date) + (r0.time ? ' · ' + hora(r0) : '') }) : '');
  $('#tabsnav').hidden = false;
  /* KAN-201: sem a permissão de caixa, a aba Caixa não aparece. */
  if (s.tab === 'caixa' && !posso('caixa')) s.tab = 'rodada';
  $('#tabs').replaceChildren(
    ...TABS.filter(k => k !== 'caixa' || posso('caixa')).map(k => {
      const b = el('button', 'tab', tx('gtela.aba.' + k), {
        role: 'tab',
        'aria-selected': String(s.tab === k),
        'data-a': 'tab',
        'data-v': k,
      });
      if (travada(k)) b.append(' ', el('span', 'tab-trava', '🔒', { 'aria-hidden': 'true' }));
      return b;
    })
  );
  abasNoLugar();
  ensurePres();
  ensureVotos();
  /* KAN-262: a carga das abas vem com a gestão (src/admin.js). */
  if (A) A.ensureExtras();
  /* Abas sob demanda (KAN-180): enquanto a parte não chegou, um lugar para o "Carregando…". */
  const aba = (k: string) => (travada(k) ? A.vCadeado() : A.abaPronta(k) ? A.abaPronta(k).ver() : 'abaRaiz');
  /* KAN-204: convidado além do limite do plano: tudo à vista, nada que grave. */
  const soVe = soVer();
  document.body.classList.toggle('so-ver', soVe);
  const partes = [lugar('avisosPlanoRaiz')];
  /* KAN-117: grupo bloqueado pela administração: um aviso só, no lugar do "só vê" e do "inativo". */
  if (grpBloq()) {
    const b = el('div', 'inbar', '', { id: 'avisoBloqueado' });
    b.append(el('span', '', tx('gtela.bloqueado')));
    partes.push(b);
  } else if (soVe) {
    const b = el('div', 'inbar info', '', { id: 'avisoSoVer' });
    b.append(el('span', '', tx('gtela.soVer')));
    partes.push(b);
  }
  if (!grpAtivo() && !grpBloq()) {
    const b = el('div', 'inbar');
    b.append(el('span', '', tx('gtela.inativo', { data: fdia(s.app.inativadoEm) })));
    if (isOwnerMe()) b.append(el('button', 'btn sm', tx('gtela.reativar'), { 'data-a': 'toggleAtivo' }));
    partes.push(b);
  }
  partes.push(
    lugar(
      (
        {
          rodada: A.vRodada,
          jogadores: A.vJogadores,
          partida: () => (A.partidaPronta() ? A.partidaPronta().vPartida() : 'partidaRaiz'),
          ranking: () => aba('ranking'),
          caixa: () => aba('caixa'),
          votacao: () => aba('votacao'),
          historico: () => aba('historico'),
          grupo: () => aba('grupo'),
        } as Record<string, () => string>
      )[s.tab]!()
    )
  );
  main.replaceChildren(...partes);
  A.montarAvisosPlano();
  if (travada(s.tab)) return A.montarCadeado(s.tab);
  if (A.abaSobDemanda(s.tab)) {
    const M = A.abaPronta(s.tab);
    if (!M) return baixar(A.carregarAba(s.tab), null, $('#abaRaiz'));
    if (M.montar) M.montar();
  }
  if (s.tab === 'rodada') A.montarRodada();
  if (s.tab === 'jogadores') A.montarJogadores();
  if (s.tab === 'partida') {
    const P = A.partidaPronta();
    if (!P) return baixar(A.carregarPartida(), null, $('#partidaRaiz'));
    P.montarPartida();
    P.tick();
  }
}
