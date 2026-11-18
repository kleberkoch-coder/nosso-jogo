/* KAN-242: funções dos avisos no EMULADOR do Firebase (Firestore + funções). Roda na automação "Testes do app"
   (tarefa "funcoes"), com:
   npx firebase emulators:exec --only functions,firestore --project demo-nosso-jogo "node --test testes/funcoes/*.test.mjs"
   No emulador a função não manda para o celular: grava o aviso em avisosTeste, que o teste confere. */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  LIMITE_GRUPO_DIA,
  LIMITE_MES,
  PARTES,
  aoResponder,
  cabeNoGrupo,
  cabeNoMes,
  verificarAvisos,
  verificarFaltas,
} from '../../funcoes/src/logica.ts';

const req = createRequire(new URL('../../funcoes/package.json', import.meta.url));
const { initializeApp } = req('firebase-admin/app');
const { FieldValue, getFirestore } = req('firebase-admin/firestore');

initializeApp({ projectId: 'demo-nosso-jogo' });
/* somar: o mesmo que as funções passam (index.ts). */
const somar = n => FieldValue.increment(n);
const db = new Proxy(getFirestore(), {
  get: (f, k) => (k === 'somar' ? somar : typeof f[k] === 'function' ? f[k].bind(f) : f[k]),
});
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
  /* KAN-279: a troca logo depois da primeira resposta fica no freio (no máximo 1 aviso da mesma pessoa a cada 10 min) e
     a rotina manda a resposta mais recente depois do intervalo. */
  await db.doc('grupos/' + G + '/rodadas/r1/presencas/j1').set({ s: 'out', t: 2, by: 'anonimo1', dev: 'anonimo1' });
  await sleep(4000);
  assert.ok(!(await avisosDe('r-r1-j1', 1000)).some(a => a.titulo === '⚠️ João desistiu'), 'a troca ficou no freio');
  const guardados = [];
  const r = await verificarAvisos(db, async ms => (guardados.push(...ms), ms.map(() => 'ok')), Date.now() + 11 * 60e3, {
    faltas: false,
    niver: false,
  });
  assert.ok(r.guardadas.includes(G + '/r1/j1'), 'CT-KAN-279-01: a rotina manda a resposta guardada');
  assert.ok(guardados.length >= 1 && guardados.every(a => a.titulo === '⚠️ João desistiu' && a.tag === 'r-r1-j1'));
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
    return ms.map(() => 'ok');
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

test('CT-KAN-242-10: teto do mês (dividido em partes): passou do limite, não envia; mês novo zera', async () => {
  const ms = Date.UTC(2027, 0, 5);
  /* Limite 40 em 10 partes = 4 por parte. */
  assert.equal(await cabeNoMes(db, 3, ms, 40, 0), 'ok');
  assert.equal(await cabeNoMes(db, 2, ms, 40, 0), 'avisar', 'a primeira recusa avisa');
  assert.equal(await cabeNoMes(db, 2, ms, 40, 0), 'cheio', 'as seguintes, não');
  assert.equal(await cabeNoMes(db, 1, ms, 40, 0), 'ok');
  assert.equal(await cabeNoMes(db, 1, Date.UTC(2027, 1, 1), 40, 0), 'ok', 'mês novo zera');
  assert.equal(await cabeNoGrupo(db, 'gT', 4, ms, 4), 'ok');
  assert.equal(await cabeNoGrupo(db, 'gT', 1, ms, 4), 'avisar');
  assert.equal(await cabeNoGrupo(db, 'gT', 1, ms + 864e5, 4), 'ok', 'dia novo zera');
});

async function falhasAviso(trecho) {
  const q = await db.collection('falhas').where('t', '==', 'aviso').get();
  return q.docs.map(d => d.data()).filter(f => f.m.includes(trecho));
}

