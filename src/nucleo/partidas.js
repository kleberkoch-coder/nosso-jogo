import {
  camposEdicao,
  camposLancamento,
  camposPartida,
  camposVotacao,
  mesDe,
  resumirTudo,
  vazio,
} from '../dominio/resumos.ts';
import { rodById } from '../dominio/grupo.js';
import { B, op } from './backend.js';
import { GB, S, clean, gp, w } from './estado.js';
import { cl, toast } from './util.js';
import { changed } from '../ui/render.js';
import { partidasDe } from './partidas-lista.js';

/* ---------- Partidas na subpasta da rodada (D10, KAN-86) e totais por mês (D11, KAN-87) ----------
   Partida: grupos/{gid}/rodadas/{rid}/partidas/{id}. A ficha da rodada guarda só a contagem (np).
   Resumo do mês: grupos/{gid}/resumos/{AAAA-MM}. Cada gravação vai num lote junto com o ajuste do resumo:
   ou entra tudo, ou nada (também sem internet). As somas usam o incremento do servidor, então
   dois administradores salvando ao mesmo tempo não se apagam (D4). O botão Recalcular refaz do zero. */

const VERSAO_DADOS = 18;
const LOTE = 200; // o Firestore aceita até 500 gravações por lote; menos, para folgar nas checagens das regras

/* Campos da regra (resumos.ts) → campos de gravação. */
function patchResumo(c) {
  const o = { mes: c.mes, at: Date.now() };
  Object.entries(c.somar).forEach(([k, n]) => {
    o[k] = op.somar(n);
  });
  Object.entries(c.gravar).forEach(([k, v]) => {
    o[k] = clean(v);
  });
  c.apagar.forEach(k => {
    o[k] = op.apagar();
  });
  return o;
}
/* Mesmo ajuste no resumo em memória, para a tela mudar na hora (otimista). */
function localResumo(c) {
  if (!S.res || !c.mes) return;
  const d = cl(S.res[c.mes]) || vazio(c.mes);
  Object.entries(c.somar).forEach(([k, n]) => {
    const ps = k.split('.'),
      f = ps.pop();
    let a = d;
    ps.forEach(p => {
      a = a[p] = a[p] || {};
    });
    a[f] = (a[f] || 0) + n;
  });
  Object.entries(c.gravar).forEach(([k, v]) => {
    const ps = k.split('.'),
      f = ps.pop();
    let a = d;
    ps.forEach(p => {
      a = a[p] = a[p] || {};
    });
    a[f] = cl(v);
  });
  c.apagar.forEach(k => {
    const ps = k.split('.'),
      f = ps.pop();
    let a = d;
    ps.forEach(p => {
      a = a[p] = a[p] || {};
    });
    delete a[f];
  });
  S.res[c.mes] = d;
}
/* Sem mês (lançamento antigo sem data) não há ficha a ajustar. */
function opResumo(c) {
  if (!c.mes) return null;
  localResumo(c);
  return { tipo: 'patch', p: 'resumos/' + c.mes, o: patchResumo(c) };
}
const sem = ops => ops.filter(Boolean);

/* Partidas da rodada aberta, na ordem em que foram salvas. */

function addMatch(rid, m) {
  const r = rodById(rid);
  if (!r) return Promise.resolve();
  const doc = clean(Object.assign({}, m, { rid, date: r.date }));
  if (S.partsRid === rid) {
    S.parts = Object.assign({}, S.parts, { [m.id]: doc });
  }
  const existe = !!S.rod[rid],
    ops = [{ tipo: 'set', p: 'rodadas/' + rid + '/partidas/' + m.id, o: doc }];
  if (existe) {
    S.rod[rid] = Object.assign({}, S.rod[rid], { np: (S.rod[rid].np || 0) + 1 });
    ops.push({ tipo: 'patch', p: 'rodadas/' + rid, o: { np: op.somar(1) } });
  } else {
    const o = Object.assign({}, r, { createdAt: Date.now() });
    delete o.id;
    delete o.virtual;
    delete o.matches;
    S.rod[rid] = Object.assign({}, o, { np: 1 });
    /* Rodada fixa ainda sem ficha: grava só os campos (merge), para não apagar o que outro administrador acabou de gravar. */
    const c = clean(o);
    c.np = op.somar(1);
    ops.unshift({ tipo: 'patch', p: 'rodadas/' + rid, o: c });
  }
  ops.push(opResumo(camposPartida(m, rid, r.date, 1)));
  changed();
  return w(GB.lote(sem(ops)));
}

