/* Ações de grupo e de administradores (criar, editar, duplicar, posições, inativar, convite, permissões, país da conta).
   Desde a v84 (D35) o código delas baixa na primeira vez que uma é usada (acoes/grupo-lote.js, com os textos em
   i18n/pt-BR-grupolote.ts), para a gestão abrir leve. Fazem parte de ACT (src/admin.js). */
import { tx } from '../i18n/index.js';
import { toast } from '../nucleo/util.js';

type El = HTMLElement & { dataset: DOMStringMap };
type Acoes = Record<string, (el: El) => unknown>;
/* Depois de baixar, a ação roda na hora (sem esperar): escolhas dentro do formulário, como o esporte, mudam já no toque. */
let pronto: Acoes | null = null;
const parte = () => import('./grupo-lote.js').then(m => (pronto = m.acoes as Acoes));
const adiar = (k: string) => (el: El) =>
  pronto
    ? pronto[k]!(el)
    : parte().then(
        a => a[k]!(el),
        () => toast(tx('comum.naoCarregouTitulo') + '. ' + tx('comum.naoCarregou'))
      );

export const acoes = Object.fromEntries(
  [
    'contaPais',
    'salvarPaisConta',
    'newGroup',
    'editGroup',
    'pickFreq',
    'addSched',
    'rmSched',
    'saveGroup',
    'addPos',
    'savePos',
    'rmPos',
    'dupGroup',
    'doDupGroup',
    'toggleAtivo',
    'pickSport',
    'createGroup',
    'groupsDlg',
    'acceptInv',
    'inviteLink',
    'newInviteLink',
    'rmMember',
    'abrirPerm',
    'salvarPerm',
    'forgetGroup',
  ].map(k => [k, adiar(k)])
);
