/* Regras do Firebase testadas no emulador (KAN-104).
   Roda no GitHub a cada proposta de mudança (tarefa "regras-firebase" em .github/workflows/testes.yml):
     npx firebase emulators:exec --only firestore --project demo-nosso-jogo "node --test testes/regras-firebase/*.test.mjs"
   As regras vão ao ar sozinhas no Merge; se algum caso aqui falhar, a proposta fica vermelha. */
import { after, before, beforeEach, describe, test } from 'node:test';
import fs from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, increment, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

let env;
const G = 'grupos/g1';
const senha = { firebase: { sign_in_provider: 'password' } };
const db = {
  adm: () => env.authenticatedContext('adm', senha).firestore(),          // administrador do g1
  dono: () => env.authenticatedContext('dono', senha).firestore(),        // organizador do g1
  outro: () => env.authenticatedContext('outro', senha).firestore(),      // administrador de OUTRO grupo
  anon: () => env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } }).firestore(), // jogador pelo link
  semLogin: () => env.unauthenticatedContext().firestore(),
};

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-nosso-jogo', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore(), s = (p, o) => setDoc(doc(f, p), o);
    await s(G, { name: 'G1', owner: 'dono', ativo: true, createdAt: 1 });
    await s(G + '/membros/dono', { uid: 'dono', role: 'owner', email: 'dono@x.com' });
    await s(G + '/membros/adm', { uid: 'adm', role: 'admin', email: 'adm@x.com' });
    await s('grupos/g2', { name: 'G2', owner: 'outro', ativo: true, createdAt: 1 });
    await s('grupos/g2/membros/outro', { uid: 'outro', role: 'owner' });
    await s(G + '/rodadas/r1', { date: '2026-10-05', locked: false, np: 1 });
    await s(G + '/rodadas/r2', { date: '2026-10-12', locked: true });
    await s(G + '/rodadas/r1/partidas/p1', { ca: 0, cb: 1, ga: 1, gb: 0, pa: ['a'], pb: ['b'], goals: [] });
    await s(G + '/resumos/2026-10', { mes: '2026-10', jog: { a: { j: 1, v: 1 } } });
    await s(G + '/caixa/c1', { k: 'mensal', v: 80, d: '2026-10-02' });
    await s(G + '/privado/caixa', { pix: 'chave', mensal: 80 });
    await s(G + '/jogadores/j1', { name: 'Cadastrado' });
  });
});

describe('partidas (KAN-86)', () => {
  test('jogador pelo link e visitante leem o placar', async () => {
    await assertSucceeds(getDoc(doc(db.anon(), G + '/rodadas/r1/partidas/p1')));
    await assertSucceeds(getDoc(doc(db.semLogin(), G + '/rodadas/r1/partidas/p1')));
  });
  test('jogador pelo link não grava nem apaga partida', async () => {
    await assertFails(setDoc(doc(db.anon(), G + '/rodadas/r1/partidas/p2'), { ga: 9 }));
    await assertFails(deleteDoc(doc(db.anon(), G + '/rodadas/r1/partidas/p1')));
  });
  test('administrador de outro grupo não grava nem apaga', async () => {
    await assertFails(setDoc(doc(db.outro(), G + '/rodadas/r1/partidas/p2'), { ga: 9 }));
    await assertFails(deleteDoc(doc(db.outro(), G + '/rodadas/r1/partidas/p1')));
  });
  test('administrador cria partida nova', async () => {
    await assertSucceeds(setDoc(doc(db.adm(), G + '/rodadas/r1/partidas/p2'), { ga: 2, gb: 2 }));
  });
  test('partida já existente não é regravada (evita contar em dobro)', async () => {
    await assertFails(setDoc(doc(db.adm(), G + '/rodadas/r1/partidas/p1'), { ga: 5 }));
  });
  test('apagar só o que existe: a segunda vez é recusada', async () => {
    await assertSucceeds(deleteDoc(doc(db.adm(), G + '/rodadas/r1/partidas/p1')));
    await assertFails(deleteDoc(doc(db.adm(), G + '/rodadas/r1/partidas/p1')));
  });
  test('lote com partida repetida é recusado inteiro (o resumo não muda)', async () => {
    const f = db.adm(), b = writeBatch(f);
    b.set(doc(f, G + '/rodadas/r1/partidas/p1'), { ga: 1 });
    b.set(doc(f, G + '/resumos/2026-10'), { mes: '2026-10', jog: { a: { j: increment(1) } } }, { merge: true });
    await assertFails(b.commit());
    await env.withSecurityRulesDisabled(async ctx => {
      const d = (await getDoc(doc(ctx.firestore(), G + '/resumos/2026-10'))).data();
      if (d.jog.a.j !== 1) throw new Error('o resumo mudou: ' + d.jog.a.j);
    });
  });
  test('lote de partida nova + contagem + resumo é aceito', async () => {
    const f = db.adm(), b = writeBatch(f);
    b.set(doc(f, G + '/rodadas/r1/partidas/p3'), { ga: 3, gb: 1 });
    b.set(doc(f, G + '/rodadas/r1'), { np: increment(1) }, { merge: true });
    b.set(doc(f, G + '/resumos/2026-10'), { mes: '2026-10', at: 1, jog: { a: { j: increment(1), v: increment(1) } }, jogos: { p3: { rid: 'r1', ga: 3, gb: 1 } } }, { merge: true });
    await assertSucceeds(b.commit());
  });
});

