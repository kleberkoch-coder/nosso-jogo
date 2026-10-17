/* Teste de carga no emulador do Firebase (KAN-158). Simula muita gente usando o mesmo grupo ao mesmo tempo,
   com as regras de verdade (firestore.rules) e as mesmas gravações que o app faz. Não toca nos dados reais.
   Roda no GitHub (tarefa "carga" em .github/workflows/carga.yml):
     npx firebase emulators:exec --only firestore --project demo-nosso-jogo "node testes/carga/carga.mjs"
   Cenários (critérios do cartão):
     1. 50 jogadores confirmando em 10 segundos: todos gravados, o mais lento abaixo de 2 s.
     2. 40 pessoas se adicionando como avulso ao mesmo tempo, com limite de 30: entram exatamente 30, as outras 10 são recusadas.
     3. 30 votos ao mesmo tempo: ao encerrar, o resultado conta os 30.
     4. 2 administradores sorteando e marcando presença ao mesmo tempo: nenhuma gravação falha e nada se perde.
   Saída: testes/carga/resultado-carga.json e um resumo em Markdown (resultado-carga.md), com tempos, falhas,
   leituras e gravações. O emulador roda numa máquina só: os tempos servem para comparar versões e achar gargalos,
   não são os tempos do Firebase no ar. */
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, increment, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const GITHUB = !!process.env.GITHUB_ACTIONS;
const G = 'grupos/carga',
  R = G + '/rodadas/r1',
  V = G + '/votacoes/v1';
const N_CONF = 50,
  JANELA_MS = 10000,
  N_AVULSOS = 40,
  LIMITE = 30,
  N_VOTOS = 30,
  LIMITE_LENTO_MS = 2000;

const regras = fs
  .readFileSync('firestore.rules', 'utf8')
  .replace(/\/\*ADMINS_PORTAL\*\/\[[^\]]*\]/, "/*ADMINS_PORTAL*/['portal-teste']");
const env = await initializeTestEnvironment({ projectId: 'demo-nosso-jogo', firestore: { rules: regras } });
const senha = { firebase: { sign_in_provider: 'password' } };
const anon = { firebase: { sign_in_provider: 'anonymous' } };
const jogador = uid => env.authenticatedContext(uid, anon).firestore();
const adm = uid => env.authenticatedContext(uid, senha).firestore();

/* Contagem de operações feitas pelos aparelhos simulados (leituras e gravações de documento). */
const ops = { leituras: 0, gravacoes: 0 };
const resultados = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const agora = () => performance.now();
async function cronometrar(fn) {
  const t0 = agora();
  try {
    await fn();
    return { ok: true, ms: agora() - t0 };
  } catch (e) {
    return { ok: false, ms: agora() - t0, erro: (e && (e.code || e.message)) || String(e) };
  }
}
const resumoTempos = xs => {
  const ms = xs.map(x => x.ms).sort((a, b) => a - b);
  const p = q => (ms.length ? ms[Math.min(ms.length - 1, Math.floor(q * ms.length))] : 0);
  return { mediana: Math.round(p(0.5)), p95: Math.round(p(0.95)), max: Math.round(ms[ms.length - 1] || 0) };
};
function registrar(nome, criterio, passou, dados) {
  resultados.push({ cenario: nome, criterio, passou, ...dados });
  const linha = `${passou ? 'OK     ' : 'FALHOU '} ${nome}: ${criterio} ${JSON.stringify(dados)}`;
  console.log(linha);
  if (GITHUB)
    console.log(`${passou ? '::notice::' : '::error::'}Carga · ${nome}: ${criterio} (${JSON.stringify(dados)})`);
}

async function preparar() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore(),
      s = (p, o) => setDoc(doc(f, p), o);
    await s(G, { name: 'Carga FC', owner: 'dono', ativo: true, createdAt: 1 });
    await s(G + '/membros/dono', { uid: 'dono', role: 'owner', email: 'dono@x.com' });
    await s(G + '/membros/adm', { uid: 'adm', role: 'admin', email: 'adm@x.com' });
    await s('sistema/limites', { avulsosPorRodada: LIMITE, gruposPorConta: 20 });
    await s(R, { date: new Date().toISOString().slice(0, 10), locked: false });
    for (let i = 1; i <= N_CONF; i++) await s(`${G}/jogadores/j${i}`, { name: 'Jogador ' + i });
    await s(V, { open: true, cats: [{ id: 'mvp' }], createdAt: 1 });
  });
}

