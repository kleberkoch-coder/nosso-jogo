/* Dados que dependem das permissões do administrador (KAN-201; KAN-225, saiu de rotas.js): caixa, contatos e convite.
   Roda ao começar e a cada mudança no cadastro do administrador, então liberar ou tirar vale na hora. */
import { migrarPrivado, sincronizarVagas } from '../dominio/caixa.js';
import { posso } from '../dominio/grupo.js';
import { GB, S, SUBS, drop, sub, w } from '../nucleo/estado';

function liga(k: string, path: string, on: boolean, cb: (d: any) => void, off: () => void) {
  if (on && !SUBS[k]) sub(k, path, cb);
  else if (!on && SUBS[k]) {
    drop(k);
    off();
  }
}
export function syncPerm() {
  if (!S.dataOn) return;
  liga(
    'pc',
    'privado/caixa',
    posso('caixa'),
    d => {
      S.pc = d;
      migrarPrivado();
      sincronizarVagas();
    },
    () => {
      S.pc = null;
    }
  );
  liga(
    'cont',
    'privado/contatos',
    posso('elenco'),
    d => {
      S.cont = d || {};
    },
    () => {
      S.cont = {};
    }
  );
  liga(
    'convite',
    'privado/convite',
    posso('config'),
    d => {
      S.convite = d;
    },
    () => {
      S.convite = null;
    }
  );
  if (S.tab === 'caixa' && !posso('caixa')) S.tab = 'rodada';
}
/* Grava no cadastro do administrador como ele entrou (Google ou e-mail e senha). Só muda esse campo. */
export function syncVia() {
  const m = S.mem,
    u = S.user;
  if (!m || !u || !u.via || m.via === u.via || !S.gid) return;
  w(GB.patch('membros/' + u.uid, { via: u.via }));
}
