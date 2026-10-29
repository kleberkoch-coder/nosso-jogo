/* Regras do Firebase testadas no emulador (KAN-104).
   Roda no GitHub a cada proposta de mudança (tarefa "regras-firebase" em .github/workflows/testes.yml):
     npx firebase emulators:exec --only firestore --project demo-nosso-jogo "node --test testes/regras-firebase/*.test.mjs"
   As regras vão ao ar sozinhas no Merge; se algum caso aqui falhar, a proposta fica vermelha. */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  deleteField,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

let env;
const G = 'grupos/g1';
const senha = { firebase: { sign_in_provider: 'password' } };
const db = {
  adm: () => env.authenticatedContext('adm', senha).firestore(), // administrador do g1
  dono: () => env.authenticatedContext('dono', senha).firestore(), // organizador do g1
  outro: () => env.authenticatedContext('outro', senha).firestore(), // administrador de OUTRO grupo
  anon: () => env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } }).firestore(), // jogador pelo link
  semLogin: () => env.unauthenticatedContext().firestore(),
  admEmail: () =>
    env.authenticatedContext('adm', { email: 'adm@x.com', firebase: { sign_in_provider: 'password' } }).firestore(),
  portal: () =>
    env
      .authenticatedContext('kleber', {
        email: 'kleberkoch@gmail.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      })
      .firestore(),
  // Mesmo e-mail do Kleber, mas outra conta (outro identificador): não entra.
  portalSemConfirmar: () =>
    env
      .authenticatedContext('falso', {
        email: 'kleberkoch@gmail.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      })
      .firestore(),
  // Identificador certo, mas entrando por e-mail e senha: não entra (o portal só aceita Google).
  portalSenha: () =>
    env
      .authenticatedContext('kleber', { email: 'kleberkoch@gmail.com', firebase: { sign_in_provider: 'password' } })
      .firestore(),
};

before(async () => {
  // Nos testes, o administrador do portal é a conta 'kleber' (no ar, a lista tem só o identificador real do Kleber).
  const regras = fs
    .readFileSync('firestore.rules', 'utf8')
    .replace(/\/\*ADMINS_PORTAL\*\/\[[^\]]*\]/, "/*ADMINS_PORTAL*/['kleber']");
  if (!regras.includes("['kleber']")) throw new Error('Marcador ADMINS_PORTAL não encontrado em firestore.rules');
  env = await initializeTestEnvironment({ projectId: 'demo-nosso-jogo', firestore: { rules: regras } });
});
after(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore(),
      s = (p, o) => setDoc(doc(f, p), o);
    // Planos (KAN-119): nos testes antigos, todos no Plano A (transição bem longe); os testes dos planos mudam a data.
    await s('sistema/planos', { transicaoAte: Date.UTC(2100, 0, 1) });
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
    // Grupo antigo, ainda com mensalidade e diária no documento público (KAN-79)
    await s('grupos/g3', { name: 'G3', owner: 'adm', ativo: true, createdAt: 1, cfg: { mensal: 80, diaria: 20 } });
    await s('grupos/g3/membros/adm', { uid: 'adm', role: 'owner' });
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
  test('KAN-176: administrador edita a partida subindo a versão de 1 em 1', async () => {
    const p = doc(db.adm(), G + '/rodadas/r1/partidas/p1');
    await assertSucceeds(setDoc(p, { ca: 0, cb: 1, ga: 1, gb: 1, pa: ['a'], pb: ['b'], goals: [], ver: 1 }));
    await assertSucceeds(setDoc(p, { ca: 0, cb: 1, ga: 2, gb: 1, pa: ['a'], pb: ['b'], goals: [], ver: 2 }));
  });
  test('KAN-176: edição com versão velha (outro aparelho já editou) é recusada', async () => {
    const p = doc(db.adm(), G + '/rodadas/r1/partidas/p1');
    await assertSucceeds(setDoc(p, { ga: 1, gb: 1, ver: 1 }));
    await assertFails(setDoc(p, { ga: 3, gb: 1, ver: 1 }));
  });
  test('KAN-176: jogador pelo link e administrador de outro grupo não editam', async () => {
    await assertFails(setDoc(doc(db.anon(), G + '/rodadas/r1/partidas/p1'), { ga: 9, ver: 1 }));
    await assertFails(setDoc(doc(db.outro(), G + '/rodadas/r1/partidas/p1'), { ga: 9, ver: 1 }));
  });
  test('apagar só o que existe: a segunda vez é recusada', async () => {
    await assertSucceeds(deleteDoc(doc(db.adm(), G + '/rodadas/r1/partidas/p1')));
    await assertFails(deleteDoc(doc(db.adm(), G + '/rodadas/r1/partidas/p1')));
  });
  test('lote com partida repetida é recusado inteiro (o resumo não muda)', async () => {
    const f = db.adm(),
      b = writeBatch(f);
    b.set(doc(f, G + '/rodadas/r1/partidas/p1'), { ga: 1 });
    b.set(doc(f, G + '/resumos/2026-10'), { mes: '2026-10', jog: { a: { j: increment(1) } } }, { merge: true });
    await assertFails(b.commit());
    await env.withSecurityRulesDisabled(async ctx => {
      const d = (await getDoc(doc(ctx.firestore(), G + '/resumos/2026-10'))).data();
      if (d.jog.a.j !== 1) throw new Error('o resumo mudou: ' + d.jog.a.j);
    });
  });
  test('lote de partida nova + contagem + resumo é aceito', async () => {
    const f = db.adm(),
      b = writeBatch(f);
    b.set(doc(f, G + '/rodadas/r1/partidas/p3'), { ga: 3, gb: 1 });
    b.set(doc(f, G + '/rodadas/r1'), { np: increment(1) }, { merge: true });
    b.set(
      doc(f, G + '/resumos/2026-10'),
      {
        mes: '2026-10',
        at: 1,
        jog: { a: { j: increment(1), v: increment(1) } },
        jogos: { p3: { rid: 'r1', ga: 3, gb: 1 } },
      },
      { merge: true }
    );
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
    await assertSucceeds(
      setDoc(
        doc(db.adm(), G + '/resumos/2026-10'),
        { mes: '2026-10', jog: { a: { j: increment(1) } } },
        { merge: true }
      )
    );
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
  const pres = { s: 'in', t: Date.now(), by: 'anon1', dev: 'anon1' };
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
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), V), { open: true, cats: [{ id: 'mvp' }] });
    });
  });
  test('voto com identificador válido é aceito', async () => {
    await assertSucceeds(setDoc(doc(db.anon(), V + '/votos/anon1'), { pid: 'j1', v: { mvp: 'j2' }, t: 1 }));
  });
  test('voto com identificador de quem vota contendo código é recusado', async () => {
    await assertFails(setDoc(doc(db.anon(), V + '/votos/anon1'), { pid: '"><b>x', v: { mvp: 'j2' }, t: 1 }));
  });
  test('voto com mais de 30 categorias é recusado', async () => {
    const v = {};
    for (let i = 0; i < 31; i++) v['c' + i] = 'j1';
    await assertFails(setDoc(doc(db.anon(), V + '/votos/anon1'), { pid: 'j1', v, t: 1 }));
  });
  test('KAN-198: voto normal em várias categorias, inclusive categoria criada pelo organizador, é aceito', async () => {
    await assertSucceeds(
      setDoc(doc(db.anon(), V + '/votos/anon1'), { pid: 'j1', v: { best: 'j2', gk: 'j3', xMvk3b2: 'av-1' }, t: 1 })
    );
    await assertSucceeds(setDoc(doc(db.anon(), V + '/votos/anon1'), { pid: 'j1', v: {}, t: 2 }));
  });
  test('KAN-198: voto com escolhido de mais de 64 letras, texto com código ou que não é texto é recusado', async () => {
    await assertFails(setDoc(doc(db.anon(), V + '/votos/anon1'), { pid: 'j1', v: { best: 'x'.repeat(65) }, t: 1 }));
    await assertFails(setDoc(doc(db.anon(), V + '/votos/anon1'), { pid: 'j1', v: { best: '<b>x' }, t: 1 }));
    await assertFails(
      setDoc(doc(db.anon(), V + '/votos/anon1'), { pid: 'j1', v: { best: { a: 'x'.repeat(5000) } }, t: 1 })
    );
    await assertFails(
      setDoc(doc(db.anon(), V + '/votos/anon1'), { pid: 'j1', v: { best: 'j2', mvp: 'a|'.repeat(1100) + 'a' }, t: 1 })
    );
  });
});

