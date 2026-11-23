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

describe('logotipo: quem só vê e conta bloqueada (KAN-281)', () => {
  const grupoCom = o =>
    env.withSecurityRulesDisabled(ctx =>
      setDoc(doc(ctx.firestore(), G), Object.assign({ name: 'G1', owner: 'dono', ativo: true, createdAt: 1 }, o))
    );
  test('CT-KAN-281-01: convidado com Configurações além do limite do plano não envia nem apaga', async () => {
    /* Grátis (1 convidado): cfg é o 2º da lista, só vê. */
    await grupoCom({ adms: ['adm', 'cfg'], pl: { id: 'gratis', ate: null } });
    await assertFails(subir('cfg', 'logo-1731600000020.webp'));
    await assertFails(
      st('cfg')
        .ref(G + '/logo-1731600000000.webp')
        .delete()
    );
    await assertSucceeds(subir('adm', 'logo-1731600000021.webp'), 'o 1º da lista, dentro do limite');
    /* Plano A (2 convidados), válido: cfg volta a poder. */
    await grupoCom({ adms: ['adm', 'cfg'], pl: { id: 'A', ate: Date.now() + 864e5 } });
    await assertSucceeds(subir('cfg', 'logo-1731600000022.webp'));
    /* Plano A vencido: volta ao limite do Grátis. */
    await grupoCom({ adms: ['adm', 'cfg'], pl: { id: 'A', ate: Date.now() - 864e5 } });
    await assertFails(subir('cfg', 'logo-1731600000023.webp'));
  });
  test('CT-KAN-281-02: conta bloqueada (cadastro marcado pelo portal) não envia nem apaga', async () => {
    await env.withSecurityRulesDisabled(ctx =>
      setDoc(doc(ctx.firestore(), G + '/membros/cfg'), {
        uid: 'cfg',
        role: 'admin',
        perm: { config: true },
        bloq: true,
      })
    );
    await assertFails(subir('cfg', 'logo-1731600000024.webp'));
    await assertFails(
      st('cfg')
        .ref(G + '/logo-1731600000000.webp')
        .delete()
    );
  });
  test('CT-KAN-281-03: organizador e convidado dentro do limite continuam trocando o logotipo', async () => {
    await grupoCom({ adms: ['cfg'], pl: { id: 'gratis', ate: null } });
    await assertSucceeds(subir('dono', 'logo-1731600000025.webp'));
    await assertSucceeds(subir('cfg', 'logo-1731600000026.webp'));
    await assertSucceeds(
      st('cfg')
        .ref(G + '/logo-1731600000000.webp')
        .delete()
    );
  });
});