describe('resumos por mês (KAN-87)', () => {
  test('só administradores do grupo leem', async () => {
    await assertSucceeds(getDoc(doc(db.adm(), G + '/resumos/2026-10')));
    await assertFails(getDoc(doc(db.anon(), G + '/resumos/2026-10')));
    await assertFails(getDoc(doc(db.outro(), G + '/resumos/2026-10')));
    await assertFails(getDoc(doc(db.semLogin(), G + '/resumos/2026-10')));
  });
  test('jogador pelo link e outro grupo não gravam', async () => {
    await assertFails(setDoc(doc(db.anon(), G + '/resumos/2026-10'), { mes: '2026-10' }, { merge: true }));
    await assertFails(setDoc(doc(db.outro(), G + '/resumos/2026-10'), { mes: '2026-10' }, { merge: true }));
  });
  test('administrador soma com incremento (gravação parcial)', async () => {
    await assertSucceeds(setDoc(doc(db.adm(), G + '/resumos/2026-10'), { mes: '2026-10', cx: { ent: increment(8000) } }, { merge: true }));
  });
  test('campo fora da lista, mês diferente do nome ou nome inválido são recusados', async () => {
    await assertFails(setDoc(doc(db.adm(), G + '/resumos/2026-10'), { mes: '2026-10', extra: 1 }, { merge: true }));
    await assertFails(setDoc(doc(db.adm(), G + '/resumos/2026-11'), { mes: '2026-10' }));
    await assertFails(setDoc(doc(db.adm(), G + '/resumos/outubro'), { mes: 'outubro' }));
  });
});

describe('caixa e dados privados', () => {
  test('caixa e privado: só administradores', async () => {
    await assertSucceeds(getDoc(doc(db.adm(), G + '/caixa/c1')));
    await assertFails(getDoc(doc(db.anon(), G + '/caixa/c1')));
    await assertFails(getDoc(doc(db.outro(), G + '/caixa/c1')));
    await assertFails(getDoc(doc(db.anon(), G + '/privado/caixa')));
  });
  test('lançamento: apagar só o que existe', async () => {
    await assertSucceeds(deleteDoc(doc(db.adm(), G + '/caixa/c1')));
    await assertFails(deleteDoc(doc(db.adm(), G + '/caixa/c1')));
  });
  test('chave Pix não pode ir para o documento público do grupo', async () => {
    await assertFails(updateDoc(doc(db.adm(), G), { cfg: { pix: 'nova' } }));
  });
});