test('CT-KAN-242-12: falhas dos avisos vão para o banco de falhas (envio recusado e teto do mês), sem nada pessoal', async () => {
  const agora = Date.UTC(2026, 11, 10, 12);
  const comErro = async ms => ms.map((m, i) => (i === 0 ? 'messaging/internal-error' : 'ok'));
  const r = await aoResponder(
    db,
    { gid: G, rid: 'r1', pid: 'j1' },
    { s: 'in' },
    { s: 'out', by: 'anonimo9' },
    comErro,
    agora
  );
  assert.equal(r, 'enviados:0', 'o único celular deu erro');
  const f1 = await falhasAviso('Envio recusado pelo Firebase: messaging/internal-error');
  assert.equal(f1.length, 1);
  assert.equal(f1[0].g, G);
  assert.equal(f1[0].n, 1);
  assert.deepEqual(Object.keys(f1[0]).sort(), [
    'd',
    'disp',
    'em',
    'g',
    'inst',
    'lang',
    'm',
    'n',
    'nav',
    'r',
    'so',
    't',
    'v',
  ]);
  /* Teto: o mês já chegou no limite (todas as partes cheias); nada sai e a falha fica registrada uma vez só. */
  for (let k = 0; k < PARTES; k++)
    await db.doc('avisosEnviados/_teto_mes_' + k).set({ k: '2026-12', n: Math.ceil(LIMITE_MES / PARTES) });
  const nada = [];
  for (let i = 0; i < 3; i++)
    assert.equal(
      await aoResponder(
        db,
        { gid: G, rid: 'r1', pid: 'mes' + i },
        { s: i % 2 ? 'in' : 'out' },
        { s: i % 2 ? 'out' : 'in', by: 'anonimo9' },
        async ms => (nada.push(...ms), ms.map(() => 'ok')),
        agora
      ),
      'enviados:0'
    );
  assert.equal(nada.length, 0);
  assert.equal(
    (await falhasAviso('avisos no mês atingido')).length,
    1,
    'CT-KAN-275-04: uma falha só, mesmo com 3 tentativas'
  );
});

test('CT-KAN-275-03: grupo que passou do teto do dia para sozinho; os outros continuam; uma falha só', async () => {
  const agora = Date.UTC(2027, 4, 10, 15);
  await db.doc('avisosEnviados/_teto_' + G).set({ k: '2027-05-10', n: LIMITE_GRUPO_DIA });
  const H = 'gOutro';
  await db.doc('grupos/' + H).set({ name: 'Outro', owner: 'o2', cfg: {} });
  await db.doc('grupos/' + H + '/membros/o2').set({ uid: 'o2', role: 'owner' });
  await db.doc('avisos/' + H + '_o2').set({ gid: H, uid: 'o2', ligado: true });
  await db.doc('usuarios/o2/aparelhos/c9').set({ token: 'token-o2', lang: 'pt-BR' });
  await db.doc('grupos/' + H + '/jogadores/x1').set({ name: 'Xavier' });
  const env = [];
  const enviar = async ms => (env.push(...ms), ms.map(() => 'ok'));
  for (let i = 0; i < 3; i++)
    assert.equal(
      await aoResponder(
        db,
        { gid: G, rid: 'r1', pid: 'dia' + i },
        { s: i % 2 ? 'in' : 'out' },
        { s: i % 2 ? 'out' : 'in', by: 'z' },
        enviar,
        agora
      ),
      'enviados:0'
    );
  assert.equal(
    await aoResponder(db, { gid: H, rid: 'q1', pid: 'x1' }, null, { s: 'in', by: 'z' }, enviar, agora),
    'enviados:1'
  );
  assert.deepEqual(
    env.map(m => m.token),
    ['token-o2']
  );
  assert.equal((await falhasAviso('avisos no dia atingido neste grupo')).length, 1);
});

