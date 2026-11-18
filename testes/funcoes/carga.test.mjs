/* KAN-275: teste de carga das funções dos avisos no EMULADOR do Firebase (nunca toca nos dados reais). Roda na tarefa
   "funcoes" depois de avisos.test.mjs (--test-concurrency=1). Mede:
   - a rotina de 15 minutos com 1.000 grupos com aviso ligado: tempo e quantos grupos avaliou;
   - 50 respostas pelo link em 10 s no mesmo grupo: todos os avisos saem, sem erro de transação, e quantas leituras
     cada resposta faz.
   O resultado vai para a saída (linha "Carga das funções: …"), que a tarefa mostra no resumo. */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { aoResponder, verificarAvisos } from '../../funcoes/src/logica.ts';

const req = createRequire(new URL('../../funcoes/package.json', import.meta.url));
const { initializeApp, getApps } = req('firebase-admin/app');
const { getFirestore } = req('firebase-admin/firestore');

if (!getApps().length) initializeApp({ projectId: 'demo-nosso-jogo' });
const db = getFirestore();
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Conta as leituras: cada documento lido conta 1; consulta conta os documentos que voltaram (no mínimo 1); contagem
   (count) conta 1, como o Firestore cobra. */
function contador(base) {
  const n = { leituras: 0 };
  const ref = r => ({
    id: r.id,
    get: async () => (n.leituras++, r.get()),
    set: (d, o) => r.set(d, o),
    delete: () => r.delete(),
    collection: c => consulta(r.collection(c)),
    _r: r,
  });
  const consulta = q => ({
    where: (a, b, c) => consulta(q.where(a, b, c)),
    get: async () => {
      const s = await q.get();
      n.leituras += Math.max(1, s.size);
      return s;
    },
    count: () => ({ get: async () => (n.leituras++, q.count().get()) }),
    doc: id => ref(q.doc(id)),
  });
  const db2 = {
    doc: p => ref(base.doc(p)),
    collection: p => consulta(base.collection(p)),
    runTransaction: f =>
      base.runTransaction(t =>
        f({
          get: async r => (n.leituras++, t.get(r._r || r)),
          set: (r, d) => t.set(r._r || r, d),
        })
      ),
  };
  return { db: db2, n };
}

const N = 1000;
before(async () => {
  /* 1.000 grupos com mínimo e um administrador com aviso ligado, sem rodada na janela (o caso comum da rotina). */
  for (let i = 0; i < N; i += 250) {
    const b = db.batch();
    for (let k = i; k < Math.min(N, i + 250); k++) {
      const g = 'carga' + k;
      b.set(db.doc('grupos/' + g), { name: 'Carga ' + k, owner: 'u' + k, cfg: { minPos: { _total: 10 } } });
      b.set(db.doc('avisos/' + g + '_u' + k), { gid: g, uid: 'u' + k, ligado: true });
    }
    await b.commit();
  }
});

test('CT-KAN-275-01: a rotina de 15 minutos avalia 1.000 grupos em menos de 30 s', async () => {
  const { db: d2, n } = contador(db);
  const t0 = Date.now();
  const r = await verificarAvisos(d2, async ms => ms.map(() => 'ok'), Date.UTC(2027, 6, 1, 3));
  const s = (Date.now() - t0) / 1000;
  console.log(`Carga das funções: rotina com ${r.grupos} grupos em ${s.toFixed(1)} s, ${n.leituras} leituras`);
  assert.ok(r.grupos >= N, `avaliou ${r.grupos} grupos`);
  assert.equal(r.cortada, false);
  assert.ok(s < 30, `levou ${s.toFixed(1)} s`);
});

test('CT-KAN-275-02: 50 respostas pelo link em 10 s no mesmo grupo: todos os avisos, sem erro, até 12 leituras cada', async () => {
  const G = 'cargaLink';
  await db.doc('grupos/' + G).set({ name: 'Carga link', owner: 'dono', cfg: {} });
  await db.doc('grupos/' + G + '/membros/dono').set({ uid: 'dono', role: 'owner' });
  await db.doc('avisos/' + G + '_dono').set({ gid: G, uid: 'dono', ligado: true });
  await db.doc('usuarios/dono/aparelhos/celcarga').set({ token: 'token-carga', lang: 'pt-BR' });
  await db.doc('grupos/' + G + '/rodadas/rc').set({ date: '2027-07-02', time: '20:00' });
  const enviados = [],
    leituras = [],
    erros = [];
  const enviar = async ms => (enviados.push(...ms), ms.map(() => 'ok'));
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: 50 }, async (_, i) => {
      await sleep(i * 200); // 50 em 10 s
      const pid = 'p' + i;
      await db
        .doc('grupos/' + G + '/rodadas/rc/presencas/' + pid)
        .set({ s: 'in', t: i, by: 'anon' + i, nome: 'Jog ' + i });
      const { db: d2, n } = contador(db);
      try {
        const r = await aoResponder(
          d2,
          { gid: G, rid: 'rc', pid },
          null,
          { s: 'in', by: 'anon' + i, nome: 'Jog ' + i },
          enviar,
          Date.UTC(2027, 6, 2, 15)
        );
        if (r !== 'enviados:1') erros.push(r);
      } catch (e) {
        erros.push(String(e && e.message));
      }
      leituras.push(n.leituras);
    })
  );
  const s = (Date.now() - t0) / 1000,
    max = Math.max(...leituras);
  console.log(
    `Carga das funções: 50 respostas em ${s.toFixed(1)} s, ${enviados.length} avisos, até ${max} leituras cada`
  );
  assert.deepEqual(erros, []);
  assert.equal(enviados.length, 50);
  assert.ok(max <= 12, `leituras por resposta: até ${max}`);
});