function delMatch(rid, mid) {
  const m = (S.parts || {})[mid],
    r = rodById(rid);
  if (!m || !r) return Promise.resolve();
  const p = Object.assign({}, S.parts);
  delete p[mid];
  S.parts = p;
  if (S.rod[rid]) S.rod[rid] = Object.assign({}, S.rod[rid], { np: Math.max(0, (S.rod[rid].np || 1) - 1) });
  /* A regra do Firebase só deixa apagar partida que existe: se outro administrador já apagou, o lote inteiro é recusado e nada é descontado duas vezes. */
  const ops = [
    { tipo: 'del', p: 'rodadas/' + rid + '/partidas/' + mid },
    { tipo: 'patch', p: 'rodadas/' + rid, o: { np: op.somar(-1) } },
    opResumo(camposPartida(Object.assign({ id: mid }, m), rid, m.date || r.date, -1)),
  ];
  changed();
  return w(GB.lote(sem(ops)));
}

/* Partida editada depois de salva (KAN-176): regrava a partida e ajusta o resumo do mês no mesmo lote. */
function editMatch(rid, mid, novo) {
  const antes = (S.parts || {})[mid],
    r = rodById(rid);
  if (!antes || !r) return Promise.resolve();
  const date = antes.date || r.date,
    doc = clean(Object.assign({}, antes, novo, { rid, date, editadaEm: Date.now(), ver: (antes.ver || 0) + 1 }));
  S.parts = Object.assign({}, S.parts, { [mid]: doc });
  const ops = [{ tipo: 'set', p: 'rodadas/' + rid + '/partidas/' + mid, o: doc }].concat(
    camposEdicao(Object.assign({ id: mid }, antes), Object.assign({ id: mid }, doc), rid, date).map(opResumo)
  );
  changed();
  return w(GB.lote(sem(ops)));
}

/* Artilharia da rodada (KAN-178): um documento por rodada (partidas/art). Na primeira vez cria; depois edita com versão. */
function salvarArtilharia(rid, gols) {
  const r = rodById(rid);
  if (!r) return Promise.resolve();
  if ((S.parts || {}).art) return editMatch(rid, 'art', { gols });
  const doc = clean({ tipo: 'art', gols, rid, date: r.date, at: Date.now() });
  if (S.partsRid === rid) S.parts = Object.assign({}, S.parts, { art: doc });
  const ops = [{ tipo: 'set', p: 'rodadas/' + rid + '/partidas/art', o: doc }];
  if (!S.rod[rid]) {
    const o = Object.assign({}, r, { createdAt: Date.now() });
    delete o.id;
    delete o.virtual;
    delete o.matches;
    S.rod[rid] = o;
    ops.unshift({ tipo: 'patch', p: 'rodadas/' + rid, o: clean(o) });
  }
  ops.push(opResumo(camposPartida(Object.assign({ id: 'art' }, doc), rid, r.date, 1)));
  changed();
  return w(GB.lote(sem(ops)));
}

/* Caixa: lançamento junto com o resumo do mês. */
function salvarLanc(id, o) {
  S.caixa[id] = o;
  const ops = [{ tipo: 'set', p: 'caixa/' + id, o: clean(o) }, opResumo(camposLancamento(o, 1))];
  changed();
  return w(GB.lote(sem(ops)));
}
function apagarLanc(id) {
  const o = S.caixa[id];
  if (!o) return Promise.resolve();
  delete S.caixa[id];
  const ops = [{ tipo: 'del', p: 'caixa/' + id }, opResumo(camposLancamento(o, -1))];
  changed();
  return w(GB.lote(sem(ops)));
}

