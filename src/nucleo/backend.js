import { cl, idOk, uid } from './util.js';
import { doBanco, paraBanco, temListaDentroDeLista } from './dados-banco.ts';

/* =================== backends =================== */
function FirebaseBackend(cfg, appCheckKey) {
  firebase.initializeApp(cfg);
  if (appCheckKey && firebase.appCheck) {
    try {
      firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(appCheckKey), true);
    } catch (e) {
      console.warn('App Check', e);
    }
  }
  const auth = firebase.auth(),
    fs = firebase.firestore();
  /* Testes contra o emulador do Firebase (KAN-170): a montagem de teste define window.FIREBASE_EMULADOR.
     Assim o roteiro de gravação passa pelo Firestore de verdade (com as regras), sem tocar nos dados reais. */
  const em = window.FIREBASE_EMULADOR;
  if (em) {
    auth.useEmulator(em.auth, { disableWarnings: true });
    const [h, p] = String(em.firestore).split(':');
    fs.useEmulator(h, +p);
  }
  try {
    fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  } catch (e) {}
  return {
    demo: false,
    /* via = como entrou da última vez ('google' ou 'senha'), mostrado na lista de administradores (pelada-v17).
       Vem primeiro dos provedores ligados à conta e é confirmado pelo token, sem atrasar a abertura do app. */
    onAuth: cb =>
      auth.onAuthStateChanged(u => {
        if (!u) return cb(null);
        const ids = (u.providerData || []).map(p => p.providerId),
          g = ids.includes('google.com'),
          pw = ids.includes('password');
        const o = {
          uid: u.uid,
          email: u.email,
          verificado: !!u.emailVerified,
          anon: u.isAnonymous,
          via: g && !pw ? 'google' : pw && !g ? 'senha' : null,
        };
        cb(o);
        if (!u.isAnonymous)
          u.getIdTokenResult()
            .then(r => {
              const p = r.signInProvider,
                v = p === 'google.com' ? 'google' : p === 'password' ? 'senha' : null;
              if (v && v !== o.via) {
                o.via = v;
                document.dispatchEvent(new Event('nj-via'));
              }
            })
            .catch(() => {});
      }),
    login: (e, p) => auth.signInWithEmailAndPassword(e, p),
    signup: (e, p) => auth.createUserWithEmailAndPassword(e, p),
    reset: e => auth.sendPasswordResetEmail(e),
    /* Sair (KAN-80): além de desconectar, apaga a cópia offline do banco que fica no navegador
       (notas, contatos, caixa e chave Pix do administrador). Depois disso o app precisa recarregar. */
    logout: async () => {
      await auth.signOut();
      try {
        await fs.terminate();
        await fs.clearPersistence();
        return true;
      } catch (e) {
        console.warn('limpar dados do aparelho', e);
        return false;
      }
    },
    /* Tudo já foi enviado ao servidor? Espera até ms; sem sinal, responde false. */
    semPendencias: ms =>
      Promise.race([fs.waitForPendingWrites().then(() => true), sleep(ms || 3000).then(() => false)]),
    anon: () => auth.signInAnonymously(),
    /* Google: abre a janela de escolha de conta. Se o navegador bloquear janelas
       (alguns celulares e o app instalado), troca para o redirecionamento de página inteira. */
    google: async () => {
      const pv = new firebase.auth.GoogleAuthProvider();
      pv.setCustomParameters({ prompt: 'select_account' });
      try {
        return await auth.signInWithPopup(pv);
      } catch (e) {
        if (
          e &&
          [
            'auth/popup-blocked',
            'auth/operation-not-supported-in-this-environment',
            'auth/web-storage-unsupported',
          ].includes(e.code)
        ) {
          await auth.signInWithRedirect(pv);
          return new Promise(() => {});
        }
        throw e;
      }
    },
    redirectResult: () => auth.getRedirectResult(),
    sub(path, cb, err) {
      if (path.split('/').length % 2)
        return fs.collection(path).onSnapshot(s => {
          const o = {};
          s.forEach(d => {
            if (idOk(d.id)) o[d.id] = doBanco(d.data());
          });
          cb(o);
        }, err);
      return fs.doc(path).onSnapshot(
        { includeMetadataChanges: false },
        s => {
          if (!s.exists && s.metadata.fromCache && path.startsWith('usuarios/') && navigator.onLine) return;
          cb(s.exists ? doBanco(s.data()) : null);
        },
        err
      );
    },
    /* Consulta ao vivo com filtro de data e limite (D10): q = {campo, de, ate, ordem:'asc'|'desc', limite}. */
    query(path, q, cb, err) {
      return fsQuery(fs, path, q).onSnapshot(s => {
        const o = {};
        s.forEach(d => {
          if (idOk(d.id)) o[d.id] = doBanco(d.data());
        });
        cb(o);
      }, err);
    },
    /* Uma página de resultados, sem ficar ouvindo (Histórico). cursor vem da página anterior. */
    async pagina(path, q, cursor) {
      let x = fsQuery(fs, path, q);
      if (cursor) x = x.startAfter(cursor);
      const s = await x.get();
      return {
        itens: s.docs.filter(d => idOk(d.id)).map(d => [d.id, doBanco(d.data())]),
        cursor: s.docs[s.docs.length - 1] || null,
        fim: s.docs.length < q.limite,
      };
    },
    async get(path) {
      if (path.split('/').length % 2) {
        const s = await fs.collection(path).get(),
          o = {};
        s.forEach(d => {
          if (idOk(d.id)) o[d.id] = doBanco(d.data());
        });
        return o;
      }
      const s = await fs.doc(path).get();
      return s.exists ? doBanco(s.data()) : null;
    },
    /* Leitura que exige o servidor (migração e Recalcular): sem internet falha, em vez de usar só o que está no aparelho. */
    async getServidor(path) {
      const s = await fs.collection(path).get({ source: 'server' }),
        o = {};
      s.forEach(d => {
        if (idOk(d.id)) o[d.id] = doBanco(d.data());
      });
      return o;
    },
    set: (p, o) => fs.doc(p).set(o),
    /* Grava só os campos informados (D4): duas pessoas mexendo em campos diferentes não se apagam,
       e funciona sem internet. Valores especiais: op.uniao([...]), op.remover([...]), op.apagar(). */
    patch: (p, campos) => fs.doc(p).set(fsCampos(campos), { merge: true }),
    /* Várias gravações juntas: ou entram todas, ou nenhuma (também sem internet, ficam na fila juntas).
       ops = [{tipo:'set'|'patch'|'del', p, o}] */
    lote: ops => {
      const b = fs.batch();
      ops.forEach(x => {
        const d = fs.doc(x.p);
        if (x.tipo === 'del') b.delete(d);
        else if (x.tipo === 'patch') b.set(d, fsCampos(x.o), { merge: true });
        else b.set(d, x.o);
      });
      return b.commit();
    },
    del: p => fs.doc(p).delete(),
    newId: () => fs.collection('_').doc().id,
  };
}
/* Converte os campos de patch para o Firestore. Chave com ponto ('jog.abc.j') vira mapa aninhado,
   para gravar só aquele pedaço da ficha. op.somar usa o incremento do próprio servidor (duas gravações ao mesmo tempo somam as duas). */