/* 1. 50 confirmações espalhadas em 10 segundos, cada uma de um aparelho (login anônimo) diferente. */
async function confirmacoes() {
  const tarefas = [];
  for (let i = 1; i <= N_CONF; i++) {
    const uid = 'p' + i,
      espera = Math.random() * JANELA_MS;
    tarefas.push(
      sleep(espera).then(() =>
        cronometrar(async () => {
          await setDoc(doc(jogador(uid), `${R}/presencas/j${i}`), { s: 'in', t: Date.now(), by: uid, dev: uid });
          ops.gravacoes++;
        })
      )
    );
  }
  const r = await Promise.all(tarefas);
  const gravadas = await env.withSecurityRulesDisabled(
    async ctx => (await getDocs(collection(ctx.firestore(), R + '/presencas'))).size
  );
  const t = resumoTempos(r),
    falhas = r.filter(x => !x.ok);
  registrar(
    '50 confirmações em 10 s',
    `todas gravadas e a mais lenta abaixo de ${LIMITE_LENTO_MS} ms`,
    gravadas === N_CONF && !falhas.length && t.max < LIMITE_LENTO_MS,
    { gravadas, falhas: falhas.length, ...t, erros: [...new Set(falhas.map(f => f.erro))] }
  );
}

/* 2. 40 avulsos ao mesmo tempo: presença + 1 no contador da rodada, no mesmo lote (como o app faz). */
async function avulsos() {
  const C = R + '/limites/avulsos';
  const r = await Promise.all(
    Array.from({ length: N_AVULSOS }, (_, k) => {
      const uid = 'av' + (k + 1),
        f = jogador(uid);
      return cronometrar(async () => {
        const b = writeBatch(f);
        b.set(doc(f, `${R}/presencas/${uid}`), {
          s: 'in',
          t: Date.now(),
          by: uid,
          dev: uid,
          nome: 'Avulso ' + (k + 1),
          avulso: true,
        });
        b.set(doc(f, C), { n: increment(1), ult: uid }, { merge: true });
        await b.commit();
        ops.gravacoes += 2;
      });
    })
  );
  const { n, entraram } = await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore(),
      c = (await getDoc(doc(f, C))).data() || {},
      ps = await getDocs(collection(f, R + '/presencas'));
    return { n: c.n, entraram: ps.docs.filter(d => d.data().avulso).length };
  });
  const recusadas = r.filter(x => !x.ok);
  const soLimite = recusadas.every(x => /permission/i.test(x.erro));
  registrar(
    '40 avulsos ao mesmo tempo (limite 30)',
    `entram exatamente ${LIMITE}, as outras ${N_AVULSOS - LIMITE} recebem o aviso de limite`,
    entraram === LIMITE && n === LIMITE && recusadas.length === N_AVULSOS - LIMITE && soLimite,
    { entraram, contador: n, recusadas: recusadas.length, recusaPorLimite: soLimite, ...resumoTempos(r) }
  );
}

/* 3. 30 votos ao mesmo tempo e o encerramento pelo administrador (lê os votos e grava o resultado). */
async function votos() {
  const r = await Promise.all(
    Array.from({ length: N_VOTOS }, (_, k) => {
      const uid = 'v' + (k + 1);
      return cronometrar(async () => {
        await setDoc(doc(jogador(uid), `${V}/votos/${uid}`), {
          pid: 'j' + (k + 1),
          v: { mvp: 'j' + ((k % 3) + 1) },
          t: Date.now(),
        });
        ops.gravacoes++;
      });
    })
  );
  const f = adm('adm');
  let contados = 0;
  const enc = await cronometrar(async () => {
    const vs = await getDocs(collection(f, V + '/votos'));
    ops.leituras += vs.size;
    const placar = {};
    vs.forEach(d => {
      const x = d.data().v.mvp;
      placar[x] = (placar[x] || 0) + 1;
    });
    contados = Object.values(placar).reduce((s, x) => s + x, 0);
    await updateDoc(doc(f, V), { open: false, resultado: { mvp: { votos: placar } } });
    ops.gravacoes++;
  });
  const falhas = r.filter(x => !x.ok);
  registrar(
    '30 votos ao mesmo tempo',
    'ao encerrar, o resultado conta os 30, sem perda',
    contados === N_VOTOS && !falhas.length && enc.ok,
    { contados, falhas: falhas.length, encerrar: enc.ok ? Math.round(enc.ms) + ' ms' : enc.erro, ...resumoTempos(r) }
  );
}