test('CT-KAN-272-04: aniversário às 9h no fuso do grupo, uma vez por dia, só do elenco ativo', async () => {
  const { verificarAniversarios } = await import('../../funcoes/src/logica.ts');
  const H = 'gNiver';
  await db.doc('grupos/' + H).set({ name: 'Pelada do Niver', owner: 'dono', cfg: { fuso: 'America/Sao_Paulo' } });
  await db.doc('grupos/' + H + '/membros/dono').set({ uid: 'dono', role: 'owner' });
  await db.doc('avisos/' + H + '_dono').set({ gid: H, uid: 'dono', ligado: true });
  await db.doc('grupos/' + H + '/jogadores/n1').set({ name: 'João', ativo: true });
  await db.doc('grupos/' + H + '/jogadores/n2').set({ name: 'Pedro', ativo: false });
  await db
    .doc('grupos/' + H + '/privado/contatos')
    .set({ n1: { tel: '', nasc: '1990-03-20' }, n2: { nasc: '1985-03-20' } });
  const enviados = [];
  const enviar = async ms => (enviados.push(...ms), ms.map(() => 'ok'));
  /* Em março de 2027 (o teste das falhas deixou dezembro de 2026 no teto). 8h30 em São Paulo (11h30 UTC): ainda não. */
  assert.deepEqual(await verificarAniversarios(db, enviar, Date.UTC(2027, 2, 20, 11, 30)), []);
  /* 9h15: avisa, uma vez. */
  assert.deepEqual(await verificarAniversarios(db, enviar, Date.UTC(2027, 2, 20, 12, 15)), [H + '/2027-03-20']);
  assert.deepEqual(await verificarAniversarios(db, enviar, Date.UTC(2027, 2, 20, 12, 30)), []);
  const meus = enviados.filter(m => m.tag === 'n-' + H + '-2027-03-20');
  assert.equal(meus.length, 1);
  assert.equal(meus[0].titulo, '🎂 Hoje é aniversário de João');
  assert.equal(meus[0].corpo, 'Pelada do Niver · mande os parabéns!');
});

test('CT-KAN-278-01 a 04: o aviso de aniversário só vai para quem tem Elenco; a resposta vai para todos', async () => {
  const H = 'gNiverPerm';
  await db.doc('grupos/' + H).set({ name: 'Niver FC', owner: 'org8', cfg: { fuso: 'America/Sao_Paulo' } });
  const adms = {
    org8: { role: 'owner' },
    antigo8: { role: 'admin' },
    sem8: { role: 'admin', perm: { caixa: false, notas: false, elenco: false, config: false } },
    com8: { role: 'admin', perm: { caixa: false, notas: false, elenco: true, config: false } },
  };
  for (const [u, m] of Object.entries(adms)) {
    await db.doc('grupos/' + H + '/membros/' + u).set(Object.assign({ uid: u }, m));
    await db.doc('avisos/' + H + '_' + u).set({ gid: H, uid: u, ligado: true });
    await db.doc('usuarios/' + u + '/aparelhos/c').set({ token: 'tk-' + u, lang: 'pt-BR' });
  }
  await db.doc('grupos/' + H + '/jogadores/b1').set({ name: 'Bia', ativo: true });
  await db.doc('grupos/' + H + '/privado/contatos').set({ b1: { nasc: '1992-04-15' } });
  const env = [];
  const enviar = async ms => (env.push(...ms), ms.map(() => 'ok'));
  const { verificarAniversarios } = await import('../../funcoes/src/logica.ts');
  assert.deepEqual(await verificarAniversarios(db, enviar, Date.UTC(2027, 3, 15, 12, 20)), [H + '/2027-04-15']);
  const niver = env
    .filter(m => m.tag === 'n-' + H + '-2027-04-15')
    .map(m => m.token)
    .sort();
  assert.deepEqual(
    niver,
    ['tk-antigo8', 'tk-com8', 'tk-org8'],
    'organizador, convidado de antes das permissões e convidado com Elenco; nunca o sem Elenco'
  );
  /* CT-KAN-278-04: a resposta pelo link continua indo para o convidado sem Elenco. */
  env.length = 0;
  assert.equal(
    await aoResponder(
      db,
      { gid: H, rid: 'q8', pid: 'b1' },
      null,
      { s: 'in', by: 'anon8' },
      enviar,
      Date.UTC(2027, 3, 15, 13)
    ),
    'enviados:4'
  );
  assert.ok(env.some(m => m.token === 'tk-sem8'));
});