describe('vagas para diaristas e avulsos (KAN-63)', () => {
  const R = G + '/rodadas/r1',
    CV = R + '/limites/vagas',
    CA = R + '/limites/avulsos';
  const semRegras = fn => env.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));
  const pres = (s, extra = {}) => Object.assign({ s, t: Date.now(), by: 'anon1', dev: 'anon1' }, extra);
  // Presença pelo link com (ou sem) o contador de vagas na mesma gravação
  const marcar = (f, pid, s, delta, extra = {}) => {
    const b = writeBatch(f);
    b.set(doc(f, R + '/presencas/' + pid), pres(s, extra));
    if (delta) b.set(doc(f, CV), { n: increment(delta), ult: pid }, { merge: true });
    if (extra.avulso) b.set(doc(f, CA), { n: increment(1), ult: pid }, { merge: true });
    return b.commit();
  };
  const preparar = (vagas, ctrl = true) =>
    semRegras(async f => {
      await setDoc(doc(f, G), { name: 'G1', owner: 'dono', ativo: true, createdAt: 1, cfg: { vagasCtrl: ctrl } });
      await setDoc(doc(f, G + '/jogadores/d1'), { name: 'Diarista', vaga: true });
      await setDoc(doc(f, G + '/jogadores/d2'), { name: 'Diarista 2', vaga: true });
      await setDoc(doc(f, G + '/jogadores/m1'), { name: 'Mensalista' });
      await setDoc(doc(f, R), Object.assign({ date: '2026-10-05', locked: false }, vagas ? { vagas } : {}));
    });

  test('vagas fechadas: diarista não entra pelo link, nem somando no contador', async () => {
    await preparar(null);
    await assertFails(marcar(db.anon(), 'd1', 'in', 0));
    await assertFails(marcar(db.anon(), 'd1', 'in', 1));
  });
  test('vagas fechadas: mensalista (sem a marca) confirma normalmente', async () => {
    await preparar(null);
    await assertSucceeds(marcar(db.anon(), 'j1', 'in', 0));
  });
  test('vagas abertas: diarista entra somando 1; sem somar é recusado', async () => {
    await preparar({ aberta: true, max: 2 });
    await assertFails(marcar(db.anon(), 'd1', 'in', 0));
    await assertSucceeds(marcar(db.anon(), 'd1', 'in', 1));
  });
  test('vagas acabaram (2 de 2): o próximo é recusado', async () => {
    await preparar({ aberta: true, max: 2 });
    await semRegras(f => setDoc(doc(f, CV), { n: 2, ult: 'x' }));
    await assertFails(marcar(db.anon(), 'd2', 'in', 1));
  });
  test('sem limite (max 0): entra mesmo com o contador alto', async () => {
    await preparar({ aberta: true, max: 0 });
    await semRegras(f => setDoc(doc(f, CV), { n: 40, ult: 'x' }));
    await assertSucceeds(marcar(db.anon(), 'd2', 'in', 1));
  });
  test('quem estava dentro sai e devolve a vaga (-1); sair sem devolver também pode', async () => {
    await preparar({ aberta: true, max: 1 });
    await assertSucceeds(marcar(db.anon(), 'd1', 'in', 1));
    await assertSucceeds(marcar(db.anon(), 'd1', 'out', -1));
    await assertSucceeds(marcar(db.anon(), 'd1', 'in', 1));
    await assertSucceeds(marcar(db.anon(), 'd1', 'out', 0));
  });
  test('avulso novo com vagas abertas soma nos dois contadores; só no de avulsos é recusado', async () => {
    await preparar({ aberta: true, max: 3 });
    await assertFails(marcar(db.anon(), 'av1', 'in', 0, { nome: 'Avulso', avulso: true }));
    await assertSucceeds(marcar(db.anon(), 'av1', 'in', 1, { nome: 'Avulso', avulso: true }));
  });
  test('controle desligado: diarista entra como antes, sem contador', async () => {
    await preparar(null, false);
    await assertSucceeds(marcar(db.anon(), 'd1', 'in', 0));
  });
  test('contador não sobe com quem não precisa de vaga, nem com valor inventado', async () => {
    await preparar({ aberta: true, max: 2 });
    await assertFails(marcar(db.anon(), 'j1', 'in', 1));
    await assertFails(setDoc(doc(db.anon(), CV), { n: 0, ult: 'd1' }));
  });
  test('KAN-197: mensalista saindo não devolve vaga; diarista que estava dentro devolve', async () => {
    await preparar({ aberta: true, max: 2 });
    await assertSucceeds(marcar(db.anon(), 'd1', 'in', 1));
    await assertSucceeds(marcar(db.anon(), 'd2', 'in', 1));
    await assertSucceeds(marcar(db.anon(), 'm1', 'in', 0));
    // Mensalista sai junto com a descida do contador: a gravação inteira é recusada
    await assertFails(marcar(db.anon(), 'm1', 'out', -1));
    await assertSucceeds(marcar(db.anon(), 'm1', 'out', 0));
    // Vagas cheias (2 de 2): o avulso novo continua recusado
    await assertFails(marcar(db.anon(), 'av9', 'in', 1, { nome: 'Avulso 9', avulso: true }));
    // Diarista que estava dentro sai e devolve (2 → 1)
    await assertSucceeds(marcar(db.anon(), 'd1', 'out', -1));
    await semRegras(async f => {
      const s = await getDoc(doc(f, CV));
      assert.equal(s.data().n, 1);
    });
  });
  test('KAN-197: com o controle desligado, ninguém mexe no contador pelo link', async () => {
    await preparar({ aberta: true, max: 2 }, false);
    await semRegras(f => setDoc(doc(f, CV), { n: 1, ult: 'x' }));
    await semRegras(f =>
      setDoc(doc(f, R + '/presencas/d1'), { s: 'in', t: Date.now() - 1000, by: 'anon1', dev: 'anon1' })
    );
    await assertFails(marcar(db.anon(), 'd1', 'out', -1));
  });
  test('KAN-198: marca de avulso só sim ou não', async () => {
    await preparar(null, false);
    await assertFails(marcar(db.anon(), 'av2', 'in', 0, { nome: 'Avulso 2', avulso: 'x'.repeat(5000) }));
    await assertSucceeds(marcar(db.anon(), 'av3', 'in', 0, { nome: 'Avulso 3', avulso: true }));
    await assertSucceeds(marcar(db.anon(), 'd1', 'in', 0));
  });
  test('administrador abre e zera as vagas; o jogador pelo link não', async () => {
    await preparar(null);
    await assertSucceeds(setDoc(doc(db.adm(), R), { vagas: { aberta: true, max: 3 } }, { merge: true }));
    await assertSucceeds(setDoc(doc(db.adm(), CV), { n: 0, ult: 'adm' }));
    await assertSucceeds(deleteDoc(doc(db.adm(), CV)));
    await assertFails(setDoc(doc(db.anon(), R), { vagas: { aberta: true, max: 99 } }, { merge: true }));
    await assertSucceeds(marcar(db.adm(), 'd1', 'in', 0));
  });
});