/* Votação: ao encerrar soma destaques e bagres; ao reabrir ou apagar uma encerrada, desconta. */
function gravarVotacao(vid, antes, depois) {
  const ops = [];
  if (antes && !antes.open && antes.resultado) ops.push(opResumo(camposVotacao(antes, -1)));
  if (depois && !depois.open && depois.resultado) ops.push(opResumo(camposVotacao(depois, 1)));
  ops.unshift(depois ? { tipo: 'set', p: 'votacoes/' + vid, o: clean(depois) } : { tipo: 'del', p: 'votacoes/' + vid });
  changed();
  return w(GB.lote(sem(ops)));
}

/* Excluir a rodada tira as partidas dela do ranking (desconta dos resumos). */
async function apagarPartidasDaRodada(rid, date) {
  const d = S.rod[rid] || {};
  if (!(d.np > 0) && !(d.matches || []).length) return;
  const ps = await lerPartidas([[rid, d]]),
    ops = [];
  ps.forEach(p => {
    if (!p._antiga) ops.push({ tipo: 'del', p: 'rodadas/' + rid + '/partidas/' + p.id });
    ops.push(opResumo(camposPartida(p, rid, p.date || date, -1)));
  });
  await w(enviar(sem(ops)));
}

/* Lotes de até 400 gravações. */
async function enviar(ops) {
  for (let i = 0; i < ops.length; i += LOTE) await GB.lote(ops.slice(i, i + LOTE));
}

/* Lê as partidas de uma lista de rodadas: as da subpasta (no servidor) e as antigas ainda dentro da ficha.
   Partida antiga que já está na subpasta (movida antes por outro aparelho) não é repetida. */
async function lerPartidas(rods) {
  const out = [];
  for (const [rid, r] of rods) {
    const sub = (await B.getServidor(gp('rodadas/' + rid + '/partidas'))) || {};
    Object.entries(sub).forEach(([id, m]) => out.push(Object.assign({ id }, m, { rid, date: m.date || r.date })));
    (r.matches || []).forEach((m, i) => {
      const id = m.id || rid + '-' + i;
      if (!sub[id]) out.push(Object.assign({}, m, { id, rid, date: r.date, _antiga: true, _orig: m }));
    });
  }
  return out;
}

/* Primeira abertura depois da atualização: move as partidas para a subpasta e monta os resumos.
   Pode rodar em dois aparelhos ao mesmo tempo sem problema: os ids são os mesmos e os resumos saem iguais. */
async function migrar() {
  if (S.migrandoDados || !S.dataOn || !S.loaded.migr || !S.loaded.caixa || !S.loaded.vot) return;
  if (((S.migr || {}).v || 0) >= VERSAO_DADOS) return;
  if (S.migrErro && Date.now() - S.migrErro < 60000) return; // se falhou, tenta de novo só depois de 1 minuto
  S.migrandoDados = true;
  changed();
  try {
    const todas = (await B.getServidor(gp('rodadas'))) || {},
      rods = Object.entries(todas);
    const partidas = await lerPartidas(rods.filter(([, r]) => (r.matches || []).length || r.np > 0)),
      ops = [];
    /* Copia as antigas (a regra só deixa criar: se outro aparelho já copiou, este lote é recusado e nada conta em dobro)
       e tira da ficha só os itens copiados (arrayRemove), para não perder uma partida gravada no meio do caminho por um app antigo. */
    rods.forEach(([rid, r]) => {
      const novas = partidas.filter(p => p.rid === rid && p._antiga);
      if (!novas.length && !(r.matches || []).length) return;
      novas.forEach(p => {
        const o = Object.assign({}, p);
        delete o._antiga;
        delete o._orig;
        ops.push({ tipo: 'set', p: 'rodadas/' + rid + '/partidas/' + p.id, o: clean(o) });
      });
      /* np com o total (subpasta + copiadas agora): fica certo mesmo se uma tentativa anterior parou no meio. */
      ops.push({
        tipo: 'patch',
        p: 'rodadas/' + rid,
        o: { matches: op.remover((r.matches || []).map(cl)), np: partidas.filter(p => p.rid === rid).length },
      });
    });
    const res = resumirTudo(partidas, Object.values(S.caixa || {}), Object.values(S.vot || {}));
    Object.values(res).forEach(d =>
      ops.push({ tipo: 'set', p: 'resumos/' + d.mes, o: clean(Object.assign({}, d, { at: Date.now() })) })
    );
    ops.push({ tipo: 'set', p: 'privado/migracao', o: { v: VERSAO_DADOS, at: Date.now() } });
    await enviar(ops);
    S.migr = { v: VERSAO_DADOS };
  } catch (e) {
    console.warn('migração das partidas', e);
    S.migrErro = Date.now();
  } finally {
    S.migrandoDados = false;
    changed();
  }
}