test('CT-KAN-279-01: 20 trocas em 2 minutos: 1 aviso na hora e, depois do intervalo, só a resposta mais recente', async () => {
  const H = 'gFreio';
  await db.doc('grupos/' + H).set({ name: 'Freio FC', owner: 'org9', cfg: {} });
  await db.doc('grupos/' + H + '/membros/org9').set({ uid: 'org9', role: 'owner' });
  await db.doc('avisos/' + H + '_org9').set({ gid: H, uid: 'org9', ligado: true });
  await db.doc('usuarios/org9/aparelhos/c').set({ token: 'tk-org9', lang: 'pt-BR' });
  await db.doc('grupos/' + H + '/jogadores/z1').set({ name: 'Zeca' });
  const todos = [];
  const enviar = async ms => (todos.push(...ms), ms.map(() => 'ok'));
  const env = {
    get length() {
      return meus().length;
    },
  };
  const meus = () => todos.filter(m => m.tag === 'r-f1-z1');
  const t0 = Date.UTC(2027, 7, 10, 18);
  const rs = [];
  for (let i = 0; i < 20; i++) {
    const s = i % 2 ? 'out' : 'in',
      antes = i ? { s: i % 2 ? 'in' : 'out' } : null;
    rs.push(await aoResponder(db, { gid: H, rid: 'f1', pid: 'z1' }, antes, { s, by: 'anonZ' }, enviar, t0 + i * 6000));
  }
  assert.equal(rs[0], 'enviados:1');
  assert.ok(
    rs.slice(1).every(r => r === 'freio'),
    'as outras 19 ficam no freio'
  );
  assert.equal(env.length, 1, 'um aviso só no intervalo');
  /* Antes de 10 minutos, a rotina não manda; depois, manda a mais recente (a 20ª: "Não vou"), uma vez. */
  await verificarAvisos(db, enviar, t0 + 5 * 60e3, { faltas: false, niver: false });
  assert.equal(env.length, 1);
  await verificarAvisos(db, enviar, t0 + 11 * 60e3, { faltas: false, niver: false });
  assert.equal(env.length, 2);
  assert.equal(meus()[1].titulo, '⚠️ Zeca desistiu');
  await verificarAvisos(db, enviar, t0 + 30 * 60e3, { faltas: false, niver: false });
  assert.equal(env.length, 2, 'não manda de novo');
});

test('CT-KAN-279-02: teto das respostas esgotado não cala o aviso de faltam pessoas', async () => {
  const H = 'gTetoResp';
  await db.doc('grupos/' + H).set({
    name: 'Teto FC',
    owner: 'org10',
    cfg: { fuso: 'America/Sao_Paulo', minPos: { _total: 10 }, fixos: [] },
  });
  await db.doc('grupos/' + H + '/membros/org10').set({ uid: 'org10', role: 'owner' });
  await db.doc('avisos/' + H + '_org10').set({ gid: H, uid: 'org10', ligado: true });
  await db.doc('usuarios/org10/aparelhos/c').set({ token: 'tk-org10', lang: 'pt-BR' });
  await db.doc('grupos/' + H + '/rodadas/t1').set({ date: '2027-09-10', time: '20:00' });
  await db.doc('avisosEnviados/_teto_' + H).set({ k: '2027-09-10', n: LIMITE_GRUPO_DIA, avisou: true });
  const env = [];
  const enviar = async ms => (env.push(...ms), ms.map(() => 'ok'));
  assert.equal(
    await aoResponder(
      db,
      { gid: H, rid: 't1', pid: 'k1' },
      null,
      { s: 'in', by: 'anonK' },
      enviar,
      Date.UTC(2027, 8, 10, 20)
    ),
    'enviados:0',
    'a resposta já não sai (teto das respostas)'
  );
  const feitos = await verificarFaltas(db, enviar, Date.UTC(2027, 8, 10, 21)); // 18h em São Paulo, jogo às 20h
  assert.deepEqual(feitos, [H + '/t1']);
  assert.ok(
    env.some(m => m.tag === 'f-t1' && m.token === 'tk-org10'),
    'faltam pessoas sai pelo teto da rotina'
  );
});
