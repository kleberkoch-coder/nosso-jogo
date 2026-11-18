/* Regras do Firebase Storage (KAN-273, pelada-v118): logotipo do grupo. Roda no emulador junto com as do Firestore
   (as regras do Storage leem os administradores no Firestore), na tarefa "regras-firebase":
     npx firebase emulators:exec --only firestore,storage --project demo-nosso-jogo "node --test --test-concurrency=1 testes/regras-firebase/*.test.mjs" */
import { after, before, beforeEach, describe, test } from 'node:test';
import fs from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

let env;
const G = 'grupos/g1';
const senha = { firebase: { sign_in_provider: 'password' } };
const BALDE = 'gs://demo-nosso-jogo.appspot.com';
const st = uid =>
  (uid === 'anon'
    ? env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } })
    : uid
      ? env.authenticatedContext(uid, senha)
      : env.unauthenticatedContext()
  ).storage(BALDE);
const img = (n = 2000) => new Uint8Array(n).fill(7);
const WEBP = { contentType: 'image/webp' };
const subir = (uid, nome, dados = img(), meta = WEBP) =>
  st(uid)
    .ref(G + '/' + nome)
    .put(dados, meta);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-nosso-jogo',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
    storage: { rules: fs.readFileSync('storage.rules', 'utf8') },
  });
});
after(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore(),
      s = (p, o) => setDoc(doc(f, p), o);
    await s(G, { name: 'G1', owner: 'dono', ativo: true, createdAt: 1 });
    await s(G + '/membros/dono', { uid: 'dono', role: 'owner' });
    await s(G + '/membros/adm', { uid: 'adm', role: 'admin' }); // sem permissões gravadas (antes da v69): pode tudo
    await s(G + '/membros/conv', { uid: 'conv', role: 'admin', perm: { config: false, elenco: true } });
    await s(G + '/membros/cfg', { uid: 'cfg', role: 'admin', perm: { config: true } });
    await s('grupos/g2', { name: 'G2', owner: 'outro', ativo: true, createdAt: 1 });
    await s('grupos/g2/membros/outro', { uid: 'outro', role: 'owner' });
    await ctx
      .storage(BALDE)
      .ref(G + '/logo-1731600000000.webp')
      .put(img(), WEBP);
  });
});

describe('logotipo do grupo no Storage (KAN-273)', () => {
  test('CT-KAN-273-01: qualquer um lê o logotipo (link do jogador e da votação, sem conta)', async () => {
    await assertSucceeds(
      st(null)
        .ref(G + '/logo-1731600000000.webp')
        .getMetadata()
    );
    await assertSucceeds(
      st('anon')
        .ref(G + '/logo-1731600000000.webp')
        .getMetadata()
    );
  });
  test('CT-KAN-273-02: organizador e administrador com Configurações gravam; sem a permissão, não', async () => {
    await assertSucceeds(subir('dono', 'logo-1731600000001.webp'));
    await assertSucceeds(subir('cfg', 'logo-1731600000002.jpg', img(), { contentType: 'image/jpeg' }));
    await assertSucceeds(subir('adm', 'logo-1731600000003.webp'));
    await assertFails(subir('conv', 'logo-1731600000004.webp'));
    await assertFails(subir('outro', 'logo-1731600000005.webp'));
    await assertFails(subir('anon', 'logo-1731600000006.webp'));
    await assertFails(subir(null, 'logo-1731600000007.webp'));
  });
  test('CT-KAN-273-03: só imagem WebP ou JPEG, até 300 KB, com nome de logotipo e sem gravar por cima', async () => {
    await assertFails(subir('dono', 'logo-1731600000008.webp', img(), { contentType: 'image/svg+xml' }));
    await assertFails(subir('dono', 'logo-1731600000009.webp', img(310 * 1024)));
    await assertFails(subir('dono', 'outro-arquivo.webp'));
    await assertFails(subir('dono', 'logo-1731600000000.webp'));
    await assertFails(st('dono').ref('grupos/g1/sub/logo-1731600000010.webp').put(img(), WEBP));
  });
  test('CT-KAN-273-04: apagar só quem pode gravar; grupo bloqueado não grava', async () => {
    await assertFails(
      st('conv')
        .ref(G + '/logo-1731600000000.webp')
        .delete()
    );
    await assertSucceeds(
      st('cfg')
        .ref(G + '/logo-1731600000000.webp')
        .delete()
    );
    await env.withSecurityRulesDisabled(ctx =>
      setDoc(doc(ctx.firestore(), G), { name: 'G1', owner: 'dono', ativo: true, createdAt: 1, bloq: true })
    );
    await assertFails(subir('dono', 'logo-1731600000011.webp'));
  });
});