/* Aparelho com versão antiga ainda pode gravar partida dentro da ficha da rodada: move na hora. */
const movendo = new Set(),
  falhou = {};
function verificarRodadas() {
  if (((S.migr || {}).v || 0) < VERSAO_DADOS || !S.dataOn) return;
  Object.entries(S.rod || {}).forEach(([rid, r]) => {
    if (!(r.matches || []).length || movendo.has(rid) || (falhou[rid] && Date.now() - falhou[rid] < 60000)) return;
    movendo.add(rid);
    /* Criar a partida só funciona se ela ainda não existe: se outro aparelho já moveu, o lote é recusado e nada conta em dobro. */
    const ops = [];
    r.matches.forEach((m, i) => {
      const id = m.id || rid + '-' + i;
      ops.push({
        tipo: 'set',
        p: 'rodadas/' + rid + '/partidas/' + id,
        o: clean(Object.assign({}, m, { id, rid, date: r.date })),
      });
      ops.push(opResumo(camposPartida(Object.assign({ id }, m), rid, r.date, 1)));
    });
    ops.push({
      tipo: 'patch',
      p: 'rodadas/' + rid,
      o: { matches: op.remover(r.matches.map(cl)), np: op.somar(r.matches.length) },
    });
    GB.lote(sem(ops))
      .catch(e => {
        console.warn('mover partidas', e);
        falhou[rid] = Date.now();
      })
      .finally(() => movendo.delete(rid));
  });
}

/* Botão Recalcular: refaz as fichas do período a partir das partidas, do caixa e das votações.
   periodo: 'AAAA-MM' (um mês), 'AAAA' (ano) ou 'todos'. */
async function recalcular(periodo) {
  const dentro = m => periodo === 'todos' || m.startsWith(periodo);
  const todas = (await B.getServidor(gp('rodadas'))) || {};
  const rods = Object.entries(todas).filter(([, r]) => dentro(mesDe(r.date)) && ((r.matches || []).length || r.np > 0));
  const partidas = await lerPartidas(rods);
  const lanc = Object.values(S.caixa || {}).filter(l => dentro(mesDe(l.d)));
  const res = resumirTudo(partidas, lanc, Object.values(S.vot || {}));
  Object.keys(res).forEach(m => {
    if (!dentro(m)) delete res[m];
  });
  Object.keys(S.res || {}).forEach(m => {
    if (dentro(m) && !res[m]) res[m] = vazio(m);
  });
  if (periodo.length === 7 && !res[periodo]) res[periodo] = vazio(periodo);
  const ops = Object.values(res).map(d => ({
    tipo: 'set',
    p: 'resumos/' + d.mes,
    o: clean(Object.assign({}, d, { at: Date.now() })),
  }));
  if (S.res)
    Object.values(res).forEach(d => {
      S.res[d.mes] = cl(d);
    });
  await enviar(ops);
  changed();
  toast('Totais recalculados.');
}

export {
  VERSAO_DADOS,
  addMatch,
  apagarLanc,
  apagarPartidasDaRodada,
  delMatch,
  editMatch,
  salvarArtilharia,
  gravarVotacao,
  migrar,
  partidasDe,
  recalcular,
  salvarLanc,
  verificarRodadas,
};