/* 4. Dois administradores ao mesmo tempo: um sorteia (grava os times e fecha a lista) e o outro marca 10 presenças. */
async function administradores() {
  await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore();
    await setDoc(doc(f, G + '/rodadas/r2'), { date: new Date().toISOString().slice(0, 10), locked: false });
  });
  const R2 = G + '/rodadas/r2';
  const a = adm('adm'),
    d = adm('dono');
  const times = [{ players: ['j1', 'j2', 'j3', 'j4', 'j5'] }, { players: ['j6', 'j7', 'j8', 'j9', 'j10'] }];
  const marcar = Array.from({ length: 10 }, (_, k) =>
    cronometrar(async () => {
      await setDoc(doc(d, `${R2}/presencas/j${k + 11}`), { s: 'in', t: Date.now(), by: 'dono' });
      ops.gravacoes++;
    })
  );
  const sortear = [1, 2].map(() =>
    cronometrar(async () => {
      await updateDoc(doc(a, R2), { times, locked: true, sorteadoEm: Date.now() });
      ops.gravacoes++;
    })
  );
  const r = await Promise.all([...marcar, ...sortear]);
  const fim = await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore(),
      rd = (await getDoc(doc(f, R2))).data(),
      ps = await getDocs(collection(f, R2 + '/presencas'));
    return { times: (rd.times || []).length, presencas: ps.size };
  });
  const falhas = r.filter(x => !x.ok);
  registrar(
    '2 administradores ao mesmo tempo',
    'sorteio e 10 marcações gravados, sem falha',
    !falhas.length && fim.times === 2 && fim.presencas === 10,
    { ...fim, falhas: falhas.length, erros: [...new Set(falhas.map(f => f.erro))], ...resumoTempos(r) }
  );
}

/* Leituras de quem abre o link: cada aparelho lê o grupo, a rodada, o elenco e a lista de presença. */
async function leiturasDoLink() {
  const f = jogador('leitor');
  const t = await cronometrar(async () => {
    const [g, r, js, ps] = await Promise.all([
      getDoc(doc(f, G)),
      getDoc(doc(f, R)),
      getDocs(collection(f, G + '/jogadores')),
      getDocs(collection(f, R + '/presencas')),
    ]);
    ops.leituras += 2 + js.size + ps.size;
    leituraLink = 2 + js.size + ps.size;
  });
  registrar('abrir o link com a lista cheia', 'medida (sem critério)', t.ok, {
    leituras: leituraLink,
    ms: Math.round(t.ms),
  });
}
let leituraLink = 0;

await preparar();
const t0 = agora();
await confirmacoes();
await avulsos();
await votos();
await administradores();
await leiturasDoLink();
const total = Math.round(agora() - t0);
await env.cleanup();

const saida = { quando: new Date().toISOString(), totalMs: total, operacoes: ops, resultados };
fs.writeFileSync('testes/carga/resultado-carga.json', JSON.stringify(saida, null, 1));
const md = [
  `| Cenário | Critério | Resultado | Tempos (mediana / p95 / máx.) |`,
  `|---|---|---|---|`,
  ...resultados.map(
    x =>
      `| ${x.cenario} | ${x.criterio} | ${x.passou ? '✅' : '❌'} ${Object.entries(x)
        .filter(([k]) => !['cenario', 'criterio', 'passou', 'mediana', 'p95', 'max', 'erros'].includes(k))
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')} | ${x.mediana != null ? `${x.mediana} / ${x.p95} / ${x.max} ms` : '—'} |`
  ),
  '',
  `Operações dos aparelhos simulados: ${ops.gravacoes} gravações e ${ops.leituras} leituras, em ${total} ms.`,
].join('\n');
fs.writeFileSync('testes/carga/resultado-carga.md', md + '\n');
console.log('\n' + md);
const falhou = resultados.filter(x => !x.passou);
console.log(`\nTeste de carga: ${resultados.length - falhou.length} de ${resultados.length} cenários passaram.`);
process.exit(falhou.length ? 1 : 0);
