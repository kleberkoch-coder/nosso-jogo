/* Ações dos administradores convidados: aceitar o convite, link de convite, remover e permissões (KAN-201, KAN-204).
   Saíram de acoes/grupo-lote.js na v87 (KAN-220: arquivos menores, por assunto) e baixam junto com ele, no primeiro
   uso de uma ação de grupo (acoes/grupo.ts). */
import { APP } from '../dominio/esportes.js';
import { gname } from '../dominio/grupo.js';
import { PERM_CONVIDADO, PERMISSOES, permLimpa, type Perm } from '../dominio/permissoes';
import { tx } from '../i18n/index.js';
import * as backend from '../nucleo/backend.js';
import { GB, S, w } from '../nucleo/estado';
import { linkConvite } from '../nucleo/links.js';
import { $, toast } from '../nucleo/util.js';
import { upMyGroup } from '../rotas.js';
import { shareDlg } from '../ui/Compartilhar';
import { closeDlg, confirmou, dlg } from '../ui/dialogos.js';
import { janelaPermissoes } from '../ui/JanelasGrupo';
import { changed } from '../ui/render.js';
import { avisoLimiteAdmins } from './plano';

type El = HTMLElement & { dataset: DOMStringMap; disabled?: boolean };
const bk = (): any => (backend as any).B;
const op = (): any => (backend as any).op;
const novoToken = (): string => bk().newId() + bk().newId();

function inviteLink() {
  if (avisoLimiteAdmins()) return; // KAN-204: o plano já tem todos os convidados que permite
  let t = S.convite?.token;
  if (!t) {
    t = novoToken();
    S.convite = { token: t };
    w(GB.set('privado/convite', { token: t }));
  }
  shareDlg(
    tx('admgrupo.conviteTitulo'),
    tx('admgrupo.conviteTexto', { grupo: gname(), app: APP, link: linkConvite(t) })
  );
}

export const acoes: Record<string, (el: El) => unknown> = {
  acceptInv: async el => {
    el.disabled = true;
    const R = S.route,
      u = S.user!,
      gid = R.gid || '',
      app = S.app!;
    try {
      // KAN-204: o convidado entra no fim da lista de convidados do grupo, na mesma gravação (dentro do limite do plano).
      await bk().lote([
        {
          tipo: 'set',
          p: 'grupos/' + gid + '/membros/' + u.uid,
          o: Object.assign(
            // KAN-201: convidado novo entra só com o dia a dia; o organizador libera o resto.
            { uid: u.uid, email: u.email, role: 'admin', token: R.token, at: Date.now(), perm: { ...PERM_CONVIDADO } },
            u.via ? { via: u.via } : {}
          ),
        },
        { tipo: 'patch', p: 'grupos/' + gid, o: { adms: op().uniao([u.uid]) } },
      ]);
      await upMyGroup(gid, {
        name: gname(),
        role: 'admin',
        sport: app.sport || 'futebol',
        sportName: app.sportName || '',
        ativo: app.ativo !== false,
        criado: app.createdAt || null,
      });
      location.hash = '#/g/' + gid;
    } catch (e) {
      console.error(e);
      el.disabled = false;
      toast(tx('admgrupo.conviteInvalido'));
    }
  },
  inviteLink: () => inviteLink(),
  newInviteLink: el => {
    if (
      confirmou(el, {
        titulo: tx('admgrupo.novoLinkTitulo'),
        texto: tx('admgrupo.novoLinkTexto'),
        acao: tx('admgrupo.novoLinkAcao'),
      }) !== 'sim'
    )
      return;
    const t = novoToken();
    S.convite = { token: t };
    w(GB.set('privado/convite', { token: t }));
    inviteLink();
  },
  rmMember: el => {
    if (
      confirmou(el, {
        titulo: tx('admgrupo.removerTitulo'),
        texto: tx('admgrupo.removerTexto'),
        acao: tx('admgrupo.removerAcao'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    const u = el.dataset.v || '';
    if (S.membros) delete S.membros[u];
    S.convite = null;
    changed();
    // KAN-204: sai também da lista de convidados, liberando a vaga do plano.
    const fora = GB.lote([
      { tipo: 'del', p: 'membros/' + u },
      { tipo: 'patch', p: 'config/app', o: { adms: op().remover([u]) } },
    ]);
    return Promise.all([w(fora), w(GB.del('privado/convite'))]).then(() => toast(tx('admgrupo.removido'), 4500));
  },
  /* Permissões de um administrador convidado (KAN-201): só o organizador abre e muda. Vale na hora para o convidado. */
  abrirPerm: el => {
    const u = el.dataset.v || '',
      m = (S.membros || {})[u];
    if (!m || m.role === 'owner') return;
    const atual = m.perm === undefined || m.perm === null ? null : (permLimpa(m.perm) as Record<string, boolean>);
    janelaPermissoes(u, m.email || u, atual);
    dlg.setAttribute('aria-labelledby', 'permTitulo');
  },
  salvarPerm: el => {
    const u = el.dataset.v || '',
      m = (S.membros || {})[u];
    if (!m) return;
    const p: Perm = {};
    PERMISSOES.forEach(k => (p[k] = !!($('#perm_' + k) as HTMLInputElement | null)?.checked));
    const perm = permLimpa(p);
    S.membros = Object.assign({}, S.membros, { [u]: Object.assign({}, m, { perm }) });
    changed();
    closeDlg();
    return w(GB.patch('membros/' + u, { perm })).then(() => toast(tx('perm.salvo')));
  },
};