describe('limites contra abuso (KAN-89)', () => {
  const R = G + '/rodadas/r1',
    C = R + '/limites/avulsos';
  const pres = { s: 'in', t: Date.now(), by: 'anon1', dev: 'anon1', nome: 'Avulso', avulso: true };
  const novoAvulso = (f, pid, extra = {}) => {
    const b = writeBatch(f);
    b.set(doc(f, R + '/presencas/' + pid), Object.assign({}, pres, extra));
    b.set(doc(f, C), { n: increment(1), ult: pid }, { merge: true });
    return b.commit();
  };
  const semRegras = fn => env.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));

  test('avulso novo pelo link entra somando 1 no contador da rodada', async () => {
    await assertSucceeds(novoAvulso(db.anon(), 'av1'));
    await assertSucceeds(novoAvulso(db.anon(), 'av2'));
    await semRegras(async f => {
      const d = (await getDoc(doc(f, C))).data();
      if (d.n !== 2) throw new Error('contador ' + d.n);
    });
  });
  test('avulso novo sem somar no contador é recusado', async () => {
    await assertFails(setDoc(doc(db.anon(), R + '/presencas/av1'), pres));
  });
  test('passou do limite (30): a gravação extra é recusada', async () => {
    await semRegras(f => setDoc(doc(f, C), { n: 30, ult: 'x' }));
    await assertFails(novoAvulso(db.anon(), 'av31'));
  });
  test('jogador cadastrado confirma, desmarca e confirma de novo sem contar (critério 2)', async () => {
    const f = db.anon(),
      p = doc(f, R + '/presencas/j1');
    await assertSucceeds(setDoc(p, { s: 'in', t: Date.now(), by: 'anon1', dev: 'anon1' }));
    await assertSucceeds(setDoc(p, { s: 'out', t: Date.now(), by: 'anon1', dev: 'anon1' }));
    await assertSucceeds(setDoc(p, { s: 'in', t: Date.now(), by: 'anon1', dev: 'anon1' }));
  });
  test('avulso muda a própria resposta sem contar de novo', async () => {
    await assertSucceeds(novoAvulso(db.anon(), 'av1'));
    await assertSucceeds(
      setDoc(doc(db.anon(), R + '/presencas/av1'), Object.assign({}, pres, { s: 'out', t: Date.now() }))
    );
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
    await assertSucceeds(
      setDoc(doc(db.adm(), R + '/presencas/av9'), { s: 'in', t: 1, by: 'adm', nome: 'Avulso', avulso: true })
    );
  });
  test('nome com mais de 40 letras é recusado (critério 4)', async () => {
    const longo = 'x'.repeat(41);
    await assertFails(novoAvulso(db.anon(), 'av1', { nome: longo }));
    await assertFails(setDoc(doc(db.adm(), G + '/jogadores/j2'), { name: longo }));
    await assertFails(setDoc(doc(db.adm(), G + '/avulsos/a2'), { nome: longo }));
    await assertSucceeds(setDoc(doc(db.adm(), G + '/jogadores/j2'), { name: 'x'.repeat(40) }));
  });

  const criarGrupo = (f, uid, gid, extra = {}) => {
    const b = writeBatch(f);
    b.set(doc(f, 'grupos/' + gid), Object.assign({ name: 'Novo', owner: uid, ativo: true, createdAt: 1 }, extra));
    b.set(doc(f, 'contas/' + uid), { ng: increment(1), ult: gid, ativos: arrayUnion(gid) }, { merge: true });
    return b.commit();
  };
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