function fsCampos(campos) {
  const FV = firebase.firestore.FieldValue,
    o = {};
  for (const k in campos) {
    const v = campos[k],
      x =
        v && v.$op === 'uniao'
          ? FV.arrayUnion(...v.v)
          : v && v.$op === 'remover'
            ? FV.arrayRemove(...v.v)
            : v && v.$op === 'apagar'
              ? FV.delete()
              : v && v.$op === 'somar'
                ? FV.increment(v.n)
                : v;
    const ps = k.split('.');
    let a = o;
    for (let i = 0; i < ps.length - 1; i++) {
      if (typeof a[ps[i]] !== 'object' || a[ps[i]] === null) a[ps[i]] = {};
      a = a[ps[i]];
    }
    a[ps[ps.length - 1]] = x;
  }
  return o;
}
function fsQuery(fs, path, q) {
  let x = fs.collection(path);
  if (q.de) x = x.where(q.campo, '>=', q.de);
  if (q.ate) x = x.where(q.campo, '<=', q.ate);
  x = x.orderBy(q.campo, q.ordem || 'asc');
  return q.limite ? x.limit(q.limite) : x;
}
/* Operações especiais para patch(). */
const op = {
  uniao: v => ({ $op: 'uniao', v }),
  remover: v => ({ $op: 'remover', v }),
  apagar: () => ({ $op: 'apagar' }),
  somar: n => ({ $op: 'somar', n }),
};
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* Modo demonstração: recusa o que o Firestore recusaria (lista dentro de lista, KAN-167), para os testes pegarem. */
function recusarComoFirestore(o) {
  // Nos testes, window.__falharGravacao simula o banco recusando uma gravação (KAN-170).
  if (window.__falharGravacao) throw new Error('teste: gravação recusada');
  if (o && temListaDentroDeLista(o)) throw new Error('firestore: nested-arrays');
}
function LocalBackend() {
  const K = 'pelada-demo-v2';
  let store = {},
    user = null;
  try {
    store = JSON.parse(localStorage.getItem(K) || '{}');
    user = JSON.parse(localStorage.getItem(K + '-u') || 'null');
  } catch (e) {}
  const subs = new Set(),
    acb = new Set();
  const save = () => {
    try {
      localStorage.setItem(K, JSON.stringify(store));
    } catch (e) {}
  };
  const read = path => {
    const n = path.split('/').length;
    if (n % 2) {
      const o = {};
      for (const p in store) {
        const s = p.split('/');
        if (s.length === n + 1 && p.startsWith(path + '/') && idOk(s[n])) o[s[n]] = doBanco(store[p]);
      }
      return o;
    }
    return doBanco(store[path] ?? null);
  };
  const notify = () => subs.forEach(s => s.cb(cl(read(s.path))));
  const filtrar = (path, q) => {
    let e = Object.entries(read(path)).filter(
      ([, d]) => d && d[q.campo] != null && (!q.de || d[q.campo] >= q.de) && (!q.ate || d[q.campo] <= q.ate)
    );
    e.sort((x, y) => String(x[1][q.campo]).localeCompare(String(y[1][q.campo])) * (q.ordem === 'desc' ? -1 : 1));
    return q.limite ? e.slice(0, q.limite) : e;
  };
  /* patch no modo demonstração: mesmas regras do Firestore (chave com ponto = campo aninhado). */
  const aplicarLocal = (p, campos) => {
    const d = cl(store[p]) || {};
    for (const k in campos) {
      const v = campos[k],
        ps = k.split('.'),
        f = ps.pop();
      let a = d;
      for (const x of ps) {
        if (typeof a[x] !== 'object' || a[x] === null) a[x] = {};
        a = a[x];
      }
      if (v && v.$op === 'uniao') {
        a[f] = (a[f] || []).concat(v.v.filter(x => !(a[f] || []).some(y => igual(x, y))));
      } else if (v && v.$op === 'remover') {
        a[f] = (a[f] || []).filter(y => !v.v.some(x => igual(x, y)));
      } else if (v && v.$op === 'apagar') delete a[f];
      else if (v && v.$op === 'somar') a[f] = (a[f] || 0) + v.n;
      else a[f] = cl(v);
    }
    store[p] = d;
  };
  const setU = u => {
    user = u;
    try {
      localStorage.setItem(K + '-u', JSON.stringify(u));
    } catch (e) {}
    acb.forEach(f => f(u));
  };
  /* Demonstração: lembra as contas já usadas neste navegador, para o Google saber se a conta é nova (KAN-142). */
  const CT = K + '-contas',
    contas = () => {
      try {
        return JSON.parse(localStorage.getItem(CT) || '[]');
      } catch (x) {
        return [];
      }
    };
  const lembrar = e => {
    try {
      const c = contas();
      if (!c.includes(e)) {
        c.push(e);
        localStorage.setItem(CT, JSON.stringify(c));
      }
    } catch (x) {}
  };
  const lg = async (e, p) => {
    if (!e || !p) throw { code: 'auth/invalid-credential' };
    lembrar(e.toLowerCase());
    setU({
      uid: 'u-' + e.toLowerCase().replace(/[^a-z0-9]/g, ''),
      email: e.toLowerCase(),
      verificado: true,
      anon: false,
      via: p === 'google' ? 'google' : 'senha',
    });
  };
  return {
    demo: true,
    onAuth(cb) {
      acb.add(cb);
      setTimeout(() => cb(user), 0);
    },
    login: lg,
    signup: lg,
    reset: async () => {},
    logout: async () => {
      setU(null);
      return true;
    },
    semPendencias: async () => !window.__demoPendente,
    google: async hint => {
      await sleep(500);
      const e = /\S+@\S+\.\S+/.test(hint || '') ? hint : 'organizador.teste@gmail.com',
        novo = !contas().includes(e.toLowerCase());
      await lg(e, 'google');
      return { additionalUserInfo: { isNewUser: novo } };
    },
    redirectResult: async () => null,
    anon: async () => setU({ uid: 'anon-' + uid(), email: null, anon: true }),
    sub(path, cb) {
      const s = { path, cb };
      subs.add(s);
      setTimeout(() => cb(cl(read(path))), 0);
      return () => subs.delete(s);
    },
    query(path, q, cb) {
      const run = () => cb(cl(Object.fromEntries(filtrar(path, q))));
      const s = { path, cb: run };
      subs.add(s);
      setTimeout(run, 0);
      return () => subs.delete(s);
    },
    async pagina(path, q, cursor) {
      const todos = filtrar(path, Object.assign({}, q, { limite: 0 })),
        ini = cursor || 0,
        itens = todos.slice(ini, ini + q.limite);
      await sleep(150);
      return { itens: cl(itens), cursor: ini + itens.length, fim: ini + itens.length >= todos.length };
    },
    async get(path) {
      await sleep(100);
      return cl(read(path));
    },
    async getServidor(path) {
      await sleep(100);
      return cl(read(path));
    },
    set: async (p, o) => {
      recusarComoFirestore(o);
      store[p] = cl(o);
      save();
      notify();
      await sleep(250);
    },
    patch: async (p, campos) => {
      recusarComoFirestore(campos);
      aplicarLocal(p, campos);
      save();
      notify();
      await sleep(250);
    },
    lote: async ops => {
      ops.forEach(x => recusarComoFirestore(x.o));
      ops.forEach(x => {
        if (x.tipo === 'del') delete store[x.p];
        else if (x.tipo === 'patch') aplicarLocal(x.p, x.o);
        else store[x.p] = cl(x.o);
      });
      save();
      notify();
      await sleep(250);
    },
    del: async p => {
      delete store[p];
      save();
      notify();
      await sleep(250);
    },
    newId: uid,
  };
}
let B = null;
let CAP = null;
function track(pr) {
  if (CAP && pr && pr.then) CAP.push(pr);
  return pr;
}
function wrapBackend(b) {
  /* Lista dentro de lista vira { __lista } antes de gravar, nos dois bancos (KAN-167; nucleo/dados-banco.ts). */
  const set = b.set,
    patch = b.patch,
    lote = b.lote;
  /* Erro na hora de montar a gravação (ex.: dado que o banco não aceita) vira promessa recusada, para o aviso
     "Não foi possível salvar" aparecer (w, em nucleo/estado.js) em vez de a gravação sumir em silêncio (KAN-170). */
  const seguro = f => {
    try {
      return Promise.resolve(f());
    } catch (e) {
      return Promise.reject(e);
    }
  };
  b.set = (p, o) => seguro(() => set.call(b, p, paraBanco(o)));
  b.patch = (p, c) => seguro(() => patch.call(b, p, paraBanco(c)));
  b.lote = ops =>
    seguro(() =>
      lote.call(
        b,
        ops.map(x => (x.o ? Object.assign({}, x, { o: paraBanco(x.o) }) : x))
      )
    );
  ['set', 'patch', 'lote', 'del', 'login', 'signup', 'reset', 'logout', 'google'].forEach(k => {
    const f = b[k];
    b[k] = (...a) => track(f.apply(b, a));
  });
  return b;
}
const BUSY = new Map();
const busyKey = el => [el.dataset.a, el.dataset.v, el.dataset.p, el.dataset.i, el.dataset.c2].join('|');
function setBusy(el, on) {
  if (!el) return;
  if (el.dataset && el.dataset.a) {
    const k = busyKey(el);
    if (on) BUSY.set(k, (BUSY.get(k) || 0) + 1);
    else {
      const n = (BUSY.get(k) || 1) - 1;
      n > 0 ? BUSY.set(k, n) : BUSY.delete(k);
    }
  }
  el.classList.toggle('busy', on);
  el.setAttribute('aria-busy', on ? 'true' : 'false');
}
function applyBusy() {
  document.querySelectorAll('[data-a]').forEach(el => {
    const on = BUSY.has(busyKey(el));
    if (on !== el.classList.contains('busy')) {
      el.classList.toggle('busy', on);
      el.setAttribute('aria-busy', on ? 'true' : 'false');
    }
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* Alteradas por outros módulos (o import de um módulo ES é só leitura). */
function setB(v) {
  B = v;
}
function setCAP(v) {
  CAP = v;
}

export { B, CAP, FirebaseBackend, LocalBackend, applyBusy, op, setB, setBusy, setCAP, sleep, wrapBackend };
