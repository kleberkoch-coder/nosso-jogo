/* Ações dos planos (KAN-119, pelada-v70): ver os planos, testar o Plano A, avisos e escolher os grupos ativos.
   Fazem parte de ACT (src/admin.js). */
import { TESTE_DIAS, fimDoTeste } from '../dominio/planos';
import { fdia } from '../dominio/grupo.js';
import { tp, tx } from '../i18n/index.js';
import * as banco from '../nucleo/backend.js';
// O banco é JavaScript sem tipos e é trocado ao iniciar (setB): lido na hora.
const bk = (): any => (banco as any).B;
const { op } = banco as any;
import { S as estado, w } from '../nucleo/estado.js';
import { cabeMaisUm, conviteDoGrupoCheio, limiteAdmins, limiteGrupos, meusAtivos } from '../nucleo/plano';
import { $, toast } from '../nucleo/util.js';
import { upMyGroup } from '../rotas.js';
import { closeDlg, confirmou, dlg, openDlg } from '../ui/dialogos.js';
import { changed } from '../ui/render.js';
/* As janelas baixam na primeira vez (ui/PlanosJanela.tsx). */
let J: typeof import('../ui/PlanosJanela') | null = null;
const janelas = () => (J ? Promise.resolve(J) : import('../ui/PlanosJanela').then(m => (J = m)));

const st = (): any => estado;
type El = HTMLElement & { dataset: DOMStringMap };

function abrirPlanos(motivo?: string) {
  return janelas().then(
    m => {
      openDlg('<div id="planosRaiz"></div>');
      dlg.setAttribute('aria-labelledby', 'planosTitulo');
      const el = $('#planosRaiz');
      if (el) m.montarPlanos(el, motivo);
    },
    () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
  );
}
/* Plano cheio de grupos ativos: explica e mostra os planos (no lugar de abrir o formulário). */
export function avisoLimiteGrupos(): boolean {
  if (cabeMaisUm()) return false;
  abrirPlanos(tx('plano.limiteGrupos', { grupos: tp('plano.nGrupos', limiteGrupos() as number) }));
  return true;
}
/* Plano cheio de administradores convidados (KAN-204): explica e mostra os planos, no lugar do convite. */
export function avisoLimiteAdmins(): boolean {
  if (!conviteDoGrupoCheio()) return false;
  abrirPlanos(tp('plano.limiteAdmins', limiteAdmins() as number));
  return true;
}
/* Inativa um grupo e tira da lista de ativos da conta, na mesma gravação (as regras conferem as duas juntas). */
export function inativarGrupo(gid: string) {
  const uid = st().user.uid;
  return bk()
    .lote([
      { tipo: 'patch', p: 'grupos/' + gid, o: { ativo: false, inativadoEm: Date.now() } },
      { tipo: 'patch', p: 'contas/' + uid, o: { ativos: op.remover([gid]) } },
    ])
    .then(() => upMyGroup(gid, { ativo: false }));
}
export function reativarGrupo(gid: string) {
  const uid = st().user.uid;
  return bk()
    .lote([
      { tipo: 'patch', p: 'grupos/' + gid, o: { ativo: true, inativadoEm: op.apagar() } },
      { tipo: 'patch', p: 'contas/' + uid, o: { ativos: op.uniao([gid]) } },
    ])
    .then(() => upMyGroup(gid, { ativo: true }));
}

export const acoes = {
  planosDlg: () => abrirPlanos(),
  testarPlano: (el: El) => {
    const S = st();
    if (!S.user || S.user.anon) return;
    const fim = fimDoTeste(Date.now());
    if (
      confirmou(el, {
        titulo: tx('plano.testarTitulo', { n: TESTE_DIAS }),
        texto: tx('plano.testarTexto', { data: fdia(fim) }),
        acao: tx('plano.testarAcao'),
      }) !== 'sim'
    )
      return;
    const agora = Date.now();
    S.conta = Object.assign({}, S.conta, { teste: agora });
    changed();
    closeDlg();
    return w(bk().patch('contas/' + S.user.uid, { teste: agora })).then(() =>
      toast(tx('plano.testeLigado', { data: fdia(fimDoTeste(agora)) }), 4500)
    );
  },
  lerAvisoPlano: (el: El) => {
    try {
      localStorage.setItem(el.dataset.v || '', '1');
    } catch (e) {}
    changed();
  },
  escolherAtivos: () =>
    janelas().then(
      m => {
        openDlg('<div id="escolherRaiz"></div>');
        dlg.setAttribute('aria-labelledby', 'escolherTitulo');
        const el = $('#escolherRaiz');
        if (el) m.montarEscolher(el);
      },
      () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
    ),
  salvarAtivos: async (el: El) => {
    const n = limiteGrupos() as number,
      marcados = [...document.querySelectorAll<HTMLInputElement>('#escolherLista input:checked')].map(i => i.value),
      err = $('#escolherErr');
    if (!marcados.length || marcados.length > n) {
      if (err) err.textContent = tx(marcados.length ? 'plano.escolherDemais' : 'plano.escolherNenhum', { n });
      return;
    }
    const sair = meusAtivos().filter(g => !marcados.includes(g));
    if (
      sair.length &&
      confirmou(el, {
        titulo: tp('plano.inativarTitulo', sair.length),
        texto: tx('plano.inativarTexto'),
        acao: tx('plano.manterAtivos'),
      }) !== 'sim'
    )
      return;
    try {
      for (const g of sair) await w(inativarGrupo(g));
      closeDlg();
      toast(tp('plano.inativados', sair.length));
    } catch (e) {
      console.error(e);
    }
  },
};