describe('segurança do link (KAN-77, KAN-78, KAN-79)', () => {
  const P = G + '/rodadas/r1/presencas/';
  const base = () => ({ s: 'in', t: Date.now(), by: 'anon1', dev: 'anon1' });
  test('KAN-78: hora da confirmação no futuro ou de mais de 6 horas atrás é recusada', async () => {
    await assertFails(setDoc(doc(db.anon(), P + 'j1'), Object.assign(base(), { t: Date.now() + 10 * 60000 })));
    await assertFails(setDoc(doc(db.anon(), P + 'j1'), Object.assign(base(), { t: Date.now() - 7 * 3600000 })));
    await assertFails(setDoc(doc(db.anon(), P + 'j1'), Object.assign(base(), { t: 'agora' })));
    await assertSucceeds(setDoc(doc(db.anon(), P + 'j1'), base()));
  });
  test('KAN-78: sem mudar a resposta, a hora não muda (não dá para furar a fila)', async () => {
    const p = doc(db.anon(), P + 'j1'),
      b = base();
    await assertSucceeds(setDoc(p, b));
    await assertFails(setDoc(p, Object.assign({}, b, { t: b.t - 60000 })));
    await assertSucceeds(setDoc(p, b));
  });
  test('KAN-78: ao mudar a resposta, a hora não volta para trás', async () => {
    const p = doc(db.anon(), P + 'j1'),
      b = base();
    await assertSucceeds(setDoc(p, b));
    await assertFails(setDoc(p, Object.assign({}, b, { s: 'out', t: b.t - 1000 })));
    await assertSucceeds(setDoc(p, Object.assign({}, b, { s: 'out', t: Date.now() })));
  });
  test('KAN-78: pelo link não dá para trocar o nome, a marca de avulso nem a posição', async () => {
    const f = db.anon(),
      p = doc(f, P + 'av1'),
      b = Object.assign(base(), { nome: 'Fulano', avulso: true, pos: 'ATA' });
    const lote = writeBatch(f);
    lote.set(p, b);
    lote.set(doc(f, G + '/rodadas/r1/limites/avulsos'), { n: increment(1), ult: 'av1' }, { merge: true });
    await assertSucceeds(lote.commit());
    await assertFails(setDoc(p, Object.assign({}, b, { nome: 'Outro nome' })));
    await assertFails(setDoc(p, Object.assign({}, b, { pos: 'GOL' })));
    await assertFails(setDoc(p, Object.assign({}, b, { avulso: false })));
    await assertSucceeds(setDoc(p, Object.assign({}, b, { s: 'out', t: Date.now() })));
  });
  test('KAN-78: administrador continua podendo corrigir nome e hora', async () => {
    await assertSucceeds(setDoc(doc(db.adm(), P + 'av2'), { s: 'in', t: 1, by: 'adm', nome: 'Certo', avulso: true }));
    await assertSucceeds(
      setDoc(doc(db.adm(), P + 'av2'), { s: 'in', t: 2, by: 'adm', nome: 'Corrigido', avulso: true })
    );
  });
  test('KAN-77: jogo fixo sem documento só aceita datas próximas', async () => {
    const d = new Date(),
      ymd = x => x.toISOString().slice(0, 10);
    const hoje = 'f-' + ymd(d) + '-2000',
      longe = 'f-2099-01-01-2000',
      passado = 'f-2020-01-01-2000';
    await assertSucceeds(setDoc(doc(db.anon(), G + '/rodadas/' + hoje + '/presencas/j1'), base()));
    await assertFails(setDoc(doc(db.anon(), G + '/rodadas/' + longe + '/presencas/j1'), base()));
    await assertFails(setDoc(doc(db.anon(), G + '/rodadas/' + passado + '/presencas/j1'), base()));
  });
  test('KAN-79: mensalidade e diária novas no documento público do grupo são recusadas', async () => {
    await assertFails(updateDoc(doc(db.adm(), G), { cfg: { mensal: 90 } }));
    await assertFails(updateDoc(doc(db.adm(), G), { cfg: { diaria: 25 } }));
    await assertFails(
      setDoc(doc(db.adm(), 'grupos/gx'), { name: 'X', owner: 'adm', ativo: true, createdAt: 1, cfg: { mensal: 80 } })
    );
  });
  test('KAN-79: com valores de caixa ainda no documento público, só dá para gravar tirando-os', async () => {
    await assertFails(updateDoc(doc(db.adm(), 'grupos/g3'), { name: 'G3 novo' }));
  });
  test('KAN-79: grupo antigo não pode trocar a mensalidade no documento público', async () => {
    await assertFails(updateDoc(doc(db.adm(), 'grupos/g3'), { 'cfg.mensal': 100 }));
  });
  test('KAN-79: grupo antigo pode apagar os valores (migração)', async () => {
    await assertSucceeds(updateDoc(doc(db.adm(), 'grupos/g3'), { cfg: {} }));
  });
});