describe('foto do jogador no Storage (KAN-293)', () => {
  const F = G + '/jogadores/p1/';
  const subirFoto = (uid, nome, dados = img(), meta = WEBP) =>
    st(uid)
      .ref(F + nome)
      .put(dados, meta);
  test('CT-KAN-293-09: qualquer um lê a foto (o card vai aparecer no link); só nomes de foto', async () => {
    await env.withSecurityRulesDisabled(ctx =>
      ctx
        .storage(BALDE)
        .ref(F + 'foto-1732370000000.webp')
        .put(img(), WEBP)
    );
    await assertSucceeds(
      st(null)
        .ref(F + 'foto-1732370000000.webp')
        .getMetadata()
    );
    await assertSucceeds(
      st('anon')
        .ref(F + 'foto-1732370000000.webp')
        .getMetadata()
    );
  });
  test('CT-KAN-293-03: organizador e administrador com Elenco gravam; sem Elenco, anônimo ou de fora, não', async () => {
    await assertSucceeds(subirFoto('dono', 'foto-1732370000001.webp'));
    await assertSucceeds(subirFoto('conv', 'foto-1732370000002.png', img(), { contentType: 'image/png' }));
    await assertSucceeds(subirFoto('adm', 'foto-1732370000003.jpg', img(), { contentType: 'image/jpeg' }));
    await assertFails(subirFoto('cfg', 'foto-1732370000004.webp'));
    await assertFails(subirFoto('outro', 'foto-1732370000005.webp'));
    await assertFails(subirFoto('anon', 'foto-1732370000006.webp'));
    await assertFails(subirFoto(null, 'foto-1732370000007.webp'));
  });
  test('CT-KAN-293-10: só WebP, PNG ou JPEG até 600 KB, com nome de foto e sem gravar por cima', async () => {
    await assertFails(subirFoto('dono', 'foto-1732370000008.webp', img(), { contentType: 'image/gif' }));
    await assertFails(subirFoto('dono', 'foto-1732370000009.webp', img(610 * 1024)));
    await assertSucceeds(subirFoto('dono', 'foto-1732370000010.png', img(500 * 1024), { contentType: 'image/png' }));
    await assertFails(subirFoto('dono', 'logo-1732370000011.webp'));
    await assertFails(subirFoto('dono', 'foto-1732370000010.png', img(), { contentType: 'image/png' }));
    await assertFails(
      st('dono')
        .ref(F + 'sub/foto-1732370000012.webp')
        .put(img(), WEBP)
    );
  });
  test('CT-KAN-293-04: apagar só com Elenco; grupo bloqueado não grava', async () => {
    await env.withSecurityRulesDisabled(ctx =>
      ctx
        .storage(BALDE)
        .ref(F + 'foto-1732370000000.webp')
        .put(img(), WEBP)
    );
    await assertFails(
      st('cfg')
        .ref(F + 'foto-1732370000000.webp')
        .delete()
    );
    await assertSucceeds(
      st('conv')
        .ref(F + 'foto-1732370000000.webp')
        .delete()
    );
    await env.withSecurityRulesDisabled(ctx =>
      setDoc(doc(ctx.firestore(), G), { name: 'G1', owner: 'dono', ativo: true, createdAt: 1, bloq: true })
    );
    await assertFails(subirFoto('dono', 'foto-1732370000013.webp'));
  });
});

describe('imagem de fundo dos cards no Storage (KAN-294, fase 2)', () => {
  const C = G + '/cards/';
  const comPlano = pl =>
    env.withSecurityRulesDisabled(ctx =>
      setDoc(doc(ctx.firestore(), G), { name: 'G1', owner: 'dono', ativo: true, createdAt: 1, pl })
    );
  const subirFundo = (uid, nome, dados = img(), meta = WEBP) =>
    st(uid)
      .ref(C + nome)
      .put(dados, meta);
  test('CT-KAN-294-13: com o Plano A, organizador e quem tem Configurações gravam; sem Configurações, anônimo ou de fora, não', async () => {
    await comPlano({ id: 'A', ate: Date.now() + 864e5 });
    await assertSucceeds(subirFundo('dono', 'fundo-1732370000001.webp'));
    await assertSucceeds(subirFundo('cfg', 'fundo-1732370000002.jpg', img(), { contentType: 'image/jpeg' }));
    await assertFails(subirFundo('conv', 'fundo-1732370000003.webp'));
    await assertFails(subirFundo('outro', 'fundo-1732370000004.webp'));
    await assertFails(subirFundo('anon', 'fundo-1732370000005.webp'));
    await assertSucceeds(
      st(null)
        .ref(C + 'fundo-1732370000001.webp')
        .getMetadata()
    );
  });
  test('CT-KAN-294-14: no Grátis ou com o plano vencido, não grava; tamanho, tipo e nome conferidos; sem gravar por cima', async () => {
    await comPlano({ id: 'gratis', ate: null });
    await assertFails(subirFundo('dono', 'fundo-1732370000006.webp'));
    await comPlano({ id: 'A', ate: Date.now() - 864e5 });
    await assertFails(subirFundo('dono', 'fundo-1732370000007.webp'));
    await comPlano({ id: 'B', ate: null });
    await assertFails(subirFundo('dono', 'fundo-1732370000008.webp', img(910 * 1024)));
    await assertFails(subirFundo('dono', 'fundo-1732370000009.webp', img(), { contentType: 'image/gif' }));
    await assertFails(subirFundo('dono', 'outro-1732370000010.webp'));
    await assertSucceeds(subirFundo('dono', 'fundo-1732370000011.webp'));
    await assertFails(subirFundo('dono', 'fundo-1732370000011.webp'));
  });
});
