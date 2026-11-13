/* KAN-242: funções dos avisos no EMULADOR do Firebase (Firestore + funções). Roda na automação "Testes do app"
   (tarefa "funcoes"), com:
   npx firebase emulators:exec --only functions,firestore --project demo-nosso-jogo "node --test testes/funcoes/*.test.mjs"
   No emulador a função não manda para o celular: grava o aviso em avisosTeste, que o teste confere. */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { aoResponder, cabeNoTeto, verificarFaltas } from '../../funcoes/src/logica.ts';

const req = createRequire(new URL('../../funcoes/package.json', import.meta.url));
const { initializeApp } = req('firebase-admin/app');
const { getFirestore } = req('firebase-admin/firestore');

initializeApp({ projectId: 'demo-nosso-jogo' });
const db = getFirestore();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function avisosDe(tag, ms = 20000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    const q = await db.collection('avisosTeste').where('tag', '==', tag).get();
    if (q.size) return q.docs.map(d => d.data());
    await sleep(500);
  }
  return [];
}

const G = 'gTeste';
before(async () => {
  await db.doc('grupos/' + G).set({
    name: 'Pelada de sexta',
    owner: 'dono',
    cfg: { fuso: 'America/Sao_Paulo', minPos: { _total: 4, GOL: 1 }, fixos: [] },
  });
  await db.doc('grupos/' + G + '/membros/dono').set({ uid: 'dono', role: 'owner' });
  await db.doc('grupos/' + G + '/membros/conv').set({ uid: 'conv', role: 'admin' });
  await db.doc('avisos/' + G + '_dono').set({ gid: G, uid: 'dono', ligado: true });
  await db.doc('avisos/' + G + '_conv').set({ gid: G, uid: 'conv', ligado: false });
  await db.doc('usuarios/dono/aparelhos/cel1').set({ token: 'token-dono', lang: 'pt-BR' });
  await db.doc('usuarios/dono/aparelhos/velho').set({ token: 'token-invalido', lang: 'pt-BR' });
  await db.doc('usuarios/conv/aparelhos/cel2').set({ token: 'token-conv', lang: 'en' });
  await db.doc('grupos/' + G + '/jogadores/j1').set({ name: 'João', pos: 'DEF' });
  await db.doc('grupos/' + G + '/rodadas/r1').set({ date: '2026-11-13', time: '20:00' });
});

test('CT-KAN-242-07: resposta pelo link avisa só quem ligou; token que não vale mais é apagado', async () => {
  await db.doc('grupos/' + G + '/rodadas/r1/presencas/j1').set({ s: 'in', t: 1, by: 'anonimo1', dev: 'anonimo1' });
  const av = await avisosDe('r-r1-j1');
  assert.equal(av.length, 2, 'dois celulares do dono (o convidado não ligou)');
  assert.ok(av.every(a => a.titulo === '✅ João vai'));
  assert.ok(av.every(a => /^Pelada de sexta · sex, 13\/11 · 1 confirmado$/.test(a.corpo)));
  assert.ok(av.every(a => a.link === './#/g/gTeste/r/r1'));
  assert.ok(!av.some(a => a.token === 'token-conv'));
  await sleep(1000);
  assert.equal((await db.doc('usuarios/dono/aparelhos/velho').get()).exists, false);
});

test('CT-KAN-242-08: troca pelo link avisa; gravação de administrador e repetição não avisam', async () => {
  await db.doc('grupos/' + G + '/rodadas/r1/presencas/j1').set({ s: 'out', t: 2, by: 'anonimo1', dev: 'anonimo1' });
  const fim = Date.now() + 20000;
  let titulos = [];
  while (Date.now() < fim && !titulos.includes('⚠️ João desistiu')) {
    titulos = (await avisosDe('r-r1-j1')).map(a => a.titulo);
    await sleep(500);
  }
  assert.ok(titulos.includes('⚠️ João desistiu'));
  /* Pela lógica direto (sem esperar o gatilho): administrador e mesma resposta. */
  const nada = async () => [];
  assert.equal(
    await aoResponder(db, { gid: G, rid: 'r1', pid: 'j1' }, { s: 'out' }, { s: 'in', by: 'conv' }, nada),
    'administrador'
  );
  assert.equal(
    await aoResponder(db, { gid: G, rid: 'r1', pid: 'j1' }, { s: 'out' }, { s: 'out', by: 'x' }, nada),
    'sem-mudanca'
  );
});

test('CT-KAN-242-09: faltam pessoas na janela: avisa uma vez por rodada; administrador removido não recebe', async () => {
  const agora = Date.UTC(2026, 10, 13, 20, 30); // 17h30 em São Paulo; jogo às 20h00 (2h30 depois)
  const enviados = [];
  const enviar = async ms => {
    enviados.push(...ms);
    return ms.map(() => false);
  };
  await db.doc('grupos/' + G + '/rodadas/r1/presencas/a1').set({ s: 'in', t: 3, by: 'x', nome: 'Rafa', pos: 'GOL' });
  let feitos = await verificarFaltas(db, enviar, agora);
  assert.deepEqual(feitos, [G + '/r1']);
  assert.equal(enviados.length, 1, 'só o celular do dono (o token velho foi apagado)');
  assert.equal(enviados[0].titulo, '⏰ Faltam 3 para o mínimo');
  assert.match(enviados[0].corpo, /1 de 4 confirmados$/);
  feitos = await verificarFaltas(db, enviar, agora + 15 * 60e3);
  assert.deepEqual(feitos, [], 'não repete na mesma rodada');
  /* 4h antes ainda não é hora (padrão 3h); com 5h no grupo, entra. */
  await db.doc('grupos/' + G + '/rodadas/r2').set({ date: '2026-11-13', time: '22:00' });
  assert.deepEqual(await verificarFaltas(db, enviar, agora), []);
  await db.doc('grupos/' + G + '/privado/avisos').set({ horas: 5 });
  await db.doc('grupos/' + G + '/membros/dono').delete();
  assert.deepEqual(await verificarFaltas(db, enviar, agora), [], 'sem administrador com aviso ligado, não marca');
  await db.doc('grupos/' + G + '/membros/dono').set({ uid: 'dono', role: 'owner' });
  assert.deepEqual(await verificarFaltas(db, enviar, agora), [G + '/r2']);
});

test('CT-KAN-242-10: teto do mês: passou do limite, não envia', async () => {
  const ms = Date.UTC(2027, 0, 5);
  assert.equal(await cabeNoTeto(db, 3, ms, 4), true);
  assert.equal(await cabeNoTeto(db, 2, ms, 4), false);
  assert.equal(await cabeNoTeto(db, 1, ms, 4), true);
  assert.equal(await cabeNoTeto(db, 1, Date.UTC(2027, 1, 1), 4), true, 'mês novo zera');
});