describe('planos e portal (KAN-115, KAN-116)', () => {
  test('a própria conta grava o último acesso, o e-mail dela e a data de registro', async () => {
    await assertSucceeds(
      setDoc(
        doc(db.admEmail(), 'contas/adm'),
        { acesso: Date.now(), email: 'adm@x.com', criada: Date.now() },
        { merge: true }
      )
    );
  });
  test('último acesso de mais de 10 minutos atrás, de outra conta ou com e-mail de outra pessoa é recusado', async () => {
    await assertFails(setDoc(doc(db.admEmail(), 'contas/adm'), { acesso: Date.now() - 3600000 }, { merge: true }));
    await assertFails(setDoc(doc(db.admEmail(), 'contas/outro'), { acesso: Date.now() }, { merge: true }));
    await assertFails(
      setDoc(doc(db.admEmail(), 'contas/adm'), { acesso: Date.now(), email: 'outro@x.com' }, { merge: true })
    );
  });
  test('a conta não grava o próprio plano (KAN-115, critério 4)', async () => {
    await assertFails(setDoc(doc(db.admEmail(), 'contas/adm'), { plano: 'B' }, { merge: true }));
    await assertFails(setDoc(doc(db.admEmail(), 'contas/adm'), { acesso: Date.now(), plano: 'B' }, { merge: true }));
  });
  test('com o último acesso gravado, o contador de grupos continua funcionando', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'contas/adm'), { acesso: Date.now(), email: 'adm@x.com', criada: 1 });
    });
    const f = db.adm(),
      b = writeBatch(f);
    b.set(doc(f, 'grupos/gnovo'), { name: 'Novo', owner: 'adm', ativo: true, createdAt: 1 });
    b.set(doc(f, 'contas/adm'), { ng: increment(1), ult: 'gnovo', ativos: arrayUnion('gnovo') }, { merge: true });
    await assertSucceeds(b.commit());
  });
  test('o administrador do portal lista as contas e lê o e-mail dos organizadores', async () => {
    await assertSucceeds(getDocs(collection(db.portal(), 'contas')));
    await assertSucceeds(getDoc(doc(db.portal(), G + '/membros/dono')));
  });
  test('o administrador do portal dá um plano com validade, mas não mexe no último acesso nem no contador', async () => {
    await assertSucceeds(
      setDoc(doc(db.portal(), 'contas/adm'), { plano: 'A', planoAte: Date.now() + 864e5 }, { merge: true })
    );
    await assertFails(setDoc(doc(db.portal(), 'contas/adm'), { acesso: 1 }, { merge: true }));
    await assertFails(setDoc(doc(db.portal(), 'contas/adm'), { ng: 0 }, { merge: true }));
  });
  test('KAN-133: qualquer pessoa lê um grupo pelo link, mas só o administrador do portal lista todos', async () => {
    await assertSucceeds(getDoc(doc(db.semLogin(), G)));
    await assertFails(getDocs(collection(db.semLogin(), 'grupos')));
    await assertFails(getDocs(collection(db.adm(), 'grupos')));
    await assertSucceeds(getDocs(collection(db.portal(), 'grupos')));
  });
  test('o identificador certo entrando por e-mail e senha não acessa o portal', async () => {
    await assertFails(getDocs(collection(db.portalSenha(), 'contas')));
  });
  test('outras contas, mesmo com o e-mail do Kleber, não veem a lista de clientes nem dão plano', async () => {
    await assertFails(getDocs(collection(db.adm(), 'contas')));
    await assertFails(getDocs(collection(db.portalSemConfirmar(), 'contas')));
    await assertFails(setDoc(doc(db.portalSemConfirmar(), 'contas/adm'), { plano: 'B' }, { merge: true }));
    await assertFails(getDoc(doc(db.anon(), G + '/membros/dono')));
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

describe('permissões dos administradores convidados (KAN-201)', () => {
  const NADA = { caixa: false, notas: false, elenco: false, config: false };
  const conv = () => env.authenticatedContext('conv', senha).firestore();
  const semRegras = fn => env.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));
  const preparar = (perm = NADA) =>
    semRegras(async f => {
      await setDoc(doc(f, G + '/membros/conv'), { uid: 'conv', role: 'admin', email: 'c@x.com', perm });
      await setDoc(doc(f, G + '/privado/caixa'), { pix: 'pix@x.com', tipos: {} });
      await setDoc(doc(f, G + '/privado/contatos'), { j1: { tel: '+5511999999999' } });
      await setDoc(doc(f, G + '/privado/ratings'), { nivel: { j1: 5 } });
      await setDoc(doc(f, G + '/privado/convite'), { token: 'tok123' });
      await setDoc(doc(f, G + '/jogadores/j1'), { name: 'Ana' });
      await setDoc(doc(f, G + '/caixa/l1'), { k: 'mensal', v: 80, d: '2026-10-01' });
      await setDoc(doc(f, G), {
        name: 'G1',
        owner: 'dono',
        ativo: true,
        createdAt: 1,
        cfg: { place: 'A', minutes: 10 },
      });
    });

  test('convite novo entra só com o dia a dia; pedir permissões ao entrar é recusado', async () => {
    await semRegras(f => setDoc(doc(f, G + '/privado/convite'), { token: 'tok123' }));
    const novo = env.authenticatedContext('novo', senha).firestore();
    await assertFails(
      setDoc(doc(novo, G + '/membros/novo'), {
        uid: 'novo',
        role: 'admin',
        token: 'tok123',
        perm: { ...NADA, caixa: true },
      })
    );
    await assertFails(setDoc(doc(novo, G + '/membros/novo'), { uid: 'novo', role: 'admin', token: 'tok123' }));
    // KAN-204: entrar junto com o nome na lista de convidados do grupo
    await assertFails(
      setDoc(doc(novo, G + '/membros/novo'), { uid: 'novo', role: 'admin', token: 'tok123', perm: NADA })
    );
    const b = writeBatch(novo);
    b.set(doc(novo, G + '/membros/novo'), { uid: 'novo', role: 'admin', token: 'tok123', perm: NADA });
    b.update(doc(novo, G), { adms: arrayUnion('novo') });
    await assertSucceeds(b.commit());
  });
  test('sem caixa: não lê nem grava o caixa privado nem os lançamentos', async () => {
    await preparar();
    await assertFails(getDoc(doc(conv(), G + '/privado/caixa')));
    await assertFails(setDoc(doc(conv(), G + '/privado/caixa'), { pix: 'meu@pix' }));
    await assertFails(getDoc(doc(conv(), G + '/caixa/l1')));
    await assertFails(setDoc(doc(conv(), G + '/caixa/l2'), { k: 'entrada', v: 10, d: '2026-10-02' }));
  });
  test('sem elenco: não lê contatos nem cadastra, edita ou apaga jogador', async () => {
    await preparar();
    await assertFails(getDoc(doc(conv(), G + '/privado/contatos')));
    await assertFails(setDoc(doc(conv(), G + '/jogadores/j2'), { name: 'Beto' }));
    await assertFails(updateDoc(doc(conv(), G + '/jogadores/j1'), { name: 'Ana Maria' }));
    await assertFails(deleteDoc(doc(conv(), G + '/jogadores/j1')));
  });
  test('sem notas: lê as notas (o sorteio usa), mas não muda', async () => {
    await preparar();
    await assertSucceeds(getDoc(doc(conv(), G + '/privado/ratings')));
    await assertFails(setDoc(doc(conv(), G + '/privado/ratings'), { nivel: { j1: 1 } }));
  });
  test('sem configurações: não edita o grupo nem o convite e não remove administrador; o dia a dia continua', async () => {
    await preparar();
    await assertFails(updateDoc(doc(conv(), G), { name: 'Outro nome' }));
    await assertFails(updateDoc(doc(conv(), G), { 'cfg.minutes': 20 }));
    await assertFails(getDoc(doc(conv(), G + '/privado/convite')));
    await assertFails(deleteDoc(doc(conv(), G + '/membros/adm')));
    await assertSucceeds(
      updateDoc(doc(conv(), G), { 'cfg.place': 'Quadra B', 'cfg.time': '21:00', 'cfg.novelty': 0.5 })
    );
    await assertSucceeds(updateDoc(doc(conv(), G + '/rodadas/r1'), { locked: true }));
  });
  test('com as permissões ligadas, pode cada coisa; remover administrador continua só com o organizador', async () => {
    await preparar({ caixa: true, notas: true, elenco: true, config: true });
    await assertSucceeds(getDoc(doc(conv(), G + '/privado/caixa')));
    await assertSucceeds(setDoc(doc(conv(), G + '/caixa/l2'), { k: 'entrada', v: 10, d: '2026-10-02' }));
    await assertSucceeds(getDoc(doc(conv(), G + '/privado/contatos')));
    await assertSucceeds(setDoc(doc(conv(), G + '/jogadores/j2'), { name: 'Beto' }));
    await assertSucceeds(setDoc(doc(conv(), G + '/privado/ratings'), { nivel: { j1: 7 } }));
    await assertSucceeds(updateDoc(doc(conv(), G), { name: 'Outro nome' }));
    await assertFails(deleteDoc(doc(conv(), G + '/membros/adm')));
    await assertFails(deleteDoc(doc(conv(), G + '/membros/dono')));
  });
  test('quem tem só caixa ajusta a marca de vaga do jogador, e nada mais nele', async () => {
    await preparar({ ...NADA, caixa: true });
    await assertSucceeds(updateDoc(doc(conv(), G + '/jogadores/j1'), { vaga: true }));
    await assertFails(updateDoc(doc(conv(), G + '/jogadores/j1'), { vaga: true, name: 'X' }));
  });
  test('só o organizador muda as permissões; o convidado não se dá permissão', async () => {
    await preparar();
    await assertFails(updateDoc(doc(conv(), G + '/membros/conv'), { perm: { ...NADA, caixa: true } }));
    await assertFails(updateDoc(doc(db.adm(), G + '/membros/conv'), { perm: { ...NADA, caixa: true } }));
    await assertFails(updateDoc(doc(db.dono(), G + '/membros/conv'), { perm: { ...NADA, caixa: 'sim' } }));
    await assertFails(updateDoc(doc(db.dono(), G + '/membros/conv'), { perm: { ...NADA, dono: true } }));
    await assertFails(updateDoc(doc(db.dono(), G + '/membros/conv'), { perm: NADA, role: 'owner' }));
    await assertSucceeds(updateDoc(doc(db.dono(), G + '/membros/conv'), { perm: { ...NADA, caixa: true } }));
    await assertSucceeds(getDoc(doc(conv(), G + '/privado/caixa')));
  });
  test('administrador de antes das permissões (sem perm) continua com tudo', async () => {
    await preparar();
    await assertSucceeds(getDoc(doc(db.adm(), G + '/privado/caixa')));
    await assertSucceeds(getDoc(doc(db.adm(), G + '/privado/contatos')));
    await assertSucceeds(setDoc(doc(db.adm(), G + '/privado/ratings'), { nivel: { j1: 3 } }));
    await assertSucceeds(updateDoc(doc(db.adm(), G), { name: 'Nome novo' }));
  });
});