describe('presença pelo link', () => {
  const pres = { s: 'in', t: 1, by: 'anon1', dev: 'anon1' };
  test('jogador confirma com a lista aberta', async () => {
    await assertSucceeds(setDoc(doc(db.anon(), G + '/rodadas/r1/presencas/j1'), pres));
  });
  test('lista fechada recusa a confirmação', async () => {
    await assertFails(setDoc(doc(db.anon(), G + '/rodadas/r2/presencas/j1'), pres));
  });
  test('identificador com código (aspas/tags) é recusado (KAN-76)', async () => {
    await assertFails(setDoc(doc(db.anon(), G + '/rodadas/r1/presencas/x"><img src=x onerror=alert(1)>'), pres));
    await assertFails(setDoc(doc(db.anon(), G + '/rodadas/r1/presencas/' + 'a'.repeat(80)), pres));
  });
  test('campo estranho na presença é recusado', async () => {
    await assertFails(setDoc(doc(db.anon(), G + '/rodadas/r1/presencas/j1'), Object.assign({ nota: 10 }, pres)));
  });
});

describe('votos pelo link (KAN-76)', () => {
  const V = G + '/votacoes/v1';
  beforeEach(async () => { await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), V), { open: true, cats: [{ id: 'mvp' }] }); }); });
  test('voto com identificador válido é aceito', async () => {
    await assertSucceeds(setDoc(doc(db.anon(), V + '/votos/anon1'), { pid: 'j1', v: { mvp: 'j2' }, t: 1 }));
  });
  test('voto com identificador de quem vota contendo código é recusado', async () => {
    await assertFails(setDoc(doc(db.anon(), V + '/votos/anon1'), { pid: '"><b>x', v: { mvp: 'j2' }, t: 1 }));
  });
  test('voto com mais de 30 categorias é recusado', async () => {
    const v = {}; for (let i = 0; i < 31; i++) v['c' + i] = 'j1';
    await assertFails(setDoc(doc(db.anon(), V + '/votos/anon1'), { pid: 'j1', v, t: 1 }));
  });
});

