/* Plano em vigor no app (KAN-119, pelada-v70). Parte da gestão: o link do jogador não baixa.
   - A conta de quem está entrando: contas/{uid} (plano do portal, início do teste, lista de grupos ativos).
   - O grupo aberto: do organizador. O organizador lê a própria ficha; os convidados leem o espelho (grupos/{gid}.pl),
     que o app do organizador atualiza. Quem garante são as regras do Firebase, que leem a ficha de verdade.
   As contas puras ficam em dominio/planos.ts, com teste. */
import {
  catalogo,
  espelho,
  gruposAcima,
  limiteDeGrupos,
  mesmoEspelho,
  situacao,
  situacaoDoEspelho,
  temRecurso,
  transicaoAte,
  type Situacao,
} from '../dominio/planos';
import { definirRecursos, isOwnerMe } from '../dominio/grupo.js';
import * as banco from './backend.js';
// O banco é JavaScript sem tipos e é trocado ao iniciar (setB): lido na hora.
const bk = (): any => (banco as any).B;
import { GB, S as estado, w } from './estado.js';

const st = (): any => estado;
const cat = () => catalogo(st().planosCfg);

/* Plano da conta de quem está usando o app. */
export function minhaSituacao(): Situacao {
  const S = st();
  return situacao(S.conta, cat(), Date.now(), transicaoAte(S.planosCfg));
}
/* Plano do grupo aberto: o do organizador. */
export function situacaoDoGrupo(): Situacao {
  const S = st();
  if (isOwnerMe() && S.loaded.conta) return minhaSituacao();
  return situacaoDoEspelho(S.app && S.app.pl, cat(), Date.now());
}
export const temNoGrupo = (k: string) => temRecurso(situacaoDoGrupo(), k);
definirRecursos(temNoGrupo);

/* Grupos ativos de que a pessoa é organizadora (lista "Meus grupos"). */
export function meusAtivos(): string[] {
  const g = (st().me && st().me.grupos) || {};
  return Object.keys(g).filter(k => g[k] && g[k].role === 'owner' && g[k].ativo !== false);
}
export const limiteGrupos = () => limiteDeGrupos(minhaSituacao());
export const gruposDemais = () => gruposAcima(meusAtivos().length, minhaSituacao());
/* Cabe mais um grupo ativo no plano? (criar, duplicar ou reativar) */
export function cabeMaisUm(): boolean {
  const n = limiteGrupos();
  return n === null || meusAtivos().length < n;
}

/* Mantém o espelho do plano no grupo e, para contas de antes da v70, grava a lista de grupos ativos uma vez. */
let espelhoEnviado = '';
export function sincronizarPlano() {
  const S = st();
  if (!S.user || S.user.anon || !S.loaded.conta || !S.loaded.planosCfg) return;
  if (S.gid && S.app && S.loaded.app && isOwnerMe()) {
    const e = espelho(minhaSituacao()),
      k = S.gid + JSON.stringify(e);
    if (!mesmoEspelho(S.app.pl, e) && espelhoEnviado !== k) {
      espelhoEnviado = k;
      w(GB.patch('config/app', { pl: e })).catch(() => {});
    }
  }
  if (S.loaded.me && !(S.conta && Array.isArray(S.conta.ativos)) && !S.ativosGravando) {
    S.ativosGravando = true;
    bk()
      .patch('contas/' + S.user.uid, { ativos: meusAtivos() })
      .catch((e: unknown) => console.warn('ativos', e));
  }
}