describe('planos no app (KAN-119)', () => {
  const semRegras = fn => env.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));
  const fimDaTransicao = () => semRegras(f => setDoc(doc(f, 'sistema/planos'), { transicaoAte: 1 }));
  const conta = (uid, o) => semRegras(f => setDoc(doc(f, 'contas/' + uid), o));
  const lanc = f => setDoc(doc(f, G + '/caixa/c9'), { k: 'entrada', v: 10, d: '2026-10-20' });
  const novoGrupo = (f, uid, gid) => {
    const b = writeBatch(f);
    b.set(doc(f, 'grupos/' + gid), { name: 'Novo', owner: uid, ativo: true, createdAt: 1 });
    b.set(doc(f, 'contas/' + uid), { ng: increment(1), ult: gid, ativos: arrayUnion(gid) }, { merge: true });
    return b.commit();
  };
  const inativar = (f, uid, gid) => {
    const b = writeBatch(f);
    b.update(doc(f, 'grupos/' + gid), { ativo: false, inativadoEm: 1 });
    b.set(doc(f, 'contas/' + uid), { ativos: arrayRemove(gid) }, { merge: true });
    return b.commit();
  };
  const reativar = (f, uid, gid) => {
    const b = writeBatch(f);
    b.update(doc(f, 'grupos/' + gid), { ativo: true });
    b.set(doc(f, 'contas/' + uid), { ativos: arrayUnion(gid) }, { merge: true });
    return b.commit();
  };

  test('Grátis: vê o caixa, mas não lança, não muda o Pix e não cria votação; encerrar a que existe continua', async () => {
    await fimDaTransicao();
    await semRegras(f => setDoc(doc(f, G + '/votacoes/v1'), { open: true }));
    await assertSucceeds(getDoc(doc(db.dono(), G + '/caixa/c1')));
    await assertFails(lanc(db.dono()));
    await assertFails(deleteDoc(doc(db.dono(), G + '/caixa/c1')));
    await assertFails(setDoc(doc(db.dono(), G + '/privado/caixa'), { pix: 'outra' }));
    await assertFails(setDoc(doc(db.dono(), G + '/votacoes/v2'), { open: true }));
    await assertSucceeds(updateDoc(doc(db.dono(), G + '/votacoes/v1'), { open: false }));
  });
  test('Grátis: o link público continua (presença do jogador) (critério 5)', async () => {
    await fimDaTransicao();
    await assertSucceeds(
      setDoc(doc(db.anon(), G + '/rodadas/r1/presencas/j1'), { s: 'in', t: Date.now(), by: 'anon1', dev: 'anon1' })
    );
  });
  test('durante a transição, quem já usa continua com caixa e votação (critério 6)', async () => {
    await semRegras(f => setDoc(doc(f, 'sistema/planos'), { transicaoAte: Date.now() + 864e5 }));
    await assertSucceeds(lanc(db.dono()));
    await assertSucceeds(setDoc(doc(db.dono(), G + '/votacoes/v2'), { open: true }));
  });
  test('com o Plano A, o organizador muda mensalidade e Pix (privado/caixa)', async () => {
    await assertSucceeds(setDoc(doc(db.dono(), G + '/privado/caixa'), { pix: 'nova', mensal: 90 }));
  });
  const naTransicao = () => Date.now() < Date.UTC(2026, 10, 29, 3);
  test('sem sistema/planos, vale a data padrão da transição: lançamento', async () => {
    await semRegras(f => deleteDoc(doc(f, 'sistema/planos')));
    const r = lanc(db.dono());
    await (naTransicao() ? assertSucceeds(r) : assertFails(r));
  });
  test('sem sistema/planos, vale a data padrão da transição: mensalidade e Pix', async () => {
    await semRegras(f => deleteDoc(doc(f, 'sistema/planos')));
    const r = setDoc(doc(db.dono(), G + '/privado/caixa'), { pix: 'nova', mensal: 90 });
    await (naTransicao() ? assertSucceeds(r) : assertFails(r));
  });
  test('teste grátis: a conta grava o início uma vez só, com a hora de agora, e ganha o Plano A', async () => {
    await fimDaTransicao();
    await assertFails(setDoc(doc(db.dono(), 'contas/dono'), { teste: Date.now() - 864e5 }, { merge: true }));
    await assertSucceeds(setDoc(doc(db.dono(), 'contas/dono'), { teste: Date.now() }, { merge: true }));
    await assertSucceeds(lanc(db.dono()));
    await assertFails(setDoc(doc(db.dono(), 'contas/dono'), { teste: Date.now() }, { merge: true }));
    await assertFails(setDoc(doc(db.adm(), 'contas/dono'), { teste: Date.now() }, { merge: true }));
  });
  test('teste vencido volta ao Grátis sem apagar nada (critério 3)', async () => {
    await fimDaTransicao();
    await conta('dono', { teste: Date.now() - 15 * 864e5 });
    await assertFails(lanc(db.dono()));
    await assertSucceeds(getDoc(doc(db.dono(), G + '/caixa/c1')));
  });
  test('plano pago do portal vale; vencido, não', async () => {
    await fimDaTransicao();
    await conta('dono', { plano: 'A', planoAte: Date.now() + 864e5 });
    await assertSucceeds(lanc(db.dono()));
    await conta('dono', { plano: 'A', planoAte: Date.now() - 1 });
    await assertFails(lanc(db.dono()));
  });
  test('Grátis cria 1 grupo; o segundo é recusado (critério 1); no teste, até 3', async () => {
    await fimDaTransicao();
    await assertSucceeds(novoGrupo(db.outro(), 'outro', 'gn1'));
    await assertFails(novoGrupo(db.outro(), 'outro', 'gn2'));
    await assertSucceeds(setDoc(doc(db.outro(), 'contas/outro'), { teste: Date.now() }, { merge: true }));
    await assertSucceeds(novoGrupo(db.outro(), 'outro', 'gn2'));
    await assertSucceeds(novoGrupo(db.outro(), 'outro', 'gn3'));
    await assertFails(novoGrupo(db.outro(), 'outro', 'gn4'));
  });
  test('grupo novo sem entrar na lista de ativos é recusado', async () => {
    const f = db.outro(),
      b = writeBatch(f);
    b.set(doc(f, 'grupos/gn1'), { name: 'Novo', owner: 'outro', ativo: true, createdAt: 1 });
    b.set(doc(f, 'contas/outro'), { ng: increment(1), ult: 'gn1' }, { merge: true });
    await assertFails(b.commit());
  });
  test('rebaixado: escolhe o grupo que fica; inativar sai da lista; reativar passa do limite e é recusado (critério 4)', async () => {
    await fimDaTransicao();
    await semRegras(async f => {
      for (const g of ['ga', 'gb'])
        await Promise.all([
          setDoc(doc(f, 'grupos/' + g), { name: g, owner: 'outro', ativo: true, createdAt: 1 }),
          setDoc(doc(f, 'grupos/' + g + '/membros/outro'), { uid: 'outro', role: 'owner' }),
        ]);
      await setDoc(doc(f, 'contas/outro'), { ng: 3, ativos: ['g2', 'ga', 'gb'] });
    });
    await assertFails(setDoc(doc(db.outro(), 'contas/outro'), { ativos: arrayRemove('ga') }, { merge: true }));
    await assertSucceeds(inativar(db.outro(), 'outro', 'ga'));
    await assertSucceeds(inativar(db.outro(), 'outro', 'gb'));
    await assertFails(reativar(db.outro(), 'outro', 'ga'));
    await assertFails(updateDoc(doc(db.outro(), 'grupos/ga'), { ativo: true }));
    await assertSucceeds(inativar(db.outro(), 'outro', 'g2'));
    await assertSucceeds(reativar(db.outro(), 'outro', 'ga'));
  });
  test('conta de antes da v70 grava a lista de ativos uma vez; depois, só uma mudança por vez', async () => {
    await assertSucceeds(setDoc(doc(db.outro(), 'contas/outro'), { ativos: ['g2'] }, { merge: true }));
    await assertFails(setDoc(doc(db.outro(), 'contas/outro'), { ativos: ['g2', 'g1'] }, { merge: true }));
    await assertFails(setDoc(doc(db.outro(), 'contas/outro'), { ativos: [] }, { merge: true }));
  });
  test('controle de vagas (lista de espera): ligar só com o Plano A; ligado antes, continua', async () => {
    await fimDaTransicao();
    await assertFails(updateDoc(doc(db.dono(), G), { 'cfg.vagasCtrl': true }));
    await semRegras(f => updateDoc(doc(f, G), { 'cfg.vagasCtrl': true }));
    await assertSucceeds(updateDoc(doc(db.dono(), G), { 'cfg.place': 'Quadra B' }));
    await assertSucceeds(updateDoc(doc(db.dono(), G), { 'cfg.vagasCtrl': false }));
  });
  test('espelho do plano no grupo: só o formato conhecido', async () => {
    await assertSucceeds(updateDoc(doc(db.dono(), G), { pl: { id: 'A', ate: 1, o: 'teste', t: true } }));
    await assertFails(updateDoc(doc(db.dono(), G), { pl: { id: 'A', dono: 'x' } }));
  });
});