describe('limites contra abuso (KAN-89)', () => {
  const R = G + '/rodadas/r1', C = R + '/limites/avulsos';
  const pres = { s: 'in', t: 1, by: 'anon1', dev: 'anon1', nome: 'Avulso', avulso: true };
  const novoAvulso = (f, pid, extra = {}) => { const b = writeBatch(f);
    b.set(doc(f, R + '/presencas/' + pid), Object.assign({}, pres, extra));
    b.set(doc(f, C), { n: increment(1), ult: pid }, { merge: true }); return b.commit(); };
  const semRegras = fn => env.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));

  test('avulso novo pelo link entra somando 1 no contador da rodada', async () => {
    await assertSucceeds(novoAvulso(db.anon(), 'av1'));
    await assertSucceeds(novoAvulso(db.anon(), 'av2'));
    await semRegras(async f => { const d = (await getDoc(doc(f, C))).data(); if (d.n !== 2) throw new Error('contador ' + d.n); });
  });
  test('avulso novo sem somar no contador é recusado', async () => {
    await assertFails(setDoc(doc(db.anon(), R + '/presencas/av1'), pres));
  });
  test('passou do limite (30): a gravação extra é recusada', async () => {
    await semRegras(f => setDoc(doc(f, C), { n: 30, ult: 'x' }));
    await assertFails(novoAvulso(db.anon(), 'av31'));
  });
  test('jogador cadastrado confirma, desmarca e confirma de novo sem contar (critério 2)', async () => {
    const f = db.anon(), p = doc(f, R + '/presencas/j1');
    await assertSucceeds(setDoc(p, { s: 'in', t: 1, by: 'anon1', dev: 'anon1' }));
    await assertSucceeds(setDoc(p, { s: 'out', t: 2, by: 'anon1', dev: 'anon1' }));
    await assertSucceeds(setDoc(p, { s: 'in', t: 3, by: 'anon1', dev: 'anon1' }));
  });
  test('avulso muda a própria resposta sem contar de novo', async () => {
    await assertSucceeds(novoAvulso(db.anon(), 'av1'));
    await assertSucceeds(setDoc(doc(db.anon(), R + '/presencas/av1'), Object.assign({}, pres, { s: 'out', t: 2 })));
  });
  test('contador não volta para trás nem pula, e não conta quem já estava na lista', async () => {
    await assertSucceeds(novoAvulso(db.anon(), 'av1'));
    await assertFails(setDoc(doc(db.anon(), C), { n: 0, ult: 'av1' }));
    await assertFails(setDoc(doc(db.anon(), C), { n: 5, ult: 'av9' }));
    await assertFails(novoAvulso(db.anon(), 'av1'));
  });
  test('limite mudado em sistema/limites vale na hora (critério 5)', async () => {
    await semRegras(f => setDoc(doc(f, 'sistema/limites'), { avulsosPorRodada: 1, gruposPorConta: 1 }));
    await assertSucceeds(novoAvulso(db.anon(), 'av1'));
    await assertFails(novoAvulso(db.anon(), 'av2'));
  });
  test('ninguém grava a configuração dos limites pelo app; todos leem', async () => {
    await assertFails(setDoc(doc(db.adm(), 'sistema/limites'), { avulsosPorRodada: 999 }));
    await assertSucceeds(getDoc(doc(db.anon(), 'sistema/limites')));
  });
  test('administrador põe avulso direto, sem contador', async () => {
    await assertSucceeds(setDoc(doc(db.adm(), R + '/presencas/av9'), { s: 'in', t: 1, by: 'adm', nome: 'Avulso', avulso: true }));
  });
  test('nome com mais de 40 letras é recusado (critério 4)', async () => {
    const longo = 'x'.repeat(41);
    await assertFails(novoAvulso(db.anon(), 'av1', { nome: longo }));
    await assertFails(setDoc(doc(db.adm(), G + '/jogadores/j2'), { name: longo }));
    await assertFails(setDoc(doc(db.adm(), G + '/avulsos/a2'), { nome: longo }));
    await assertSucceeds(setDoc(doc(db.adm(), G + '/jogadores/j2'), { name: 'x'.repeat(40) }));
  });

  const criarGrupo = (f, uid, gid, extra = {}) => { const b = writeBatch(f);
    b.set(doc(f, 'grupos/' + gid), Object.assign({ name: 'Novo', owner: uid, ativo: true, createdAt: 1 }, extra));
    b.set(doc(f, 'contas/' + uid), { ng: increment(1), ult: gid }, { merge: true }); return b.commit(); };
  test('conta cria grupo somando 1 no contador', async () => {
    await assertSucceeds(criarGrupo(db.adm(), 'adm', 'gn1'));
    await assertSucceeds(criarGrupo(db.adm(), 'adm', 'gn2'));
  });
  test('grupo sem somar no contador é recusado', async () => {
    await assertFails(setDoc(doc(db.adm(), 'grupos/gn1'), { name: 'Novo', owner: 'adm', ativo: true, createdAt: 1 }));
  });
  test('passou do limite de grupos (20): nenhum grupo extra é criado (critério 3)', async () => {
    await semRegras(f => setDoc(doc(f, 'contas/adm'), { ng: 20, ult: 'x' }));
    await assertFails(criarGrupo(db.adm(), 'adm', 'gn21'));
  });
  test('contador de grupos não é zerado nem mexido por outra conta', async () => {
    await assertSucceeds(criarGrupo(db.adm(), 'adm', 'gn1'));
    await assertFails(setDoc(doc(db.adm(), 'contas/adm'), { ng: 0, ult: 'gn1' }));
    await assertFails(deleteDoc(doc(db.adm(), 'contas/adm')));
    await assertFails(getDoc(doc(db.outro(), 'contas/adm')));
  });
  test('nome de grupo novo com mais de 40 letras é recusado', async () => {
    await assertFails(criarGrupo(db.adm(), 'adm', 'gn1', { name: 'x'.repeat(41) }));
  });
});

describe('administradores (membros)', () => {
  test('o próprio administrador grava como entrou (via)', async () => {
    await assertSucceeds(updateDoc(doc(db.adm(), G + '/membros/adm'), { via: 'google' }));
  });
  test('não pode mudar o próprio papel nem a via de outro', async () => {
    await assertFails(updateDoc(doc(db.adm(), G + '/membros/adm'), { role: 'owner' }));
    await assertFails(updateDoc(doc(db.adm(), G + '/membros/dono'), { via: 'google' }));
    await assertFails(updateDoc(doc(db.adm(), G + '/membros/adm'), { via: 'qualquer' }));
  });
  test('jogador pelo link não vira administrador', async () => {
    await assertFails(setDoc(doc(db.anon(), G + '/membros/anon1'), { uid: 'anon1', role: 'admin' }));
  });
});