describe('administradores convidados por plano (KAN-204)', () => {
  const semRegras = fn => env.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));
  const fimDaTransicao = () => semRegras(f => setDoc(doc(f, 'sistema/planos'), { transicaoAte: 1 }));
  const adm2 = () => env.authenticatedContext('adm2', senha).firestore();
  const lista = adms => semRegras(f => updateDoc(doc(f, G), { adms }));
  const membro = uid =>
    semRegras(f => setDoc(doc(f, G + '/membros/' + uid), { uid, role: 'admin', email: uid + '@x.com' }));
  const gravar = f => updateDoc(doc(f, G + '/rodadas/r1'), { locked: true });
  const entrar = (uid, extra = {}) => {
    const f = env.authenticatedContext(uid, senha).firestore(),
      b = writeBatch(f);
    b.set(doc(f, G + '/membros/' + uid), { uid, role: 'admin', token: 'tok123', perm: NADA });
    b.update(doc(f, G), Object.assign({ adms: arrayUnion(uid) }, extra));
    return b.commit();
  };
  const NADA = { caixa: false, notas: false, elenco: false, config: false };

  test('Grátis (1 convidado): o primeiro grava; o mais novo só vê', async () => {
    await fimDaTransicao();
    await membro('adm2');
    await lista(['adm', 'adm2']);
    await assertSucceeds(gravar(db.adm()));
    await assertFails(gravar(adm2()));
    await assertSucceeds(getDoc(doc(adm2(), G + '/privado/caixa')));
    await assertSucceeds(getDoc(doc(adm2(), G + '/caixa/c1')));
    await assertFails(setDoc(doc(adm2(), G + '/privado/ratings'), { nivel: {} }));
  });
  test('na transição (Plano A, 2 convidados), os dois gravam; o organizador sempre grava', async () => {
    await membro('adm2');
    await lista(['adm', 'adm2']);
    await assertSucceeds(gravar(adm2()));
    await fimDaTransicao();
    await assertSucceeds(gravar(db.dono()));
  });
  test('convidado fora da lista não grava (a lista vale quando existe)', async () => {
    await lista(['outro1']);
    await assertFails(gravar(db.adm()));
  });
  test('convite com o plano cheio é recusado; com vaga, entra no fim da lista', async () => {
    await semRegras(f => setDoc(doc(f, G + '/privado/convite'), { token: 'tok123' }));
    await fimDaTransicao();
    await lista(['adm']);
    await assertFails(entrar('novo'));
    await semRegras(f => setDoc(doc(f, 'sistema/planos'), { transicaoAte: Date.now() + 864e5 }));
    await assertSucceeds(entrar('novo'));
    await assertFails(entrar('novo2'));
  });
  test('quem entra só mexe no próprio nome da lista', async () => {
    await semRegras(f => setDoc(doc(f, G + '/privado/convite'), { token: 'tok123' }));
    await lista([]);
    await assertFails(entrar('novo', { name: 'Outro nome' }));
    const f = env.authenticatedContext('novo', senha).firestore();
    await assertFails(updateDoc(doc(f, G), { adms: arrayUnion('novo') }));
  });
  test('só o organizador arruma a lista; o convidado sai junto com o próprio cadastro', async () => {
    await lista(['adm']);
    await assertFails(updateDoc(doc(db.adm(), G), { adms: ['adm', 'x'] }));
    await assertSucceeds(updateDoc(doc(db.dono(), G), { adms: ['adm'] }));
    const f = db.adm(),
      b = writeBatch(f);
    b.delete(doc(f, G + '/membros/adm'));
    b.update(doc(f, G), { adms: arrayRemove('adm') });
    await assertSucceeds(b.commit());
  });
});

describe('totais do caixa fora do resumo do ranking (KAN-207)', () => {
  const semRegras = fn => env.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));
  const NADA = { caixa: false, notas: false, elenco: false, config: false };
  const conv = () => env.authenticatedContext('conv', senha).firestore();
  const RC = G + '/resumosCaixa/2026-10';
  const preparar = perm =>
    semRegras(async f => {
      await setDoc(doc(f, G + '/membros/conv'), { uid: 'conv', role: 'admin', perm });
      await setDoc(doc(f, RC), { mes: '2026-10', cx: { ent: 8000, sai: 0 } });
    });

  test('sem a permissão de Caixa: não lê nem grava os totais do caixa (critérios 1 e 2)', async () => {
    await preparar(NADA);
    await assertFails(getDoc(doc(conv(), RC)));
    await assertFails(setDoc(doc(conv(), RC), { mes: '2026-10', cx: { ent: increment(1) } }, { merge: true }));
    await assertFails(setDoc(doc(conv(), G + '/resumos/2026-10'), { mes: '2026-10', cx: { ent: 1 } }, { merge: true }));
  });
  test('com a permissão de Caixa: lança e soma no total do mês, no mesmo lote (critério 3)', async () => {
    await preparar({ ...NADA, caixa: true });
    await assertSucceeds(getDoc(doc(conv(), RC)));
    const f = conv(),
      b = writeBatch(f);
    b.set(doc(f, G + '/caixa/c9'), { k: 'entrada', v: 10, d: '2026-10-20' });
    b.set(doc(f, RC), { mes: '2026-10', at: 1, cx: { ent: increment(1000) } }, { merge: true });
    await assertSucceeds(b.commit());
    await assertFails(setDoc(doc(conv(), RC), { mes: '2026-10', extra: 1 }, { merge: true }));
  });
  test('Quadro do ano (KAN-212): mensalidade paga por jogador só com a permissão de Caixa', async () => {
    await preparar({ ...NADA, caixa: true });
    const f = conv(),
      b = writeBatch(f);
    b.set(doc(f, G + '/caixa/c10'), { k: 'mensal', v: 85, d: '2026-11-05', pid: 'p1', ref: '2026-10' });
    b.set(doc(f, RC), { mes: '2026-10', at: 1, mens: { p1: increment(8500) } }, { merge: true });
    await assertSucceeds(b.commit());
    await assertFails(setDoc(doc(conv(), RC), { mes: '2026-10', mens: 5 }, { merge: true }));
    await preparar(NADA);
    await assertFails(setDoc(doc(conv(), RC), { mes: '2026-10', mens: { p1: increment(1) } }, { merge: true }));
  });
  test('ranking continua para todo administrador, e ninguém põe totais do caixa nele (critério 5)', async () => {
    await preparar(NADA);
    await assertSucceeds(getDoc(doc(conv(), G + '/resumos/2026-10')));
    await assertSucceeds(
      setDoc(doc(conv(), G + '/resumos/2026-10'), { mes: '2026-10', jog: { a: { j: increment(1) } } }, { merge: true })
    );
    await assertFails(setDoc(doc(db.dono(), G + '/resumos/2026-11'), { mes: '2026-11', cx: { ent: 1 } }));
  });
  test('grupo de antes da v74: só quem tem Caixa tira o cx antigo do resumo; quem não tem continua gravando o ranking (critério 4)', async () => {
    await preparar(NADA);
    await semRegras(f => setDoc(doc(f, G + '/resumos/2026-09'), { mes: '2026-09', cx: { ent: 500 }, jog: {} }));
    await assertFails(updateDoc(doc(conv(), G + '/resumos/2026-09'), { cx: deleteField() }));
    await assertSucceeds(updateDoc(doc(conv(), G + '/resumos/2026-09'), { 'jog.a.j': increment(1) }));
    await assertFails(updateDoc(doc(db.dono(), G + '/resumos/2026-09'), { 'cx.ent': increment(1) }));
    await assertSucceeds(updateDoc(doc(db.dono(), G + '/resumos/2026-09'), { cx: deleteField() }));
  });
});

describe('afastamento de jogador (KAN-208)', () => {
  const semRegras = fn => env.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));
  const NADA = { caixa: false, notas: false, elenco: false, config: false };
  const conv = () => env.authenticatedContext('conv', senha).firestore();
  const AF = G + '/privado/afast';
  const af1 = { pid: 'j1', mot: 'lesao', obs: 'joelho', de: '2026-06', ate: '2026-09', em: 1 };
  const preparar = perm =>
    semRegras(async f => {
      await setDoc(doc(f, G + '/membros/conv'), { uid: 'conv', role: 'admin', perm });
      await setDoc(doc(f, G + '/privado/caixa'), { pix: 'pix@x.com', tipos: {} });
      await setDoc(doc(f, AF), { a1: af1 });
    });

  test('todo administrador lê os afastamentos; o link do jogador (anônimo) não lê (critério 7)', async () => {
    await preparar(NADA);
    await assertSucceeds(getDoc(doc(conv(), AF)));
    await assertFails(getDoc(doc(db.anon(), AF)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), AF)));
  });
  test('sem a permissão de Elenco não afasta ninguém; com ela, afasta, mas sem Caixa não mexe na isenção (critério 5)', async () => {
    await preparar(NADA);
    await assertFails(setDoc(doc(conv(), AF), { a2: { ...af1, pid: 'j2' } }, { merge: true }));
    await preparar({ ...NADA, elenco: true });
    await assertSucceeds(setDoc(doc(conv(), AF), { a2: { ...af1, pid: 'j2' } }, { merge: true }));
    await assertFails(
      setDoc(
        doc(conv(), G + '/privado/caixa'),
        { afIsen: { a2: { pid: 'j2', de: '2026-06', ate: '2026-09' } } },
        { merge: true }
      )
    );
    // Afastar e isentar no mesmo lote, sem Caixa: o lote inteiro é recusado
    const f = conv(),
      b = writeBatch(f);
    b.set(doc(f, AF), { a3: { ...af1, pid: 'j3' } }, { merge: true });
    b.set(doc(f, G + '/privado/caixa'), { afIsen: { a3: { pid: 'j3', de: '2026-06' } } }, { merge: true });
    await assertFails(b.commit());
  });
  test('com Elenco e Caixa: afasta e isenta a mensalidade no mesmo lote', async () => {
    await preparar({ ...NADA, elenco: true, caixa: true });
    const f = conv(),
      b = writeBatch(f);
    b.set(doc(f, AF), { a4: { ...af1, pid: 'j4' } }, { merge: true });
    b.set(
      doc(f, G + '/privado/caixa'),
      { afIsen: { a4: { pid: 'j4', de: '2026-06', ate: '2026-09' } } },
      { merge: true }
    );
    await assertSucceeds(b.commit());
    await assertSucceeds(updateDoc(doc(db.dono(), AF), { a4: deleteField() }));
  });
});
